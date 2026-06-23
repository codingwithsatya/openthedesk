import asyncio
import json
from datetime import datetime, timezone

from fastapi import APIRouter

from backend.app.core.clients import client, HAIKU, SONNET
from backend.app.core.utils import with_retry
from backend.app.models.analyzer import AnalyzeRequest, QuickAnalyzeRequest
from analyzer import get_ticker_analysis, get_watchlist_data
from tradier import get_0dte_snapshot

router = APIRouter()

_US_WATCHLIST = ["AAPL", "NVDA", "TSLA", "MSFT",
                 "AMZN", "META", "GOOGL", "AMD", "SPY", "QQQ"]
_IN_WATCHLIST = ["RELIANCE.NS", "INFY.NS",
                 "TCS.NS", "HDFCBANK.NS", "ICICIBANK.NS"]

_ZERO_DTE_ELIGIBLE = {
    "NVDA", "TSLA", "META", "AMZN", "AAPL", "MSFT", "GOOGL",
    "QQQ", "SPY", "XLK", "XLF", "SMH",
}
_MAG7 = ["NVDA", "TSLA", "META", "AMZN", "AAPL", "MSFT", "GOOGL"]
_CONTEXT_INSTRUMENTS = ["QQQ", "SPY", "XLK", "XLF", "SMH"]

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


@router.post("/analyze")
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
            messages=[{"role": "user", "content": f"Market Data:\n{ctx}\n\n{options_context}"}],
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


@router.post("/quick-analyze")
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


@router.get("/screener")
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


@router.get("/watchlist")
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

    mag7_results = sorted(
        [r for r in results if r["ticker"] in _MAG7], key=_sort_key)
    context_results = sorted(
        [r for r in results if r["ticker"] in _CONTEXT_INSTRUMENTS], key=_sort_key)

    return {
        "mag7":         mag7_results,
        "context":      context_results,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
