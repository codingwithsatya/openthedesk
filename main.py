import os
import uuid
import base64
import asyncio
import json
import httpx
import anthropic
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import FastAPI, HTTPException, UploadFile, File, Request, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse as FastAPIStreaming
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from context import fetch_live_context
from market_data import get_market_summary
from tradier import get_0dte_snapshot, format_options_context, get_market_internals
from analyzer import get_ticker_analysis, get_watchlist_data
import time
import jwt as pyjwt

load_dotenv()
TV_WEBHOOK_SECRET = os.getenv("TV_WEBHOOK_SECRET", "dev-secret")

# ── Supabase init — graceful if not configured ───────────────────
_sb = None
try:
    _sb_url = os.getenv("SUPABASE_URL", "")
    _sb_key = os.getenv("SUPABASE_SERVICE_KEY", "")
    if _sb_url and _sb_key:
        from supabase import create_client
        _sb = create_client(_sb_url, _sb_key)
        print("✅ Supabase connected")
    else:
        print("⚠️  Supabase not configured — using in-memory fallback")
except Exception as _e:
    print(f"⚠️  Supabase init failed: {_e} — using in-memory fallback")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── LangSmith setup — graceful if not configured ────────────────
_LS_ENABLED = False
try:
    if os.getenv("LANGSMITH_API_KEY"):
        from langsmith.wrappers import wrap_anthropic as _ls_wrap
        _LS_ENABLED = True
except ImportError:
    pass  # langsmith not installed — tracing silently disabled

_raw_client = anthropic.Anthropic(timeout=60.0)
_raw_stream_client = anthropic.Anthropic(timeout=120.0)
client = _ls_wrap(_raw_client) if _LS_ENABLED else _raw_client
stream_client = _ls_wrap(
    _raw_stream_client) if _LS_ENABLED else _raw_stream_client

# ── Model constants ──────────────────────────────────────────────
SONNET = "claude-sonnet-4-6"
HAIKU = "claude-haiku-4-5-20251001"

# Commands that need speed/structure, not deep reasoning
_HAIKU_COMMANDS = {
    "PTR-FAST", "PTR-FULL", "GRADE", "PATTERN CHECK",
    "MARKET REGIME", "CAPITAL PROTECTION", "WIRE OUT",
    "TRADE REVIEW", "EOD",
}

_JOURNAL_INTENT_SYSTEM = """You are a classifier. The user is a day trader.
Determine if their message describes a COMPLETED trade they want to log.

A journal entry message contains: a setup name (GG, FLAG, VOMY, iVOMY, BT, ORB),
a direction (bull/bear/call/put), an entry price, and an exit price or P&L.

Reply with exactly one word: YES or NO.
No explanation. No punctuation. Just YES or NO."""

_JOURNAL_EXTRACT_SYSTEM = """You are a trade journal extraction assistant.
Extract structured fields from the user's trade description.

Valid setups: GG, FLAG, VOMY, iVOMY, BT, ORB
Valid directions: BULL, BEAR
Valid grades: A+, A, B

Return ONLY a valid JSON object with these exact keys:
{
  "ticker": "SPX",
  "setup": "GG",
  "direction": "BULL",
  "entry_price": 7390.0,
  "exit_price": 7378.0,
  "contracts": 1,
  "pnl": null,
  "grade": "A",
  "process_grade": "A",
  "notes": "any extra context the user mentioned"
}

Rules:
- ticker defaults to "SPX" if not mentioned
- contracts defaults to 1 if not mentioned
- pnl: use the dollar value if user stated it explicitly, else null
  (backend will calculate from entry/exit)
- grade and process_grade default to "A" if not mentioned
- notes: capture any extra context (e.g. "stopped correctly", "FOMO entry")
- If entry_price or exit_price cannot be determined, return {"error": "missing_fields", "missing": ["field1"]}
- Return ONLY the JSON object. No markdown. No explanation. No backticks."""


def route_model(message: str) -> str:
    """Return the cheapest model that can handle this command well."""
    return HAIKU if message.strip().upper() in _HAIKU_COMMANDS else SONNET


def log_trace(
    command: str,
    model: str,
    session_id: str,
    endpoint: str,
    tokens_in: int,
    tokens_out: int,
) -> None:
    """Log exact token usage to Railway console after each Claude call."""
    model_short = "haiku" if "haiku" in model else "sonnet"
    print(
        f"[TRACE] command={command!r}  model={model_short}"
        f"  tokens_in={tokens_in:,}  tokens_out={tokens_out:,}"
        f"  session={session_id}  endpoint={endpoint}"
    )


def with_retry(fn, max_attempts=3):
    """Retry fn on OverloadedError or APIStatusError 529 with exponential backoff (1s, 2s, 4s…)."""
    for attempt in range(max_attempts):
        try:
            return fn()
        except (anthropic.OverloadedError, anthropic.APIStatusError) as e:
            if isinstance(e, anthropic.APIStatusError) and e.status_code != 529:
                raise
            if attempt == max_attempts - 1:
                raise
            time.sleep(2 ** attempt)


# Load context once at startup
print("📡 Loading live trading context...")
LIVE_CONTEXT = fetch_live_context()
print("✅ Context loaded")
print(
    f"🔍 LangSmith tracing: {'enabled → project=openthedesk' if _LS_ENABLED else 'disabled (LANGSMITH_API_KEY not set)'}")

# Unusual flow context — updated on each /market-data poll (every 60s from frontend)
FLOW_CONTEXT: str = ""
INTERNALS_CACHE: dict = {"trin": None, "add": None, "vold": None,
                         "pcc": None, "bias": None, "ts": None}

# TradingView webhook alert buffer — newest first, capped at 50
TV_ALERTS: list[dict] = []

# One asyncio.Queue per connected SSE client
ALERT_SUBSCRIBERS: set[asyncio.Queue] = set()

_ET = ZoneInfo("America/New_York")


async def _keep_alive():
    """Ping /ping every 10 min on weekdays 09:00–16:00 ET to prevent Railway idle."""
    port = int(os.environ.get("PORT", 8000))
    async with httpx.AsyncClient() as http:
        while True:
            await asyncio.sleep(600)
            now = datetime.now(_ET)
            if now.weekday() < 5 and 9 <= now.hour < 16:
                try:
                    await http.get(f"http://localhost:{port}/ping")
                except Exception:
                    pass


@app.on_event("startup")
async def startup():
    asyncio.create_task(_keep_alive())


# ── Journal intent helpers ───────────────────────────────────────

_JOURNAL_COMMAND_PREFIXES = (
    "PREMARKET", "PTR", "IN TRADE", "TRADE IDEA", "TRADE REVIEW",
    "EOD", "OPEN THE DESK", "GRADE", "PATTERN CHECK", "MARKET REGIME",
    "CAPITAL PROTECTION", "WIRE OUT", "BLUNT FEEDBACK", "WEEKLY REVIEW",
    "SETUP LIBRARY", "CLOSE THE DESK",
)


def _is_command_message(message: str) -> bool:
    """Return True if message is a known trading command — skip journal intent check."""
    upper = message.strip().upper()
    if upper in _HAIKU_COMMANDS:
        return True
    return any(upper.startswith(p) for p in _JOURNAL_COMMAND_PREFIXES)


def _detect_journal_intent(message: str) -> bool:
    """Return True if message looks like a completed trade the user wants to log."""
    try:
        r = with_retry(lambda: client.messages.create(
            model=HAIKU,
            max_tokens=64,
            system=_JOURNAL_INTENT_SYSTEM,
            messages=[{"role": "user", "content": message}],
        ))
        return r.content[0].text.strip().upper().startswith("YES")
    except Exception as _e:
        print(f"[WARN] journal intent check failed: {_e}")
        return False


def _extract_journal_fields(message: str) -> dict | None:
    """Extract structured trade fields from message. Returns dict or None on failure."""
    try:
        r = with_retry(lambda: client.messages.create(
            model=HAIKU,
            max_tokens=512,
            system=_JOURNAL_EXTRACT_SYSTEM,
            messages=[{"role": "user", "content": message}],
        ))
        raw = r.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        data = json.loads(raw.strip())
        if "error" in data:
            return {"error": data.get("error"), "missing": data.get("missing", [])}
        return data
    except Exception as _e:
        print(f"[WARN] journal extraction failed: {_e}")
        return None


def _save_journal_entry(fields: dict, user_id: str) -> dict:
    """Write extracted journal fields to trade_journal. Returns saved entry dict."""
    direction = (fields.get("direction") or "BULL").upper()
    entry_price = float(fields.get("entry_price", 0))
    exit_price = float(fields.get("exit_price", 0))
    contracts = int(fields.get("contracts") or 1)

    pnl = fields.get("pnl")
    if pnl is None:
        pnl = _calc_pnl(direction, entry_price, exit_price, contracts)
    pnl = round(float(pnl), 2)

    internals = {k: INTERNALS_CACHE.get(k) for k in ["trin", "add", "vold"]}

    entry = {
        "id":            str(uuid.uuid4()),
        "created_at":    datetime.now(timezone.utc).isoformat(),
        "date":          datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d"),
        "ticker":        fields.get("ticker", "SPX"),
        "setup":         fields.get("setup", ""),
        "direction":     direction,
        "entry_price":   entry_price,
        "exit_price":    exit_price,
        "contracts":     contracts,
        "pnl":           pnl,
        "grade":         fields.get("grade", "A"),
        "process_grade": fields.get("process_grade", "A"),
        "notes":         fields.get("notes") or "",
        "internals":     internals,
    }

    if _sb:
        try:
            _sb.table("trade_journal").insert({
                "user_id":       user_id,
                "date":          entry["date"],
                "ticker":        entry["ticker"],
                "setup":         entry["setup"],
                "direction":     entry["direction"],
                "entry_price":   entry["entry_price"],
                "exit_price":    entry["exit_price"],
                "contracts":     entry["contracts"],
                "pnl":           entry["pnl"],
                "grade":         entry["grade"],
                "process_grade": entry["process_grade"],
                "notes":         entry["notes"],
                "internals":     entry["internals"],
            }).execute()
        except Exception as _e:
            print(f"[WARN] chat→journal insert failed: {_e}")

    JOURNAL_ENTRIES.insert(0, entry)
    return entry


