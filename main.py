import os
import uuid
import base64
import asyncio
import json
import httpx
import anthropic
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
from fastapi import FastAPI, Header, HTTPException, UploadFile, File
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
    - "PTR-FAST" → 3-gate quick check, all must be YES or SKIP IT
    - "PTR-FULL" → 12-point full audit
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


@app.post("/chat")
async def chat(request: ChatRequest):
    global LIVE_CONTEXT, FLOW_CONTEXT

    # Get or create session history
    if request.session_id not in sessions:
        sessions[request.session_id] = []

    history = sessions[request.session_id]

    # Add user message
    history.append({"role": "user", "content": request.message})

    model = route_model(request.message)
    prompt = build_system_prompt(LIVE_CONTEXT, FLOW_CONTEXT)

    response = with_retry(lambda: client.messages.create(
        model=model,
        max_tokens=2048,
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
    file: UploadFile = File(...),
    context: str = "TRADE IDEA",
    session_id: str = "default"
):
    global LIVE_CONTEXT

    image_data = await file.read()
    base64_image = base64.standard_b64encode(image_data).decode("utf-8")
    media_type = file.content_type or "image/jpeg"

    if session_id not in sessions:
        sessions[session_id] = []
    history = sessions[session_id]

    model = route_model(context)
    prompt = build_system_prompt(LIVE_CONTEXT, FLOW_CONTEXT)

    user_message = {
        "role": "user",
        "content": [
            {
                "type": "image",
                "source": {
                    "type": "base64",
                    "media_type": media_type,
                    "data": base64_image
                }
            },
            {
                "type": "text",
                "text": f"""{context}

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
            }
        ]
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

class TVAlertPayload(BaseModel):
    ticker: str
    timeframe: str
    condition: str
    price: str
    atr_level: str
    setup: Optional[str] = None
    grade: Optional[str] = None
    direction: Optional[str] = None
    secret: Optional[str] = None
    trin: Optional[float] = None
    add: Optional[int] = None
    vold: Optional[float] = None


@app.post("/webhook/tv")
async def webhook_tv(
    payload: TVAlertPayload,
    x_tv_secret: str = Header(None),
):
    if x_tv_secret != TV_WEBHOOK_SECRET and payload.secret != TV_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    internals = get_market_internals()
    alert = {
        "id": str(uuid.uuid4()),
        "ts": datetime.now(timezone.utc).isoformat(),
        "ticker": payload.ticker,
        "timeframe": payload.timeframe,
        "condition": payload.condition,
        "price": payload.price,
        "atr_level": payload.atr_level,
        "setup": payload.setup,
        "grade": payload.grade,
        "direction": payload.direction,
        "trin": internals.get("trin"),
        "add": internals.get("add"),
        "vold": internals.get("vold"),
    }
    TV_ALERTS.insert(0, alert)
    if len(TV_ALERTS) > 50:
        TV_ALERTS.pop()
    for q in set(ALERT_SUBSCRIBERS):
        q.put_nowait(alert)
    return {"status": "received", "id": alert["id"]}


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


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)
