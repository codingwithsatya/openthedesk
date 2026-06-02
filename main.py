import os
import uuid
import base64
import asyncio
import json
import httpx
import anthropic
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse as FastAPIStreaming
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from context import fetch_live_context
from market_data import get_market_summary
from tradier import get_0dte_snapshot, format_options_context, get_market_internals
from analyzer import get_ticker_analysis
import time

load_dotenv()
TV_WEBHOOK_SECRET = os.getenv("TV_WEBHOOK_SECRET", "dev-secret")

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
INTERNALS_CACHE: dict = {"trin": None, "add": None,
                         "vold": None, "pcc": None, "ts": None}

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
async def chat(request: ChatRequest):
    global LIVE_CONTEXT, FLOW_CONTEXT

    # Get or create session history
    if request.session_id not in sessions:
        sessions[request.session_id] = []

    history = sessions[request.session_id]

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


@app.post("/refresh-context")
async def refresh_context(request: RefreshRequest):
    """Fetch fresh context from Google Doc and clear session."""
    global LIVE_CONTEXT
    LIVE_CONTEXT = fetch_live_context()
    sessions.pop(request.session_id, None)
    return {"status": "refreshed", "chars": len(LIVE_CONTEXT)}


@app.delete("/session/{session_id}")
async def clear_session(session_id: str):
    """Clear conversation history for a session."""
    sessions.pop(session_id, None)
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


class AnalyzeRequest(BaseModel):
    ticker: str
    trading_mode: str = "day"   # day | multiday | swing | position


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
        "generated_at": datetime.utcnow().isoformat() + "Z",
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

    INTERNALS_CACHE = {
        "type":        "internals",
        "signal":      "INTERNALS",
        "ticker":      data.get("ticker", "SPX"),
        "timeframe":   data.get("timeframe", "3"),
        "trin":        _sf(data.get("trin")),
        "add":         _sf(data.get("add")),
        "vold":        _sf(data.get("vold")),
        "pcc":         _sf(data.get("pcc")),
        "received_at": datetime.now(timezone.utc).isoformat(),
        "source":      "tradingview",
    }

    # internals_event = {"type": "internals", "data": INTERNALS_CACHE}
    # for q in set(ALERT_SUBSCRIBERS):
    #     q.put_nowait(internals_event)

    return {"status": "ok", "cached": INTERNALS_CACHE}


async def _handle_trade_alert(data: dict) -> dict:
    """Handle Manual Planner v3.3.1 and ATR Clean backup alerts.

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
    ticker: str = "SPX"
    setup: str
    direction: str
    entry_price: float
    exit_price: float
    contracts: int = 1
    pnl: Optional[float] = None
    grade: str = "A"
    process_grade: str = "A"
    notes: Optional[str] = None


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
async def create_journal_entry(payload: JournalEntryPayload):
    pnl = payload.pnl if payload.pnl is not None else _calc_pnl(
        payload.direction, payload.entry_price, payload.exit_price, payload.contracts
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
        "exit_price": payload.exit_price,
        "contracts": payload.contracts,
        "pnl": round(pnl, 2),
        "grade": payload.grade,
        "process_grade": payload.process_grade,
        "notes": payload.notes,
        "internals": internals,
    }
    JOURNAL_ENTRIES.insert(0, entry)
    return {"status": "created", "id": entry["id"], "pnl": entry["pnl"]}


@app.get("/journal/entries")
def get_journal_entries(limit: int = 50):
    limit = min(limit, 200)
    sliced = JOURNAL_ENTRIES[:limit]
    return {"entries": sliced, "count": len(sliced)}


@app.get("/journal/stats")
def get_journal_stats():
    entries = JOURNAL_ENTRIES
    if not entries:
        return {
            "total_trades": 0, "wins": 0, "losses": 0, "win_rate": 0.0,
            "total_pnl": 0.0, "avg_winner": 0.0, "avg_loser": 0.0,
            "best_setup": None, "pnl_by_setup": {}, "pnl_by_hour": {},
            "equity_curve": [],
        }

    wins = [e for e in entries if (e.get("pnl") or 0) > 0]
    losses = [e for e in entries if (e.get("pnl") or 0) <= 0]

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
        "total_trades": len(entries),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(entries) * 100, 1),
        "total_pnl": round(sum(e.get("pnl") or 0 for e in entries), 2),
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