def build_system_prompt(live_context: str, flow_context: str = "") -> str:
    flow_section = ""
    if flow_context:
        flow_section = f"""

    UNUSUAL FLOW DETECTED (auto-calculated from Tradier vol/OI — refreshes every 60s):
    ================================================================
    {flow_context}
    ================================================================"""

    return f"""You are the OpenTheDesk trading agent for Satya Pramod.

    You are a professional 0DTE options trading desk agent, personal trading coach,
    and risk manager — the most disciplined voice in the room.

    Your core philosophy:
    - You analyze, react, and trade — you never predict or speculate
    - Process grade is always separate from P&L outcome
    - A perfectly executed losing trade is better than a lucky winning one
    - Zero tolerance for: revenge trading, FOMO, invented stops, averaging down, oversizing, chasing
    - Be direct and accurate — not soft, not harsh
    - If a trade has no edge: NO TRADE — Edge Not Present
    - The market doesn't care about you. Respect it.

    LIVE TRADING CONTEXT (fetched fresh today):
    ================================================================
    {live_context}
    ================================================================{flow_section}

    SHORTCUT COMMANDS — respond in exact format when triggered:
    - "Open the Desk" → Full session opener with TD number, account, gap to $3,000, Phase 2 rules, session ready
    - "PTR-FAST" → 3-gate quick check, all must be YES or SKIP IT. Internals (TRIN/ADD/VOLD) are context only — if data is None/unavailable, show as unavailable and still evaluate Gate 2 based on ribbon, ATR levels and setup quality. Never fail PTR-FAST purely because internals are null.
    - "PTR-FULL" → 12-point full audit. Internals (TRIN/ADD/VOLD) are context only — never a hard gate. If internals data shows None or unavailable, mark that row as unavailable and continue. Never FAIL any gate purely because internals are null.
    - "PREMARKET" → 5-step morning plan
    - "TRADE IDEA" → 6-point analysis
    - "IN TRADE" → Real-time management
    - "TRADE REVIEW" → 4-dimension scorecard
    - "EOD" → End of day session review
    - "GRADE" → Single setup quality grade
    - "PATTERN CHECK" → Psychology audit
    - "MARKET REGIME" → Classify today's environment
    - "SETUP LIBRARY [name]" → Reference for any setup
    - "CAPITAL PROTECTION" → Emergency protocol
    - "BLUNT FEEDBACK" → Direct critique, zero softening
    - "WEEKLY REVIEW" → Full weekly summary
    - "WIRE OUT" → Calculate wire-out amount

    Always read the live context fully before responding to anything.
    Never give trade recommendations — only diagnosis, analysis, and coaching.

    MARKET INTERNALS RULE — applies to ALL commands (PTR-FAST, PTR-FULL, IN TRADE, TRADE IDEA, PREMARKET, EOD):
    - TRIN, ADD, VOLD, TICK are CONTEXT indicators — they inform the read, they NEVER block or fail a trade
    - Confirmed by Saty Mahajan (the system author): internals should not stop you from taking valid setups
    - If internals data is None or unavailable → display as "N/A — data unavailable" and continue the analysis
    - A valid A+ setup with null internals = still a valid A+ setup — do not downgrade
    - A valid A setup with null internals = still a valid A setup
    - Internals ADD conviction when present and aligned, but their ABSENCE is never a disqualifier
    - PTR-FAST Gate 2: show internals as informational context, not as a binary pass/fail gate
    - PTR-FULL Gate 4: show internals row by row as context, continue audit regardless of availability
    - IN TRADE: show internals snapshot if available, skip gracefully if null
    - When internals ARE available and misaligned with setup direction → note as caution flag, not a block
    - Example: GG Bear setup with TRIN 0.7 (bullish) → note "TRIN suggests buying pressure — trade with awareness" not "FAIL"

    TARGET LEVELS RULE — applies to IN TRADE, PTR-FULL, TRADE REVIEW:
    - T1 = GG Open level (first target, scale out 50%)
    - T2 = GG Complete level (second target, scale out remaining)
    - T3 = Full ATR level (full extension target, exit all)
    - When price approaches within 1pt of any target level → immediately flag it in the response
    - Example: "Price at 7429, Full ATR Call is 7430.62 — T3 approaching, consider full exit"
    - Always show distance to next target in points when IN TRADE command is run

    Human-in-the-loop always — you analyze, Satya decides."""


# Store per-session conversation history
# Key: session_id, Value: list of messages
sessions: dict[str, list[dict]] = {}


