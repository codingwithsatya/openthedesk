import asyncio
import base64
import time
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

import anthropic
from fastapi import APIRouter, Depends, File, UploadFile
from fastapi.responses import StreamingResponse as FastAPIStreaming

import backend.app.core.state as _state
from backend.app.core.auth import get_current_user
from backend.app.core.clients import client, stream_client, SONNET, HAIKU
from backend.app.core.config import _sb
from backend.app.core.utils import route_model, log_trace, with_retry
from backend.app.models.chat import ChatRequest, RefreshRequest
from backend.app.services.chat_service import (
    _is_command_message, _detect_journal_intent, _extract_journal_fields,
    build_system_prompt,
)
from backend.app.services.journal_service import _save_journal_entry
from backend.app.services.market_service import _fetch_market_news
from context import fetch_live_context
from market_data import get_market_summary
from tradier import get_0dte_snapshot, format_options_context, get_market_internals

router = APIRouter()

# Per-session conversation history (in-memory; Supabase is primary store)
sessions: dict[str, list[dict]] = {}

_LIVE_DATA_COMMANDS = {
    "IN TRADE", "PTR-FAST", "PTR-FULL",
    "TRADE IDEA", "TRADE REVIEW", "EOD", "OPEN THE DESK",
}

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


@router.post("/chat")
async def chat(request: ChatRequest, user_id: str = Depends(get_current_user)):
    global sessions

    if _sb:
        try:
            row = _sb.table("user_sessions").select("history").eq("user_id", user_id).eq(
                "session_id", request.session_id).maybe_single().execute()
            if row and row.data:
                sessions[request.session_id] = row.data["history"]
        except Exception as _e:
            print(f"[WARN] session load failed: {_e}")

    if request.session_id not in sessions:
        sessions[request.session_id] = []

    history = sessions[request.session_id]

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

    live_injection = ""
    cmd = request.message.strip().upper().split("\n")[0]
    if any(cmd.startswith(k) for k in _LIVE_DATA_COMMANDS):
        try:
            mkt = get_market_summary()
            internals = get_market_internals()
            if not any([internals.get("trin"), internals.get("add"), internals.get("vold")]):
                internals = {k: _state.INTERNALS_CACHE.get(k) for k in ["trin", "add", "vold"]}
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

    user_content = request.message + live_injection if live_injection else request.message
    history.append({"role": "user", "content": user_content})

    model = route_model(request.message)
    prompt = build_system_prompt(_state.LIVE_CONTEXT, _state.FLOW_CONTEXT)

    _LONG_COMMANDS = {"PTR-FULL", "TRADE REVIEW", "EOD", "WEEKLY REVIEW",
                      "PREMARKET", "BLUNT FEEDBACK", "OPEN THE DESK"}
    cmd_upper = request.message.strip().upper().split("\n")[0]
    max_tok = 4096 if any(cmd_upper.startswith(c) for c in _LONG_COMMANDS) else 2048

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
            }).execute()
        except Exception as _e:
            print(f"[WARN] session save failed: {_e}")

    return {
        "reply": reply,
        "model": model,
        "session_id": request.session_id,
        "turns": len(history) // 2
    }


@router.get("/session/{session_id}/history")
async def get_session_history(session_id: str, user_id: str = Depends(get_current_user)):
    """Return session chat history for frontend restoration after navigation."""
    try:
        if _sb:
            result = _sb.table("user_sessions").select("history").eq(
                "user_id", user_id).eq("session_id", session_id).execute()
            if result.data and len(result.data) > 0:
                return {"history": result.data[0]["history"] or []}
        return {"history": sessions.get(session_id, [])}
    except Exception as _e:
        print(f"[WARN] session history fetch failed: {_e}")
        return {"history": []}


@router.delete("/session/{session_id}")
async def clear_session(session_id: str, user_id: str = Depends(get_current_user)):
    """Clear conversation history for a session."""
    sessions.pop(session_id, None)
    if _sb:
        try:
            _sb.table("user_sessions").delete().eq(
                "user_id", user_id).eq("session_id", session_id).execute()
        except Exception as _e:
            print(f"[WARN] session delete failed: {_e}")
    return {"cleared": session_id}


@router.post("/analyze-chart")
async def analyze_chart(
    files: list[UploadFile] = File(...),
    context: str = "TRADE IDEA",
    session_id: str = "default"
):
    if session_id not in sessions:
        sessions[session_id] = []
    history = sessions[session_id]

    model = route_model(context)
    prompt = build_system_prompt(_state.LIVE_CONTEXT, _state.FLOW_CONTEXT)

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
    history.append({"role": "user", "content": content})

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


@router.get("/market-data")
async def market_data(atr: float = None, trading_mode: str = "day"):
    """Get live SPX + VIX + ATR levels + 0DTE options chain + unusual flow."""
    summary = get_market_summary(atr_override=atr, trading_mode=trading_mode)
    snapshot = get_0dte_snapshot(atr=atr)
    summary["options"] = snapshot
    summary["options_context"] = format_options_context(snapshot)
    summary["unusual_flow"] = snapshot.get("unusual_flow", {"calls": [], "puts": []})
    summary["flow_context"] = snapshot.get("flow_context", "")
    _state.FLOW_CONTEXT = summary["flow_context"]
    return summary


@router.post("/premarket")
async def premarket(request: ChatRequest):
    """Run PREMARKET with live market data injected."""
    market = get_market_summary(atr_override=request.atr)
    spx = market.get("spx", {})
    vix = market.get("vix", {})
    levels = market.get("atr_levels", {})
    snapshot = get_0dte_snapshot(atr=request.atr)
    options_text = format_options_context(snapshot)
    fresh_flow = snapshot.get("flow_context", "")

    flow_block = f"\n    {fresh_flow}\n" if fresh_flow else ""

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

    def stream():
        full_reply = ""
        for attempt in range(3):
            try:
                with stream_client.messages.stream(
                    model=_model,
                    max_tokens=2048,
                    system=[{
                        "type": "text",
                        "text": build_system_prompt(_state.LIVE_CONTEXT),
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


@router.post("/morning-brief")
async def morning_brief(request: ChatRequest, _user_id: str = Depends(get_current_user)):
    """Generate a structured morning brief using live market + MAG7 watchlist data."""
    from analyzer import get_watchlist_data

    async def _fetch_market():
        return await asyncio.to_thread(get_market_summary, request.atr)

    async def _fetch_watchlist():
        _eligible = {"NVDA", "TSLA", "META", "AMZN", "AAPL", "MSFT", "GOOGL", "QQQ", "SPY"}
        tickers = ["NVDA", "TSLA", "META", "AMZN", "AAPL", "MSFT", "GOOGL", "SPY", "QQQ"]
        results = await asyncio.gather(
            *[asyncio.to_thread(get_watchlist_data, t, _eligible) for t in tickers]
        )
        return results

    market, watchlist_results, news_data = await asyncio.gather(
        _fetch_market(), _fetch_watchlist(), _fetch_market_news()
    )

    spx = market.get("spx", {})
    vix = market.get("vix", {})
    atr_l = market.get("atr_levels", {})
    trin = _state.INTERNALS_CACHE.get("trin")
    add_v = _state.INTERNALS_CACHE.get("add")
    vold = _state.INTERNALS_CACHE.get("vold")
    pcc = _state.INTERNALS_CACHE.get("pcc")

    watch_lines = []
    spy_state = "N/A"
    qqq_state = "N/A"
    for r in watchlist_results:
        t = r.get("ticker", "")
        ribbon = r.get("ribbon_state", "MIXED")
        comp = "●" if r.get("compression") else " "
        chg = f"{r.get('change_pct', 0):+.2f}%" if r.get("change_pct") is not None else "N/A"
        po = r.get("po_value") or 0
        po_zone = ("accumulation" if po < -61.8 else
                   "distribution" if po > 61.8 else "neutral")
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

    all_empty = not any([news_data["economic_calendar"],
                         news_data["gap_movers"], news_data["catalyst_news"]])
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


@router.post("/refresh-context")
async def refresh_context(request: RefreshRequest, user_id: str = Depends(get_current_user)):
    """Fetch fresh context from Google Doc and clear session."""
    _state.LIVE_CONTEXT = fetch_live_context()
    sessions.pop(request.session_id, None)
    if _sb:
        try:
            _sb.table("user_sessions").delete().eq("user_id", user_id).eq(
                "session_id", request.session_id).execute()
        except Exception as _e:
            print(f"[WARN] session delete failed: {_e}")
    return {"status": "refreshed", "chars": len(_state.LIVE_CONTEXT)}