async def get_current_user(authorization: str = Header(...)) -> str:
    """Extract user_id from Clerk JWT. Never trusts request body for identity."""
    try:
        token = authorization.removeprefix("Bearer ").strip()
        payload = pyjwt.decode(token, options={"verify_signature": False}, algorithms=["RS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Unauthorized")


class ChatRequest(BaseModel):
    message: str
    session_id: str = "default"
    atr: Optional[float] = None


class RefreshRequest(BaseModel):
    session_id: str = "default"


@app.get("/health")
def health():
    return {"status": "ok", "context_loaded": len(LIVE_CONTEXT) > 0}


@app.get("/me")
def me():
    """Auth probe — confirms backend is reachable by an authenticated client."""
    return {"status": "authenticated"}


@app.get("/ping")
def ping():
    return {"status": "alive", "ts": datetime.now(timezone.utc).isoformat()}


_LIVE_DATA_COMMANDS = {
    "IN TRADE", "PTR-FAST", "PTR-FULL",
    "TRADE IDEA", "TRADE REVIEW", "EOD", "OPEN THE DESK",
}


@app.post("/chat")
async def chat(request: ChatRequest, user_id: str = Depends(get_current_user)):
    global LIVE_CONTEXT, FLOW_CONTEXT

    # Load session history: Supabase first, fallback to in-memory
    if _sb:
        try:
            row = _sb.table("user_sessions").select("history").eq("user_id", user_id).eq("session_id", request.session_id).maybe_single().execute()
            if row.data:
                sessions[request.session_id] = row.data["history"]
        except Exception as _e:
            print(f"[WARN] session load failed: {_e}")

    if request.session_id not in sessions:
        sessions[request.session_id] = []

    history = sessions[request.session_id]

    # ── Chat → Journal intent detection ─────────────────────────
    if not _is_command_message(request.message):
        if _detect_journal_intent(request.message):
            fields = _extract_journal_fields(request.message)
            if fields is None:
                journal_reply = "I couldn't parse that trade. Try: 'GG Bear entry 7390 exit 7378 1 contract'"
                return {"reply": journal_reply, "model": HAIKU,
                        "session_id": request.session_id, "turns": len(history) // 2}
            if "error" in fields:
                missing = ", ".join(fields.get("missing", []))
                journal_reply = f"Almost there — I need: {missing}. What were they?"
                return {"reply": journal_reply, "model": HAIKU,
                        "session_id": request.session_id, "turns": len(history) // 2}
            saved = _save_journal_entry(fields, user_id)
            pnl_str = f"+${saved['pnl']:,.0f}" if saved['pnl'] >= 0 else f"-${abs(saved['pnl']):,.0f}"
            trin = saved["internals"].get("trin")
            trin_str = f" · TRIN {trin}" if trin else ""
            journal_reply = (
                f"Logged ✓ {saved['setup']} {saved['direction'].title()} · "
                f"Entry {saved['entry_price']} · Exit {saved['exit_price']} · "
                f"{pnl_str}{trin_str}"
            )
            return {"reply": journal_reply, "model": HAIKU,
                    "session_id": request.session_id, "turns": len(history) // 2}
    # ── End journal intent block ─────────────────────────────────

    # Inject live market snapshot for trade-relevant commands
    live_injection = ""
    cmd = request.message.strip().upper().split("\n")[0]
    if any(cmd.startswith(k) for k in _LIVE_DATA_COMMANDS):
        try:
            mkt = get_market_summary()
            internals = get_market_internals()
            if not any([internals.get("trin"), internals.get("add"), internals.get("vold")]):
                internals = {k: INTERNALS_CACHE.get(
                    k) for k in ["trin", "add", "vold"]}
            spx = mkt.get("spx", {})
            vix = mkt.get("vix", {})
            atr = mkt.get("atr_levels", {})
            trin = internals.get("trin")
            add_val = internals.get("add")
            vold = internals.get("vold")
            level_map = [
                ("Full ATR ↑",    "full_atr_call"),
                ("GG Complete ↑", "gg_comp_call"),
                ("GG Open ↑",     "gg_open_call"),
                ("Call Trigger",  "call_trigger"),
                ("Put Trigger",   "put_trigger"),
                ("GG Open ↓",     "gg_open_put"),
                ("GG Complete ↓", "gg_comp_put"),
                ("Full ATR ↓",    "full_atr_put"),
            ]
            level_lines = "\n".join(
                f"  {label}: {atr.get(key, 'N/A'):.2f}"
                for label, key in level_map
                if atr.get(key)
            )
            live_injection = (
                f"\n\n[LIVE DATA @ {datetime.now(ZoneInfo('America/New_York')).strftime('%H:%M ET')}]"
                f"\nSPX: {spx.get('last') or spx.get('close')} | VIX: {vix.get('vix')}"
                f"\nPDC: {atr.get('PDC')} | ATR: {atr.get('ATR'):.1f}"
                f"\nATR Levels:\n{level_lines}"
                f"\nTRIN: {trin} | ADD: {add_val} | VOLD: {vold}"
            )
        except Exception:
            pass

    # Add user message (with live data appended if applicable)
    user_content = request.message + \
        live_injection if live_injection else request.message
    history.append({"role": "user", "content": user_content})

    model = route_model(request.message)
    prompt = build_system_prompt(LIVE_CONTEXT, FLOW_CONTEXT)

    # Long-form commands need more tokens
    _LONG_COMMANDS = {"PTR-FULL", "TRADE REVIEW", "EOD", "WEEKLY REVIEW",
                      "PREMARKET", "BLUNT FEEDBACK", "OPEN THE DESK"}
    cmd_upper = request.message.strip().upper().split("\n")[0]
    max_tok = 4096 if any(cmd_upper.startswith(c)
                          for c in _LONG_COMMANDS) else 2048

    response = with_retry(lambda: client.messages.create(
        model=model,
        max_tokens=max_tok,
        system=[{
            "type": "text",
            "text": prompt,
            "cache_control": {"type": "ephemeral"}
        }],
        messages=history,
    ))

    reply = response.content[0].text
    history.append({"role": "assistant", "content": reply})

    log_trace(
        request.message, model, request.session_id, "chat",
        response.usage.input_tokens, response.usage.output_tokens,
    )

    if _sb:
        try:
            _sb.table("user_sessions").upsert({
                "user_id": user_id,
                "session_id": request.session_id,
                "history": history,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="user_id,session_id").execute()
        except Exception as _e:
            print(f"[WARN] session save failed: {_e}")

    return {
        "reply": reply,
        "model": model,
        "session_id": request.session_id,
        "turns": len(history) // 2
    }


@app.post("/analyze-chart")
async def analyze_chart(
    files: list[UploadFile] = File(...),
    context: str = "TRADE IDEA",
    session_id: str = "default"
):
    global LIVE_CONTEXT

    if session_id not in sessions:
        sessions[session_id] = []
    history = sessions[session_id]

    model = route_model(context)
    prompt = build_system_prompt(LIVE_CONTEXT, FLOW_CONTEXT)

    content = []
    for f in files:
        image_data = await f.read()
        b64 = base64.standard_b64encode(image_data).decode("utf-8")
        mt = f.content_type or "image/jpeg"
        content.append({
            "type": "image",
            "source": {"type": "base64", "media_type": mt, "data": b64}
        })

    chart_count = len(files)
    if chart_count == 1:
        analysis_instruction = f"""{context}

                    Analyze this Saty Mahajan system chart carefully.

                    CRITICAL — Ribbon color reading rules:
                    The ribbon has TWO components — read them separately:
                    1. The CLOUD/BANDS (the filled area behind candles) — this is the ribbon color
                    2. The CANDLE color — gray/white candles can appear INSIDE a green ribbon during compression

                    Green/teal/blue cloud = GREEN ribbon = calls eligible
                    Red/orange cloud = RED ribbon = puts eligible
                    White/thin/nearly invisible cloud = WHITE ribbon = chop, no trade

                    Do NOT confuse gray compression candles with red ribbon.
                    The cloud color behind the candles determines the ribbon state.

                    Then analyze in order:
                    1. Ribbon cloud color (not candle color)
                    2. ATR levels from chart overlay
                    3. Internals panel — TRIN, VOLD, ADD, TICK, VIX, PCC
                    4. Phase Oscillator state
                    5. Setup structure and final verdict"""
    else:
        analysis_instruction = f"""Analyze these {chart_count} charts as a MULTI-TIMEFRAME analysis.

                    For each chart identify: timeframe, ribbon state (cloud color not candle),
                    ATR level proximity, Phase Oscillator zone, volume character.

                    Then give a unified read:
                    - Higher timeframe bias (trend direction)
                    - Lower timeframe entry trigger (what to wait for)
                    - Confluence: do all timeframes agree?
                    - Trade bias: BULL / BEAR / NO TRADE
                    - Key levels to watch

                    Context: {context}"""

    content.append({"type": "text", "text": analysis_instruction})

    user_message = {
        "role": "user",
        "content": content,
    }

    history.append(user_message)

    _session_id = session_id

    def stream():
        full_reply = ""
        for attempt in range(3):
            try:
                with stream_client.messages.stream(
                    model=model,
                    max_tokens=2048,
                    system=[{
                        "type": "text",
                        "text": prompt,
                        "cache_control": {"type": "ephemeral"}
                    }],
                    messages=history,
                ) as s:
                    for text in s.text_stream:
                        full_reply += text
                        yield text
                    try:
                        _usage = s.get_final_message().usage
                        log_trace(context, model, _session_id, "analyze-chart",
                                  _usage.input_tokens, _usage.output_tokens)
                    except Exception:
                        pass
                break
            except (anthropic.OverloadedError, anthropic.APIStatusError) as e:
                if isinstance(e, anthropic.APIStatusError) and e.status_code != 529:
                    raise
                if attempt == 2:
                    raise
                full_reply = ""
                time.sleep(2 ** attempt)

        history[-1] = {"role": "user", "content": f"[Chart] {context}"}
        history.append({"role": "assistant", "content": full_reply})

    return FastAPIStreaming(stream(), media_type="text/plain")


@app.get("/market-data")
async def market_data(atr: float = None, trading_mode: str = "day"):
    """Get live SPX + VIX + ATR levels + 0DTE options chain + unusual flow."""
    global FLOW_CONTEXT
    summary = get_market_summary(atr_override=atr, trading_mode=trading_mode)
    snapshot = get_0dte_snapshot(atr=atr)
    summary["options"] = snapshot
    summary["options_context"] = format_options_context(snapshot)
    summary["unusual_flow"] = snapshot.get(
        "unusual_flow", {"calls": [], "puts": []})
    summary["flow_context"] = snapshot.get("flow_context", "")
    # Cache flow context so /chat can inject it without a fresh API call
    FLOW_CONTEXT = summary["flow_context"]
    return summary


@app.post("/premarket")
async def premarket(request: ChatRequest):
    """Run PREMARKET with live market data injected."""
    global LIVE_CONTEXT

    # Fetch live data
    market = get_market_summary(atr_override=request.atr)

    # Build market context string
    spx = market.get("spx", {})
    vix = market.get("vix", {})
    levels = market.get("atr_levels", {})

    # Fetch live options data (includes unusual flow)
    snapshot = get_0dte_snapshot(atr=request.atr)
    options_text = format_options_context(snapshot)
    fresh_flow = snapshot.get("flow_context", "")

    flow_block = ""
    if fresh_flow:
        flow_block = f"\n    {fresh_flow}\n"

    market_context = f"""
    LIVE MARKET DATA (auto-fetched at {__import__('datetime').datetime.now().strftime('%H:%M ET')}):
    SPX Last: {spx.get('last')} | PDC: {spx.get('pdc')} | Today H: {spx.get('high')} | Today L: {spx.get('low')}
    VIX: {vix.get('vix')} | VIX High: {vix.get('vix_high')} | VIX Low: {vix.get('vix_low')}

    ATR LEVELS — PDC {levels.get('PDC')} | ATR {levels.get('ATR')} pts ({market.get('atr_source', 'approx')}):
    +100% Full ATR:      {levels.get('full_atr_call')}
    +61.8% GG Complete:  {levels.get('gg_complete_call')}
    +50.0% Mid:          {levels.get('gg_50_call')}
    +38.2% GG Open:      {levels.get('gg_open_call')}
    +23.6% Call Trigger: {levels.get('call_trigger')}
    PDC Pivot:           {levels.get('PDC')}
    -23.6% Put Trigger:  {levels.get('put_trigger')}
    -38.2% GG Open:      {levels.get('gg_open_put')}
    -50.0% Mid:          {levels.get('gg_50_put')}
    -61.8% GG Complete:  {levels.get('gg_complete_put')}
    -100% Full ATR:      {levels.get('full_atr_put')}

    {options_text}{flow_block}
    """

    # Add to session history
    session_id = request.session_id
    if session_id not in sessions:
        sessions[session_id] = []

    history = sessions[session_id]
    history.append({
        "role": "user",
        "content": f"PREMARKET\n\n{market_context}\n\nRun the full 5-step pre-market plan for today."
    })

    _session_id = session_id
    _model = SONNET

    # Stream response — fresh_flow already injected into the user message
    def stream():
        full_reply = ""
        for attempt in range(3):
            try:
                with stream_client.messages.stream(
                    model=_model,
                    max_tokens=2048,
                    system=[{
                        "type": "text",
                        "text": build_system_prompt(LIVE_CONTEXT),
                        "cache_control": {"type": "ephemeral"}
                    }],
                    messages=history,
                ) as s:
                    for text in s.text_stream:
                        full_reply += text
                        yield text
                    try:
                        _usage = s.get_final_message().usage
                        log_trace("PREMARKET", _model, _session_id, "premarket",
                                  _usage.input_tokens, _usage.output_tokens)
                    except Exception:
                        pass
                break
            except (anthropic.OverloadedError, anthropic.APIStatusError) as e:
                if isinstance(e, anthropic.APIStatusError) and e.status_code != 529:
                    raise
                if attempt == 2:
                    raise
                full_reply = ""
                time.sleep(2 ** attempt)

        history.append({"role": "assistant", "content": full_reply})

    return FastAPIStreaming(stream(), media_type="text/plain")


async def _fetch_market_news() -> dict:
    """Fetch economic calendar + gap movers + catalyst news via Claude web search."""
    today = datetime.now(ZoneInfo("America/New_York")).strftime("%B %d %Y")

    results = {"economic_calendar": "", "gap_movers": "", "catalyst_news": ""}

    async def _search(query: str) -> str:
        try:
            r = await asyncio.to_thread(lambda: client.messages.create(
                model=HAIKU,
                max_tokens=512,
                tools=[{"type": "web_search_20250305", "name": "web_search"}],
                messages=[{"role": "user", "content": query}],
            ))
            text_parts = []
            for block in r.content:
                if hasattr(block, "type") and block.type == "text":
                    text_parts.append(block.text)
            return "\n".join(text_parts)
        except Exception as e:
            print(f"[WARN] news fetch failed: {e}")
            return ""

    cal, movers, news = await asyncio.gather(
        _search(
            f"economic calendar today {today} high impact USD events "
            f"time ET forecast previous — list only HIGH and MEDIUM impact"
        ),
        _search(
            f"premarket gap ups gap downs stocks today {today} "
            f"biggest movers percentage change reason"
        ),
        _search(
            f"stock market catalyst news today {today} "
            f"earnings reactions Fed speakers macro events SPX"
        ),
    )

    results["economic_calendar"] = cal
    results["gap_movers"] = movers
    results["catalyst_news"] = news
    return results


@app.post("/morning-brief")
async def morning_brief(request: ChatRequest, _user_id: str = Depends(get_current_user)):
    """Generate a structured morning brief using live market + MAG7 watchlist data."""

    async def _fetch_market():
        return await asyncio.to_thread(get_market_summary, request.atr)

    async def _fetch_watchlist():
        from analyzer import get_watchlist_data
        _eligible = {"NVDA", "TSLA", "META", "AMZN", "AAPL", "MSFT", "GOOGL", "QQQ", "SPY"}
        tickers = ["NVDA", "TSLA", "META", "AMZN", "AAPL", "MSFT", "GOOGL", "SPY", "QQQ"]
        results = await asyncio.gather(
            *[asyncio.to_thread(get_watchlist_data, t, _eligible) for t in tickers]
        )
        return results

    market, watchlist_results, news_data = await asyncio.gather(
        _fetch_market(), _fetch_watchlist(), _fetch_market_news()
    )

    spx   = market.get("spx", {})
    vix   = market.get("vix", {})
    atr_l = market.get("atr_levels", {})
    trin  = INTERNALS_CACHE.get("trin")
    add_v = INTERNALS_CACHE.get("add")
    vold  = INTERNALS_CACHE.get("vold")
    pcc   = INTERNALS_CACHE.get("pcc")

    watch_lines = []
    spy_state = "N/A"
    qqq_state = "N/A"
    for r in watchlist_results:
        t      = r.get("ticker", "")
        ribbon = r.get("ribbon_state", "MIXED")
        comp   = "●" if r.get("compression") else " "
        chg    = f"{r.get('change_pct', 0):+.2f}%" if r.get("change_pct") is not None else "N/A"
        po     = r.get("po_value") or 0
        po_zone = ("accumulation" if po < -61.8 else
                   "distribution" if po > 61.8 else
                   "neutral")
        if t == "SPY":
            spy_state = ribbon
        elif t == "QQQ":
            qqq_state = ribbon
        else:
            watch_lines.append(
                f"{t:<6} {ribbon:<8} {comp}  {chg:<8} PO:{po:.0f} ({po_zone})"
            )

    now_et = datetime.now(ZoneInfo("America/New_York"))

    context = f"""MORNING BRIEF DATA — {now_et.strftime('%A %B %d, %Y %H:%M ET')}

SPX MARKET DATA:
  Current: {spx.get('last') or spx.get('close')}
  PDC:     {atr_l.get('PDC')}
  VIX:     {vix.get('vix')} (High: {vix.get('vix_high')}  Low: {vix.get('vix_low')})
  ATR:     {atr_l.get('ATR')} pts

SPX ATR LEVELS:
  Call Trigger (0.236): {atr_l.get('call_trigger')}
  Put Trigger  (0.236): {atr_l.get('put_trigger')}
  GG Open Call (0.382): {atr_l.get('gg_open_call')}
  GG Open Put  (0.382): {atr_l.get('gg_open_put')}

MARKET INTERNALS:
  TRIN: {trin or 'N/A'}
  ADD:  {add_v or 'N/A'}
  VOLD: {vold or 'N/A'}
  PCC:  {pcc or 'N/A'}

SPY ribbon: {spy_state}
QQQ ribbon: {qqq_state}

MAG 7 + CONTEXT:
{chr(10).join(watch_lines)}
"""

    all_empty = not any([news_data["economic_calendar"], news_data["gap_movers"], news_data["catalyst_news"]])
    if all_empty:
        news_block = "\n─────────────────────────────────────────\nNEWS DATA: unavailable — proceeding with market data only\n─────────────────────────────────────────\n"
    else:
        news_block = f"""
─────────────────────────────────────────
MARKET NEWS CONTEXT (web search results)
─────────────────────────────────────────

ECONOMIC CALENDAR TODAY:
{news_data['economic_calendar'] or 'unavailable'}

PRE-MARKET MOVERS (Gap Ups/Downs):
{news_data['gap_movers'] or 'unavailable'}

CATALYST NEWS:
{news_data['catalyst_news'] or 'unavailable'}
─────────────────────────────────────────
"""
    context += news_block

    def _run() -> str:
        r = with_retry(lambda: client.messages.create(
            model=SONNET,
            max_tokens=2048,
            system=_MORNING_BRIEF_SYSTEM,
            messages=[{"role": "user", "content": context}],
        ))
        return r.content[0].text

    brief = await asyncio.to_thread(_run)
    return {"morning_brief": brief, "generated_at": now_et.isoformat()}


@app.post("/refresh-context")
async def refresh_context(request: RefreshRequest, user_id: str = Depends(get_current_user)):
    """Fetch fresh context from Google Doc and clear session."""
    global LIVE_CONTEXT
    LIVE_CONTEXT = fetch_live_context()
    sessions.pop(request.session_id, None)
    if _sb:
        try:
            _sb.table("user_sessions").delete().eq("user_id", user_id).eq("session_id", request.session_id).execute()
        except Exception as _e:
            print(f"[WARN] session delete failed: {_e}")
    return {"status": "refreshed", "chars": len(LIVE_CONTEXT)}


@app.delete("/session/{session_id}")
async def clear_session(session_id: str, user_id: str = Depends(get_current_user)):
    """Clear conversation history for a session."""
    sessions.pop(session_id, None)
    if _sb:
        try:
            _sb.table("user_sessions").delete().eq("user_id", user_id).eq("session_id", session_id).execute()
        except Exception as _e:
            print(f"[WARN] session delete failed: {_e}")
    return {"cleared": session_id}


# ── Analyzer endpoints ───────────────────────────────────────────────────────

_SHORT_TERM_SYSTEM = """You will receive REAL options chain data with actual strikes, expiry dates, and premiums from Tradier.
CRITICAL RULES:
- ONLY use the exact strikes and expiry dates provided in the options data. Never invent or approximate a date or strike.
- If the call contract mid premium is within $1.50–$4.00 (in_budget=True), recommend the naked call.
- If in_budget=False (premium too high), recommend the debit call spread instead and state the net debit.
- If IV environment is HIGH or EXTREME, always recommend the spread, never the naked option.
- State the exact dollar cost to buy 1 contract (mid × 100) in your response.
- State the exact theta decay per day in dollars (theta × 100).

You are a short-to-medium term options trade analyzer using the Saty Mahajan system.

You will receive ticker data for a specific trading mode (day/multiday/swing/position) with the corresponding ATR timeframe already calculated.

Additional Saty system context you must use:
- RIBBON uses EMA 8/21/34. BULLISH = 8>21>34. BEARISH = 8<21<34.
- CONVICTION confirmed when EMA 13 crosses EMA 48 (conviction_state field).
- CANDLE BIAS = price vs EMA 48 (candle_bias field).
- PHASE OSCILLATOR (po_value) ranges: Extreme Up >100, Distribution 61.8–100, Neutral Up 23.6–61.8, Neutral -23.6–23.6, Neutral Down -61.8–-23.6, Accumulation -100–-61.8, Extreme Down <-100.
- COMPRESSION (compression field) = Bollinger Bands inside 2×ATR band = coiling for breakout.
- ATR LEVELS include extensions to 3.0×ATR for strong trending moves.

Output EXACTLY this structure:

STOCK VERDICT
─────────────
BIAS: BULLISH / BEARISH / NEUTRAL
RIBBON: state (8>21>34 or not) + conviction state (13/48 cross)
CANDLE BIAS: above or below 48 EMA — what it means
PHASE: po_zone value + po_value number + what phase means for this setup
COMPRESSION: YES/NO — if YES, breakout imminent, wait for direction
POSITION IN RANGE: price vs 52-week high/low
VOLUME: relative volume read
VERDICT: BUY SETUP / WAIT FOR PULLBACK / AVOID / COMPRESSION COIL — one sentence

OPTIONS TRADE PLAN
───────────────────
TRADING MODE: [Day/Multiday/Swing/Position] — state the timeframe being analyzed
DIRECTION: CALL / PUT / NO TRADE
EXPIRY TARGET: match to trading mode (Day=1-2wk, Multiday=3-4wk, Swing=6-8wk, Position=3-6mo)
STRIKE: 0.5×ATR OTM from entry trigger, specific price
BUDGET: $2–3 premium target (use debit spread if IV rank >60)
ENTRY TRIGGER: exact ATR level (use the extended levels if in a strong trend)
TARGET 1: next ATR fibonacci level (take 50% off)
TARGET 2: next extended ATR level (let runner go)
STOP LOSS: opposite ATR trigger — specific price
RISK/REWARD: calculate and state
HOLD RULES: 3 bullets — when to hold, when to exit early, earnings rule
IV + COMPRESSION NOTE: cheap/fair/expensive + compression context

NO TRADE if: compression active with no direction, PO in extreme zone with no reversal signal, within 7 days of earnings."""

_LONG_TERM_SYSTEM = """You are a long-term stock analyst (3–12 month horizon) using the Saty Mahajan system combined with fundamental analysis.

Given ticker data including price, EMAs, ATR levels, 52-week positioning, PE, EPS growth, revenue growth, debt/equity, beta, and short interest, output EXACTLY this structure:

LONG-TERM VERDICT
─────────────────
VERDICT: STRONG BUY / BUY / HOLD / SELL / AVOID
CONVICTION: HIGH / MEDIUM / LOW — one sentence why

TECHNICAL PICTURE
─────────────────
RIBBON: state (BULLISH/BEARISH/MIXED) and trend maturity (early/mid/extended)
ATH CONTEXT: price vs 52-week high — if within 5% of ATH flag as "extended, wait for base" — if >20% below ATH assess if structural breakdown or opportunity
200 EMA: above/below and % distance — flag if >20% above as overextended
TREND INVALIDATION: exact price level where long-term thesis breaks (full ATR down or 200 EMA loss)
PHASE OSCILLATOR: state po_zone and po_value — is this stock in accumulation (buy more), distribution (take profits), or neutral?
COMPRESSION: if True — note this as a high-probability breakout setup pending direction
CONVICTION: state 13/48 EMA conviction — confirmed bullish/bearish or not yet crossed?

FUNDAMENTAL PICTURE
───────────────────
VALUATION: PE in context of sector and EPS growth — is it justified, expensive, or cheap
GROWTH: EPS growth + revenue growth trend — accelerating, decelerating, or flat
BALANCE SHEET: debt/equity comment — is leverage a risk at this stage
SHORT INTEREST: flag if >10% — potential squeeze fuel or sign of fundamental concern

PRICE TARGETS (12 months)
──────────────────────────
BASE CASE: price target with reasoning (use ATR projection × timeframe or analyst consensus context)
BULL CASE: upside scenario and trigger
BEAR CASE: downside scenario and invalidation level

ACTION PLAN
───────────
NOW: what to do today — buy / add / hold / reduce / avoid
ENTRY ZONE: specific price range to build a position (ATR trigger or EMA retest)
ADD ZONE: where to add if it pulls back further
FULL EXIT: level where you sell everything (thesis broken)

EARNINGS NOTE: flag upcoming earnings and how to manage around it (reduce size, avoid entry within 2 weeks, etc.)

Be direct. No hedging. If it's at all-time highs with a stretched valuation, say WAIT. If it's a strong setup, say BUY and give the exact zone."""

_QUICK_READ_SYSTEM = """You are a 0DTE options desk assistant for the Saty Mahajan system.
Given real market data, produce a fast pre-trade brief.

Output EXACTLY this format — no extra text, no markdown headers with #:

BIAS: [BULL / BEAR / WAIT] — one sentence why

BULL ABOVE: $[call_trigger]  ([label e.g. Call Trigger])
  Entry: [nearest round strike]C @ est $[premium 1-4]
  T1: $[gg_open_call] (GG Open) → +[pts]pts
  T2: $[next level above] (GG Complete)
  Stop: Below $[call_trigger]

BEAR BELOW: $[put_trigger]  ([label e.g. Put Trigger])
  Entry: [nearest round strike]P @ est $[premium 1-4]
  T1: $[gg_open_put] (GG Open) → +[pts]pts
  T2: $[next level below] (GG Complete)
  Stop: Above $[put_trigger]

IV NOTE: [one line — use compression and PO context to assess IV environment]
PREMIUM: $[range] per contract — [naked / spread recommended]

Rules:
- Strike = nearest $1 increment to trigger level for stocks, $5 for ETFs
- Premium estimate: ATR-based — for stocks use ATR × 0.15 to 0.25 as rough estimate
- If compression=true → note breakout imminent, direction unclear until trigger breaks
- If po_value < -61.8 → accumulation zone, calls riskier
- If po_value > 61.8 → distribution zone, puts riskier
- WAIT bias only if ribbon=MIXED and compression=true
- Be direct. No padding. Traders read this in 10 seconds."""

_MORNING_BRIEF_SYSTEM = """You are the OpenTheDesk morning intelligence engine.
You receive live market data and news search results every morning.
Produce a complete morning brief in this exact format.

Output EXACTLY this structure — use the emoji headers as shown:

📈 MARKET TONE
[2-3 sentences on overall market mood. Use SPX gap vs PDC,
VIX level, Mag7 alignment, and any major overnight news.
Be specific — mention actual price levels and percentages.]

📊 MORNING BIAS
[What to watch today. Key setup conditions. Any macro events
that change the trading approach. One paragraph, direct.]

📈 GAP UPS (from news data — top 5 most relevant to SPX/tech)
$TICKER +X% — one line reason
[If no data: "No significant gap ups found"]

📉 GAP DOWNS (from news data — top 5 most relevant)
$TICKER -X% — one line reason
[If no data: "No significant gap downs found"]

📅 US ECONOMIC CALENDAR
[List only HIGH and MEDIUM impact events with time ET]
HH:MM ET [HIGH] Event Name · Prior: X | Forecast: Y
[If none: "No high-impact events scheduled today"]

⚠️ VOLATILITY FLAGS
[List any events that change 0DTE risk posture:]
- FOMC today → EXTREME risk, no 0DTE
- CPI/PPI/NFP today → HIGH risk, wait 15 min post-release
- Fed speaker → MODERATE, size down
- NFP tomorrow → elevated IV today
- Earnings in Mag7 today/AH → note for context
[If none: "No major volatility events today"]

🔥 CATALYST NEWS
[3-5 bullet points of market-moving news relevant to trading]
- [catalyst]
- [catalyst]

─────────────────────────────────────────────────────────
MARKET BIAS: [BULLISH / BEARISH / MIXED / NO TRADE]
Conviction: [HIGH / MEDIUM / LOW] — [one sentence]

SIGNAL SCORECARD:
SPX vs PDC:  [BULL/BEAR] — [price vs PDC]
VIX:         [BULL/BEAR] — [value]
TRIN:        [BULL/BEAR/N/A] — [value]
ADD:         [BULL/BEAR/N/A] — [value]
SPY ribbon:  [BULL/BEAR/MIXED]
QQQ ribbon:  [BULL/BEAR/MIXED]
BULL signals: X | BEAR signals: Y

─────────────────────────────────────────────────────────
MAG 7 ALIGNMENT
NVDA  [ribbon]  [● if compression]  [chg%]  [note]
TSLA  ...
META  ...
AMZN  ...
AAPL  ...
MSFT  ...
GOOGL ...
Alignment: X/7 BULL, Y/7 BEAR, Z/7 MIXED

─────────────────────────────────────────────────────────
TODAY'S PLAN
PRIMARY INSTRUMENT: [SPX 0DTE / ticker / NO TRADE]
Reason: [one sentence]

DIRECTION: [CALLS on reclaim / PUTS on breakdown / WAIT / NO TRADE]

SPX KEY LEVELS:
  Bull above: $[call_trigger] (Call Trigger)
  Bear below: $[put_trigger] (Put Trigger)
  No trade zone: $[put_trigger] – $[call_trigger]

SESSION RULES:
  • Morning window only: 9:40–11:00 ET
  • Max 2 trades | Max loss $150
  • Grade A/A+ only
  • No trades after 12pm ET
  [Add any event-specific rules, e.g. "No trades before 8:45 ET — Jobless Claims"]

RISK LEVEL: [LOW / MODERATE / HIGH / EXTREME]
Reason: [one sentence]
─────────────────────────────────────────────────────────

Scoring rules:
BULL signals: SPX > PDC, VIX < 18, TRIN < 0.8, ADD > +200, SPY BULLISH, QQQ BULLISH
BEAR signals: SPX < PDC, VIX > 22, TRIN > 1.2, ADD < -200, SPY BEARISH, QQQ BEARISH
MIXED counts as neither.

BIAS:
- 5-6 BULL → BULLISH HIGH
- 4 BULL → BULLISH MEDIUM
- 3/3 split → MIXED
- 4 BEAR → BEARISH MEDIUM
- 5-6 BEAR → BEARISH HIGH
- VIX > 35 or all mixed → NO TRADE

PRIMARY INSTRUMENT:
- SPX 0DTE when: bias clear + VIX 15-28
- Mag7 when: individual ticker A+ setup + SPX bias confirms
- NO TRADE when: VIX > 35, divergence day, or <3 clear signals

HARD RULES — always apply these regardless of other signals:
- If FOMC rate decision is today → RISK: EXTREME, recommend NO 0DTE trades
- If CPI, PPI, PCE, or NFP is today → RISK: HIGH minimum,
  add "No trades before [release time + 15 min]" to session rules
- If NFP is tomorrow (Friday) → note elevated IV today, size down
- If a Mag7 name has earnings today → note in Mag7 Watch
- If VIX > 30 → RISK: HIGH minimum regardless of other signals
- If VIX > 40 → RISK: EXTREME, recommend NO 0DTE trades
- Internals N/A is acceptable — never fail the brief because of missing data
- If news data says "unavailable" → skip that section gracefully

Be direct. No padding. This is read in 60 seconds before market open."""


def _fmt_options_context(oc: dict | None) -> str:
    """Format real options chain dict into a structured string for Haiku."""
    if not oc:
        return "OPTIONS DATA: no options data available"

    tc = oc.get("target_call") or {}
    tp = oc.get("target_put") or {}
    cs = oc.get("call_spread") or {}
    ps = oc.get("put_spread") or {}

    lines = [
        f"OPTIONS DATA — Expiry: {oc.get('expiry')} ({oc.get('days_to_expiry')} DTE) | IV Environment: {oc.get('iv_environment')}",
        "",
        f"TARGET CALL  Strike: {tc.get('strike')}  Mid: ${tc.get('mid')}  Delta: {tc.get('delta')}  Theta: {tc.get('theta')}  IV: {tc.get('implied_volatility')}  in_budget: {tc.get('in_budget')}",
        f"TARGET PUT   Strike: {tp.get('strike')}  Mid: ${tp.get('mid')}  Delta: {tp.get('delta')}  Theta: {tp.get('theta')}  IV: {tp.get('implied_volatility')}  in_budget: {tp.get('in_budget')}",
        "",
        f"CALL SPREAD  Long: {cs.get('long_strike')} @ ${cs.get('long_mid')}  /  Short: {cs.get('short_strike')} @ ${cs.get('short_mid')}  Net Debit: ${cs.get('spread_cost')}  Max Profit: ${cs.get('spread_max_profit')}",
        f"PUT SPREAD   Long: {ps.get('long_strike')} @ ${ps.get('long_mid')}  /  Short: {ps.get('short_strike')} @ ${ps.get('short_mid')}  Net Debit: ${ps.get('spread_cost')}  Max Profit: ${ps.get('spread_max_profit')}",
    ]
    return "\n".join(lines)


_US_WATCHLIST = ["AAPL", "NVDA", "TSLA", "MSFT",
                 "AMZN", "META", "GOOGL", "AMD", "SPY", "QQQ"]
_IN_WATCHLIST = ["RELIANCE.NS", "INFY.NS",
                 "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS"]

_ZERO_DTE_ELIGIBLE = {
    "NVDA", "TSLA", "META", "AMZN", "AAPL", "MSFT", "GOOGL",
    "QQQ", "SPY", "XLK", "XLF", "SMH",
}
_MAG7               = ["NVDA", "TSLA", "META", "AMZN", "AAPL", "MSFT", "GOOGL"]
_CONTEXT_INSTRUMENTS = ["QQQ", "SPY", "XLK", "XLF", "SMH"]


class AnalyzeRequest(BaseModel):
    ticker: str
    trading_mode: str = "day"   # day | multiday | swing | position


class QuickAnalyzeRequest(BaseModel):
    ticker: str
    price: float
    ribbon_state: str
    compression: bool
    po_value: float
    call_trigger: float
    put_trigger: float
    gg_open_call: float
    gg_open_put: float
    atr_14: float
    change_pct: float


@app.post("/analyze")
async def analyze(request: AnalyzeRequest):
    """Fetch ticker data then run Haiku (short-term) and Sonnet (long-term) in parallel."""
    data = await asyncio.to_thread(get_ticker_analysis, request.ticker, request.trading_mode)
    ctx = json.dumps(data, indent=2, default=str)

    options_chain = data.get("options_chain")
    options_context = _fmt_options_context(options_chain)

    def _haiku() -> str:
        r = with_retry(lambda: client.messages.create(
            model=HAIKU,
            max_tokens=2048,
            system=_SHORT_TERM_SYSTEM,
            messages=[
                {"role": "user", "content": f"Market Data:\n{ctx}\n\n{options_context}"}],
        ))
        return r.content[0].text

    def _sonnet() -> str:
        r = with_retry(lambda: client.messages.create(
            model=SONNET,
            max_tokens=1536,
            system=_LONG_TERM_SYSTEM,
            messages=[{"role": "user", "content": f"Analyze:\n{ctx}"}],
        ))
        return r.content[0].text

    short_term, long_term = await asyncio.gather(
        asyncio.to_thread(_haiku),
        asyncio.to_thread(_sonnet),
    )

    return {
        "ticker":      data["ticker"],
        "market_data": data,
        "short_term":  short_term,
        "long_term":   long_term,
    }


@app.post("/quick-analyze")
async def quick_analyze(request: QuickAnalyzeRequest):
    """Fast 0DTE pre-trade brief via Haiku — no yfinance call, uses watchlist data."""
    prompt = (
        f"Ticker: {request.ticker}\n"
        f"Price: ${request.price}\n"
        f"Change: {request.change_pct:+.2f}%\n"
        f"Ribbon: {request.ribbon_state}\n"
        f"Compression: {request.compression}\n"
        f"Phase Oscillator: {request.po_value:.1f}\n"
        f"Call Trigger (0.236 ATR): ${request.call_trigger:.2f}\n"
        f"Put Trigger (0.236 ATR): ${request.put_trigger:.2f}\n"
        f"GG Open Call (0.382 ATR): ${request.gg_open_call:.2f}\n"
        f"GG Open Put (0.382 ATR): ${request.gg_open_put:.2f}\n"
        f"ATR-14: {request.atr_14:.2f}\n\n"
        f"Generate the quick read brief."
    )

    def _run() -> str:
        r = with_retry(lambda: client.messages.create(
            model=HAIKU,
            max_tokens=512,
            system=_QUICK_READ_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        ))
        return r.content[0].text

    text = await asyncio.to_thread(_run)
    return {"ticker": request.ticker, "quick_read": text}


@app.get("/screener")
async def screener():
    """Run get_ticker_analysis on the full watchlist in parallel, filter non-MIXED."""
    all_tickers = _US_WATCHLIST + _IN_WATCHLIST
    results = await asyncio.gather(
        *[asyncio.to_thread(get_ticker_analysis, t) for t in all_tickers]
    )

    us_setups: list[dict] = []
    in_setups: list[dict] = []

    for r in results:
        if r.get("ribbon_state") not in ("BULLISH", "BEARISH"):
            continue
        row = {
            "ticker":       r["ticker"],
            "ribbon_state": r["ribbon_state"],
            "price":        r["price"],
            "change_pct":   r["change_pct"],
            "atr_14":       r["atr_14"],
            "sector":       r["sector"],
        }
        if r["market"] == "US":
            us_setups.append(row)
        else:
            in_setups.append(row)

    def _key(x): return abs(x.get("change_pct") or 0)
    us_setups.sort(key=_key, reverse=True)
    in_setups.sort(key=_key, reverse=True)

    return {
        "us_setups":    us_setups,
        "india_setups": in_setups,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/watchlist")
async def watchlist():
    """Ribbon state + ATR levels + eligibility for Mag7 and context instruments."""
    all_tickers = _MAG7 + _CONTEXT_INSTRUMENTS
    results = await asyncio.gather(
        *[asyncio.to_thread(get_watchlist_data, t, _ZERO_DTE_ELIGIBLE)
          for t in all_tickers]
    )

    def _sort_key(r: dict) -> tuple:
        order = {"BULLISH": 0, "BEARISH": 1, "MIXED": 2}
        return (order.get(r.get("ribbon_state", "MIXED"), 2), -abs(r.get("change_pct") or 0))

    mag7_results     = sorted([r for r in results if r["ticker"] in _MAG7], key=_sort_key)
    context_results  = sorted([r for r in results if r["ticker"] in _CONTEXT_INSTRUMENTS], key=_sort_key)

    return {
        "mag7":         mag7_results,
        "context":      context_results,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


# ── TradingView webhook ──────────────────────────────────────────────────────

async def _handle_internals(data: dict) -> dict:
    """Handle OTD Internals Heartbeat payload — updates INTERNALS_CACHE only."""
    global INTERNALS_CACHE

    def _sf(v):
        try:
            return round(float(v), 4) if v is not None else None
        except (ValueError, TypeError):
            return None

    bias_raw = data.get("bias")
    INTERNALS_CACHE = {
        "type":        "internals",
        "signal":      "INTERNALS",
        "ticker":      data.get("ticker", "SPX"),
        "timeframe":   data.get("timeframe", "3"),
        "trin":        _sf(data.get("trin")),
        "add":         _sf(data.get("add")),
        "vold":        _sf(data.get("vold")),
        "pcc":         _sf(data.get("pcc")),
        "bias":        bias_raw.strip().upper() if bias_raw else None,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "source":      "tradingview",
    }

    # internals_event = {"type": "internals", "data": INTERNALS_CACHE}
    # for q in set(ALERT_SUBSCRIBERS):
    #     q.put_nowait(internals_event)

    return {"status": "ok", "cached": INTERNALS_CACHE}


async def _handle_trade_alert(data: dict) -> dict:
    """Handle Manual Planner v3.3.2 and ATR Clean backup alerts.

    Pine Script computes entry/t1/t2/t3/sl/trail_sl — use directly, no recalc.
    """
    def _sf(v):
        try:
            return float(v) if v is not None else None
        except (ValueError, TypeError):
            return None

    signal = (data.get("signal") or "").upper()
    direction = (data.get("direction") or "").upper()
    setup = data.get("setup", "")
    condition_str = (data.get("condition") or "").upper()

    # display_type: consumed by frontend for card accent/border color
    if signal in ("EXIT", "STOP") or "REVERSAL" in condition_str:
        display_type = "stop"
    elif signal == "ENTRY":
        display_type = "entry"
    elif signal in ("TRAIL", "TARGET"):
        display_type = "update"
    else:
        display_type = None

    internals_snapshot = None
    internals_age = None
    if INTERNALS_CACHE.get("received_at"):
        internals_snapshot = INTERNALS_CACHE.copy()
        try:
            received = datetime.fromisoformat(INTERNALS_CACHE["received_at"])
            internals_age = round(
                (datetime.now(timezone.utc) - received).total_seconds()
            )
        except Exception:
            pass

    alert = {
        "id":                    str(uuid.uuid4()),
        "ts":                    datetime.now(timezone.utc).isoformat(),
        "ticker":                data.get("ticker"),
        "timeframe":             data.get("timeframe"),
        "condition":             data.get("condition"),
        "price":                 data.get("price"),
        "signal":                signal,
        "display_type":          display_type,
        "setup":                 setup,
        "grade":                 data.get("grade"),
        "direction":             direction,
        "atr_level":             data.get("atr_level"),
        "entry":                 _sf(data.get("entry")),
        "t1":                    _sf(data.get("t1")),
        "t2":                    _sf(data.get("t2")),
        "t3":                    _sf(data.get("t3")),
        "sl":                    _sf(data.get("sl")),
        "trail_sl":              _sf(data.get("trail_sl")),
        "internals":             internals_snapshot,
        "internals_age_seconds": internals_age,
    }

    is_atr_backup = setup in ("ATR_TARGET", "ATR_STOP")

    if signal == "ENTRY" and direction in ("BULL", "BEAR") and not is_atr_backup:
        entry = alert["entry"] or _sf(data.get("price"))
        t1 = alert["t1"]
        t2 = alert["t2"]
        t3 = alert["t3"]
        sl = alert["sl"]

        if entry and t1:
            def _pts(target):
                return round(abs(target - entry), 2) if target is not None else None

            alert["trade_plan"] = {
                "entry":    entry,
                "direction": direction,
                "t1":       t1,       "t1_pts":   _pts(t1),  "t1_label": "GG Open — Scale 50%",
                "t2":       t2,       "t2_pts":   _pts(t2),  "t2_label": "GG Complete — Scale 25%",
                "t3":       t3,       "t3_pts":   _pts(t3),  "t3_label": "Full Extension — Exit All",
                "sl":       sl,       "sl_pts":   _pts(sl),
                "trail_sl": alert["trail_sl"],
            }

    TV_ALERTS.insert(0, alert)
    if len(TV_ALERTS) > 50:
        TV_ALERTS.pop()
    for q in set(ALERT_SUBSCRIBERS):
        q.put_nowait(alert)

    if _sb:
        try:
            _sb.table("tv_alerts").upsert({
                "alert_id":              alert["id"],
                "ts":                    alert["ts"],
                "ticker":                alert.get("ticker"),
                "timeframe":             alert.get("timeframe"),
                "condition":             alert.get("condition"),
                "price":                 alert.get("price"),
                "signal":                alert.get("signal"),
                "display_type":          alert.get("display_type"),
                "setup":                 alert.get("setup"),
                "grade":                 alert.get("grade"),
                "direction":             alert.get("direction"),
                "atr_level":             alert.get("atr_level"),
                "entry":                 alert.get("entry"),
                "t1":                    alert.get("t1"),
                "t2":                    alert.get("t2"),
                "t3":                    alert.get("t3"),
                "sl":                    alert.get("sl"),
                "trail_sl":              alert.get("trail_sl"),
                "internals":             alert.get("internals"),
                "internals_age_seconds": alert.get("internals_age_seconds"),
                "trade_plan":            alert.get("trade_plan"),
            }, on_conflict="alert_id").execute()
        except Exception as _e:
            print(f"[WARN] tv_alerts insert failed: {_e}")

    return {"status": "received", "id": alert["id"]}


@app.post("/webhook/tv")
async def webhook_tv(request: Request):
    try:
        body = await request.body()
        data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    x_tv_secret = request.headers.get("x-tv-secret")
    secret = data.get("secret") or x_tv_secret
    if secret != TV_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if data.get("type") == "internals" or data.get("signal") == "INTERNALS":
        return await _handle_internals(data)

    return await _handle_trade_alert(data)


@app.get("/internals")
def get_internals():
    return INTERNALS_CACHE


@app.get("/alerts")
def get_alerts(limit: int = 20):
    limit = min(limit, 50)
    if _sb:
        try:
            res = _sb.table("tv_alerts").select("*").order("ts", desc=True).limit(limit).execute()
            rows = res.data or []
            for r in rows:
                if "alert_id" in r:
                    r["id"] = r.pop("alert_id")
            return {"alerts": rows, "count": len(rows)}
        except Exception as _e:
            print(f"[WARN] tv_alerts fetch failed: {_e}")
    sliced = TV_ALERTS[:limit]
    return {"alerts": sliced, "count": len(sliced)}


@app.get("/alerts/stream")
async def alerts_stream():
    queue: asyncio.Queue = asyncio.Queue()
    ALERT_SUBSCRIBERS.add(queue)

    async def generate():
        try:
            while True:
                try:
                    alert = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield f"data: {json.dumps(alert)}\n\n"
                except asyncio.TimeoutError:
                    yield "data: ping\n\n"
        finally:
            ALERT_SUBSCRIBERS.discard(queue)

    return FastAPIStreaming(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


# ── Journal ──────────────────────────────────────────────────────────────────

class JournalEntryPayload(BaseModel):
    date: str
    ticker: str
    setup: str
    direction: str
    entry_price: float
    entry_premium: Optional[float] = None
    exit_price: Optional[float] = None
    exit_premium: Optional[float] = None
    contracts: int = 1
    pnl: Optional[float] = None
    grade: Optional[str] = None
    process_grade: Optional[str] = None
    notes: Optional[str] = None
    status: str = "open"


class JournalUpdatePayload(BaseModel):
    exit_price: Optional[float] = None
    exit_premium: Optional[float] = None
    entry_premium: Optional[float] = None
    pnl: Optional[float] = None
    grade: Optional[str] = None
    process_grade: Optional[str] = None
    notes: Optional[str] = None
    status: Optional[str] = None


def _calc_pnl(direction: str, entry: float, exit_p: float, contracts: int) -> float:
    if direction.upper() == "BULL":
        return (exit_p - entry) * contracts * 100
    return (entry - exit_p) * contracts * 100


JOURNAL_ENTRIES: list[dict] = [
    {
        "id": "seed-001", "created_at": "2026-05-12T09:47:00-04:00",
        "date": "2026-05-12", "ticker": "SPX", "setup": "GG", "direction": "BULL",
        "entry_price": 7382.50, "exit_price": 7410.00, "contracts": 2,
        "pnl": 5500.0, "grade": "A+", "process_grade": "A+",
        "notes": "Clean GG bull at open, ribbon aligned, vol above avg",
        "internals": {"trin": 0.72, "add": 312, "vold": 1.24},
    },
    {
        "id": "seed-002", "created_at": "2026-05-12T10:23:00-04:00",
        "date": "2026-05-12", "ticker": "SPX", "setup": "FLAG", "direction": "BULL",
        "entry_price": 7412.00, "exit_price": 7398.50, "contracts": 1,
        "pnl": -1350.0, "grade": "A", "process_grade": "A+",
        "notes": "Flag entry was clean but market reversed on high TRIN",
        "internals": {"trin": 1.31, "add": -108, "vold": 0.88},
    },
    {
        "id": "seed-003", "created_at": "2026-05-13T09:52:00-04:00",
        "date": "2026-05-13", "ticker": "SPX", "setup": "VOMY", "direction": "BULL",
        "entry_price": 7388.00, "exit_price": 7419.50, "contracts": 2,
        "pnl": 6300.0, "grade": "A+", "process_grade": "A+",
        "notes": "Vomy with PO zero-cross, ADD +480 confirmation, added second contract",
        "internals": {"trin": 0.61, "add": 480, "vold": 1.67},
    },
    {
        "id": "seed-004", "created_at": "2026-05-14T10:15:00-04:00",
        "date": "2026-05-14", "ticker": "SPX", "setup": "GG", "direction": "BEAR",
        "entry_price": 7435.00, "exit_price": 7419.00, "contracts": 1,
        "pnl": 1600.0, "grade": "A", "process_grade": "A",
        "notes": "GG bear at put trigger, quick scalp, exited early",
        "internals": {"trin": 1.18, "add": -220, "vold": 0.92},
    },
    {
        "id": "seed-005", "created_at": "2026-05-14T11:42:00-04:00",
        "date": "2026-05-14", "ticker": "SPX", "setup": "DIV", "direction": "BULL",
        "entry_price": 7395.00, "exit_price": 7381.00, "contracts": 1,
        "pnl": -1400.0, "grade": "A", "process_grade": "B",
        "notes": "DIV setup valid but traded against a strong bearish trend day, process error",
        "internals": {"trin": 1.44, "add": -390, "vold": 0.71},
    },
    {
        "id": "seed-006", "created_at": "2026-05-15T09:38:00-04:00",
        "date": "2026-05-15", "ticker": "SPX", "setup": "GG", "direction": "BULL",
        "entry_price": 7401.00, "exit_price": 7428.50, "contracts": 2,
        "pnl": 5500.0, "grade": "A+", "process_grade": "A+",
        "notes": "Best trade of the week — GG A+ at open, full target",
        "internals": {"trin": 0.68, "add": 520, "vold": 1.51},
    },
    {
        "id": "seed-007", "created_at": "2026-05-16T10:55:00-04:00",
        "date": "2026-05-16", "ticker": "SPX", "setup": "TWEEZER", "direction": "BEAR",
        "entry_price": 7420.00, "exit_price": 7408.50, "contracts": 1,
        "pnl": 1150.0, "grade": "A", "process_grade": "A",
        "notes": "Tweezer bear at GG open call, partial fill, good execution",
        "internals": {"trin": 1.09, "add": -145, "vold": 1.02},
    },
    {
        "id": "seed-008", "created_at": "2026-05-19T11:20:00-04:00",
        "date": "2026-05-19", "ticker": "SPX", "setup": "FLAG", "direction": "BEAR",
        "entry_price": 7430.00, "exit_price": 7438.50, "contracts": 1,
        "pnl": -850.0, "grade": "A", "process_grade": "A",
        "notes": "Flag bear invalidated by news spike, stopped correctly",
        "internals": {"trin": 0.95, "add": 88, "vold": 1.12},
    },
]


@app.post("/journal/entry")
async def create_journal_entry(payload: JournalEntryPayload, user_id: str = Depends(get_current_user)):
    pnl = payload.pnl if payload.pnl is not None else (
        _calc_pnl(payload.direction, payload.entry_price, payload.exit_price, payload.contracts)
        if payload.exit_price is not None else None
    )
    internals = get_market_internals()
    if not any([internals.get("trin"), internals.get("add"), internals.get("vold")]):
        internals = {k: INTERNALS_CACHE.get(k)
                     for k in ["trin", "add", "vold"]}
    entry = {
        "id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "date": payload.date,
        "ticker": payload.ticker,
        "setup": payload.setup,
        "direction": payload.direction,
        "entry_price": payload.entry_price,
        "entry_premium": payload.entry_premium,
        "exit_price": payload.exit_price,
        "exit_premium": payload.exit_premium,
        "contracts": payload.contracts,
        "pnl": round(pnl, 2) if pnl is not None else None,
        "grade": payload.grade or "",
        "process_grade": payload.process_grade or "",
        "notes": payload.notes or "",
        "status": payload.status,
        "internals": internals,
    }
    if _sb:
        try:
            _sb.table("trade_journal").insert({
                "user_id":        user_id,
                "date":           entry["date"],
                "ticker":         entry["ticker"],
                "setup":          entry["setup"],
                "direction":      entry["direction"],
                "entry_price":    entry["entry_price"],
                "entry_premium":  entry["entry_premium"],
                "exit_price":     entry["exit_price"],
                "exit_premium":   entry["exit_premium"],
                "contracts":      entry["contracts"],
                "pnl":            entry["pnl"],
                "grade":          entry["grade"],
                "process_grade":  entry["process_grade"],
                "notes":          entry["notes"],
                "status":         entry["status"],
                "internals":      entry["internals"],
            }).execute()
        except Exception as _e:
            print(f"[WARN] trade_journal insert failed: {_e}")
    JOURNAL_ENTRIES.insert(0, entry)
    return {"status": "created", "id": entry["id"], "pnl": entry["pnl"]}


@app.patch("/journal/entry/{entry_id}")
async def update_journal_entry(
    entry_id: str,
    payload: JournalUpdatePayload,
    user_id: str = Depends(get_current_user)
):
    if not _sb:
        raise HTTPException(status_code=503, detail="Database not configured")
    try:
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        if not update_data:
            return {"status": "no changes"}
        result = _sb.table("trade_journal")\
            .update(update_data)\
            .eq("id", entry_id)\
            .eq("user_id", user_id)\
            .execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Entry not found or not yours")
        return {"status": "updated", "entry": result.data[0]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/journal/entries")
def get_journal_entries(limit: int = 50, user_id: str = Depends(get_current_user)):
    limit = min(limit, 200)
    if _sb:
        try:
            res = _sb.table("trade_journal").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(limit).execute()
            rows = res.data or []
            return {"entries": rows, "count": len(rows)}
        except Exception as _e:
            print(f"[WARN] trade_journal fetch failed: {_e}")
    sliced = JOURNAL_ENTRIES[:limit]
    return {"entries": sliced, "count": len(sliced)}


@app.get("/journal/stats")
def get_journal_stats(user_id: str = Depends(get_current_user)):
    entries = JOURNAL_ENTRIES
    if _sb:
        try:
            res = _sb.table("trade_journal").select("*").eq("user_id", user_id).order("created_at", desc=True).limit(200).execute()
            entries = res.data or []
        except Exception as _e:
            print(f"[WARN] trade_journal stats fetch failed: {_e}")
    if not entries:
        return {
            "total_trades": 0, "wins": 0, "losses": 0, "win_rate": 0.0,
            "total_pnl": 0.0, "avg_winner": 0.0, "avg_loser": 0.0,
            "best_setup": None, "pnl_by_setup": {}, "pnl_by_hour": {},
            "equity_curve": [],
        }

    closed = [e for e in entries if e.get("pnl") is not None]
    wins = [e for e in closed if e["pnl"] > 0]
    losses = [e for e in closed if e["pnl"] <= 0]

    avg_winner = sum(e["pnl"] for e in wins) / len(wins) if wins else 0.0
    avg_loser = sum(e["pnl"] for e in losses) / len(losses) if losses else 0.0

    pnl_by_setup: dict[str, dict] = {}
    for e in entries:
        s = e.get("setup", "OTHER")
        if s not in pnl_by_setup:
            pnl_by_setup[s] = {"wins": 0, "losses": 0, "total_pnl": 0.0}
        pnl = e.get("pnl") or 0
        if pnl > 0:
            pnl_by_setup[s]["wins"] += 1
        else:
            pnl_by_setup[s]["losses"] += 1
        pnl_by_setup[s]["total_pnl"] = round(
            pnl_by_setup[s]["total_pnl"] + pnl, 2)

    best_setup = None
    best_wr = -1.0
    for s, data in pnl_by_setup.items():
        total = data["wins"] + data["losses"]
        if total >= 3:
            wr = data["wins"] / total
            if wr > best_wr:
                best_wr = wr
                best_setup = s

    pnl_by_hour: dict[str, dict] = {}
    for e in entries:
        try:
            hr = str(datetime.fromisoformat(e.get("created_at", "")).hour)
        except Exception:
            hr = "unknown"
        if hr not in pnl_by_hour:
            pnl_by_hour[hr] = {"wins": 0, "losses": 0}
        if (e.get("pnl") or 0) > 0:
            pnl_by_hour[hr]["wins"] += 1
        else:
            pnl_by_hour[hr]["losses"] += 1

    sorted_entries = sorted(entries, key=lambda e: e.get("created_at", ""))
    equity_curve: list[float] = []
    running = 0.0
    for e in sorted_entries:
        running += e.get("pnl") or 0
        equity_curve.append(round(running, 2))

    return {
        "total_trades": len(closed),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(closed) * 100, 1) if closed else 0.0,
        "total_pnl": round(sum(e["pnl"] for e in closed), 2),
        "avg_winner": round(avg_winner, 2),
        "avg_loser": round(avg_loser, 2),
        "best_setup": best_setup,
        "pnl_by_setup": pnl_by_setup,
        "pnl_by_hour": pnl_by_hour,
        "equity_curve": equity_curve,
    }


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
