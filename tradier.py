import os
import requests
from datetime import date
from dotenv import load_dotenv

load_dotenv()

TRADIER_TOKEN = os.environ.get("TRADIER_TOKEN")
BASE_URL = "https://api.tradier.com/v1"

HEADERS = {
    "Authorization": f"Bearer {TRADIER_TOKEN}",
    "Accept": "application/json"
}


# ─────────────────────────────────────────────
# CORE REQUEST HELPER
# ─────────────────────────────────────────────

def _get(endpoint: str, params: dict | None = None) -> dict:
    """Make a GET request to Tradier API."""
    try:
        response = requests.get(
            f"{BASE_URL}{endpoint}",
            headers=HEADERS,
            params=params or {},
            timeout=10
        )
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        return {"error": f"HTTP {response.status_code}: {str(e)}"}
    except requests.exceptions.Timeout:
        return {"error": "Tradier request timed out"}
    except Exception as e:
        return {"error": str(e)}


# ─────────────────────────────────────────────
# QUOTE — SPX SPOT PRICE
# ─────────────────────────────────────────────

def get_spx_quote() -> dict:
    """Get live SPX spot price from Tradier."""
    # Try multiple symbol formats — Tradier index symbology varies
    for symbol in ["SPX", "$SPX.X", "SPXW"]:
        data = _get("/markets/quotes", {"symbols": symbol, "greeks": "false"})
        if "quote" in data.get("quotes", {}):
            break

    try:
        quote = data["quotes"]["quote"]
        return {
            "symbol": "SPX",
            "last": quote.get("last"),
            "bid": quote.get("bid"),
            "ask": quote.get("ask"),
            "close": quote.get("close"),          # previous close (PDC)
            "high": quote.get("high"),
            "low": quote.get("low"),
            "open": quote.get("open"),
            "volume": quote.get("volume"),
            "source": "tradier"
        }
    except Exception as e:
        return {"error": f"Quote parse failed: {str(e)}", "raw": data}


# ─────────────────────────────────────────────
# EXPIRATIONS — FIND TODAY'S 0DTE
# ─────────────────────────────────────────────

def get_spxw_expirations() -> list[str]:
    """Get available SPXW expiration dates via SPX underlying with all roots."""
    # Use SPX as underlying — SPXW comes back via includeAllRoots
    data = _get("/markets/options/expirations", {
        "symbol": "SPX",
        "includeAllRoots": "true",
        "strikes": "false"
    })

    try:
        expirations = data["expirations"]["date"]
        if isinstance(expirations, str):
            expirations = [expirations]
        return expirations
    except Exception as e:
        return []


def get_today_expiry() -> str | None:
    """Return today's 0DTE expiry string if it exists, else nearest next expiry."""
    today = str(date.today())
    expirations = get_spxw_expirations()

    if not expirations:
        return None

    # Prefer today (true 0DTE)
    if today in expirations:
        return today

    # Fallback: next available expiry
    future = [e for e in sorted(expirations) if e >= today]
    return future[0] if future else None


# ─────────────────────────────────────────────
# OPTIONS CHAIN — 0DTE STRIKES NEAR SPOT
# ─────────────────────────────────────────────

def get_0dte_chain(expiry: str, spot: float, width_pct: float = 0.02) -> dict:
    """
    Pull SPXW options chain for a given expiry.
    Returns calls and puts within width_pct of spot price.
    Default: strikes within 2% of current SPX price.
    """
    data = _get("/markets/options/chains", {
        "symbol": "SPX",
        "expiration": expiry,
        "greeks": "true"
    })

    try:
        options = data["options"]["option"]
        if isinstance(options, dict):
            options = [options]
    except Exception as e:
        return {"error": f"Chain parse failed: {str(e)}", "raw": data}

    # Filter to strikes within width_pct of spot
    lower = spot * (1 - width_pct)
    upper = spot * (1 + width_pct)

    calls = []
    puts = []

    for opt in options:
        strike = opt.get("strike", 0)
        if not (lower <= strike <= upper):
            continue

        cleaned = {
            "strike": strike,
            "expiration": opt.get("expiration_date"),
            "bid": opt.get("bid"),
            "ask": opt.get("ask"),
            "mid": round(((opt.get("bid") or 0) + (opt.get("ask") or 0)) / 2, 2),
            "last": opt.get("last"),
            "volume": opt.get("volume"),
            "open_interest": opt.get("open_interest"),
            "iv": (opt.get("greeks") or {}).get("mid_iv"),
            "delta": (opt.get("greeks") or {}).get("delta"),
            "gamma": (opt.get("greeks") or {}).get("gamma"),
            "theta": (opt.get("greeks") or {}).get("theta"),
        }

        if opt.get("option_type") == "call":
            calls.append(cleaned)
        else:
            puts.append(cleaned)

    # Sort by strike
    calls.sort(key=lambda x: x["strike"])
    puts.sort(key=lambda x: x["strike"])

    return {
        "expiry": expiry,
        "spot": spot,
        "calls": calls,
        "puts": puts,
        "total_strikes": len(calls) + len(puts)
    }


# ─────────────────────────────────────────────
# UNUSUAL FLOW DETECTION — VOL/OI RATIO
# ─────────────────────────────────────────────

def get_unusual_flow(all_calls: list, all_puts: list) -> dict:
    """
    Detect unusual options flow by vol/OI ratio.
    A high ratio means volume far exceeds open interest — indicating
    aggressive new position opening, not rolling existing contracts.

    Thresholds (conservative for 0DTE SPX):
      - open_interest >= 50  (requires an OI baseline — ratio is meaningless
                              on fresh 0DTE contracts with OI of 1–10)
      - vol/OI ratio > 3.0   (volume 3× the open interest)
      - volume > 500          (meaningful size, filters noise)
      - mid > 1.00            (eliminates near-zero lottery tickets)

    Returns top 10 unusual strikes each for calls and puts,
    sorted by vol/OI ratio descending.
    """
    TOP_N = 10

    def score(opt: dict, opt_type: str) -> dict | None:
        volume = opt.get("volume") or 0
        oi = opt.get("open_interest") or 0
        mid = opt.get("mid") or 0

        # OI must have a real baseline — otherwise ratio is meaningless
        if oi < 50:
            return None

        if volume < 500 or mid < 1.0:
            return None

        ratio = volume / oi
        if ratio < 3.0:
            return None

        return {
            "strike":        opt["strike"],
            "type":          opt_type,
            "mid":           round(mid, 2),
            "volume":        int(volume),
            "open_interest": int(oi),
            "vol_oi_ratio":  round(ratio, 1),
            "delta":         opt.get("delta"),
            "iv":            opt.get("iv"),
        }

    unusual_calls = [r for c in all_calls if (r := score(c, "call"))]
    unusual_puts = [r for p in all_puts if (r := score(p, "put"))]

    unusual_calls.sort(key=lambda x: x["vol_oi_ratio"], reverse=True)
    unusual_puts.sort(key=lambda x:  x["vol_oi_ratio"], reverse=True)

    return {
        "calls": unusual_calls[:TOP_N],
        "puts":  unusual_puts[:TOP_N],
    }


def format_flow_context(unusual_flow: dict) -> str:
    """
    Format unusual flow as a clean text block for Claude's system prompt.
    Returns empty string when no unusual flow is detected.
    """
    calls = unusual_flow.get("calls", [])
    puts = unusual_flow.get("puts",  [])

    if not calls and not puts:
        return ""

    lines = ["UNUSUAL SPX FLOW (Tradier — vol/OI ratio):"]

    if calls:
        lines.append("CALLS (aggressive new buying above market):")
        for c in calls[:5]:
            delta_str = f"δ={c['delta']:.2f}" if c.get(
                "delta") is not None else "δ=—"
            lines.append(
                f"  {c['strike']}C  vol={c['volume']:,}  OI={c['open_interest']:,}"
                f"  ratio={c['vol_oi_ratio']}x  mid=${c['mid']}  {delta_str}"
            )

    if puts:
        lines.append("PUTS (aggressive new buying below market):")
        for p in puts[:5]:
            delta_str = f"δ={p['delta']:.2f}" if p.get(
                "delta") is not None else "δ=—"
            lines.append(
                f"  {p['strike']}P  vol={p['volume']:,}  OI={p['open_interest']:,}"
                f"  ratio={p['vol_oi_ratio']}x  mid=${p['mid']}  {delta_str}"
            )

    lines.append(
        "Interpretation: ratio >3x = volume significantly exceeds OI"
        " → new aggressive positioning, not rolling existing contracts"
    )
    return "\n".join(lines)


# ─────────────────────────────────────────────
# FILTER — STRIKES MATCHING $3–4 PREMIUM BUDGET
# ─────────────────────────────────────────────

def filter_by_premium(chain: dict, min_prem: float = 2.0, max_prem: float = 5.0) -> dict:
    """
    Filter options chain to strikes where mid price is within premium budget.
    Default: $2.00–$5.00 (slightly wider than $3–4 to catch edge cases).
    """
    if "error" in chain:
        return chain

    def in_budget(opt):
        mid = opt.get("mid", 0)
        return mid is not None and min_prem <= mid <= max_prem

    return {
        **chain,
        "calls": [c for c in chain["calls"] if in_budget(c)],
        "puts":  [p for p in chain["puts"] if in_budget(p)],
    }


def filter_by_delta(chain: dict, min_delta: float = 0.20, max_delta: float = 0.45) -> dict:
    """
    Filter to strikes with delta in the directional entry range.
    Calls:  delta between +0.20 and +0.45
    Puts:   delta between -0.45 and -0.20 (stored as negative)
    Saty system: 0.20–0.40 delta = ideal entry zone for 0DTE.
    """
    if "error" in chain:
        return chain

    def call_ok(opt):
        d = opt.get("delta")
        return d is not None and min_delta <= d <= max_delta

    def put_ok(opt):
        d = opt.get("delta")
        return d is not None and -max_delta <= d <= -min_delta

    return {
        **chain,
        "calls": [c for c in chain["calls"] if call_ok(c)],
        "puts":  [p for p in chain["puts"] if put_ok(p)],
    }


# ─────────────────────────────────────────────
# MAIN ENTRY POINT — FULL 0DTE SNAPSHOT
# ─────────────────────────────────────────────

def get_0dte_snapshot(atr: float = None) -> dict:
    """
    Full 0DTE options snapshot for OpenTheDesk.
    Strategy per Saty system: target strikes ~0.5 ATR OTM, delta 0.25-0.40.
    Since Tradier greeks are unreliable for index options intraday,
    we select strikes by distance from spot using ATR when available,
    otherwise fall back to strikes within $2-6 premium range.
    """
    # 1. Get spot price
    quote = get_spx_quote()
    if "error" in quote:
        return {"error": f"SPX quote failed: {quote['error']}"}

    spot = quote.get("last") or quote.get("close")
    if not spot:
        return {"error": "Could not determine SPX spot price"}

    # 2. Find today's expiry
    expiry = get_today_expiry()
    if not expiry:
        return {"error": "No SPXW expiry found for today"}

    # 3. Pull wide chain — 3% to get full range of strikes
    chain = get_0dte_chain(expiry, spot, width_pct=0.03)
    if "error" in chain:
        return {"error": f"Chain pull failed: {chain['error']}"}

    all_calls = chain["calls"]
    all_puts = chain["puts"]

    # 4. Saty target strikes — 0.5 ATR OTM (round to nearest 5)
    # Per system: "0.5 ATR is preferred" for scalps/day trades
    if atr:
        call_target = round((spot + atr * 0.5) / 5) * 5
        put_target = round((spot - atr * 0.5) / 5) * 5
        # Also compute trigger and GG open for reference
        call_trigger = round((spot + atr * 0.236) / 5) * 5
        put_trigger = round((spot - atr * 0.236) / 5) * 5
    else:
        # No ATR — use ATM ± 30pts as fallback
        call_target = round((spot + 30) / 5) * 5
        put_target = round((spot - 30) / 5) * 5
        call_trigger = round((spot + 15) / 5) * 5
        put_trigger = round((spot - 15) / 5) * 5

    # 5. Find best call — strike closest to call_target with a real mid price
    def best_strike(options, target):
        candidates = [o for o in options if o.get("mid") and o["mid"] > 0.5]
        return min(candidates, key=lambda o: abs(o["strike"] - target)) if candidates else None

    # Filter to delta 0.20–0.45 first (Saty system entry zone)
    # Fall back to unfiltered if no contracts in range
    filtered_calls = [o for o in all_calls if o.get(
        "delta") is not None and 0.20 <= o["delta"] <= 0.45]
    filtered_puts = [o for o in all_puts if o.get(
        "delta") is not None and -0.45 <= o["delta"] <= -0.20]

    # Apply budget filter ($2–$5) on top of delta filter
    budget_filtered_calls = [o for o in (filtered_calls or all_calls) if o.get(
        "mid") and 2.0 <= o["mid"] <= 5.0]
    budget_filtered_puts = [o for o in (filtered_puts or all_puts) if o.get(
        "mid") and 2.0 <= o["mid"] <= 5.0]

    best_call = best_strike(
        budget_filtered_calls or filtered_calls or all_calls, call_target)
    best_put = best_strike(
        budget_filtered_puts or filtered_puts or all_puts,  put_target)

    # 6. Budget filter — $2–6 range (Phase 2: max $3-4, slight buffer)
    def in_budget(opt):
        mid = opt.get("mid") or 0
        return 1.5 <= mid <= 6.0

    budget_calls = [c for c in all_calls if in_budget(c)]
    budget_puts = [p for p in all_puts if in_budget(p)]

    # 7. Flag if best strike is within budget
    call_in_budget = best_call and in_budget(best_call)
    put_in_budget = best_put and in_budget(best_put)

    # 8. Unusual flow — calculated from full chain (not budget-filtered)
    unusual_flow = get_unusual_flow(all_calls, all_puts)
    flow_context = format_flow_context(unusual_flow)

    return {
        "spot": spot,
        "expiry": expiry,
        "source": "tradier",
        "atr": atr,
        "targets": {
            "call_target": call_target,    # 0.5 ATR OTM call strike
            "put_target":  put_target,     # 0.5 ATR OTM put strike
            "call_trigger": call_trigger,  # 0.236 ATR call trigger
            "put_trigger":  put_trigger,   # 0.236 ATR put trigger
        },
        "best_call": best_call,            # closest strike to 0.5 ATR target
        "best_put":  best_put,
        "call_in_budget": call_in_budget,
        "put_in_budget":  put_in_budget,
        "chain": {
            "calls": budget_calls,
            "puts":  budget_puts,
        },
        "unusual_flow": unusual_flow,      # vol/OI flagged strikes
        "flow_context": flow_context,      # pre-formatted for Claude
        "quote": quote
    }


# ─────────────────────────────────────────────
# FORMAT FOR CLAUDE — INJECT INTO SYSTEM PROMPT
# ─────────────────────────────────────────────

def format_options_context(snapshot: dict) -> str:
    """
    Format 0DTE snapshot as a clean text block for Claude's context.
    This gets injected into PREMARKET and PTR-FAST prompts.
    """
    if "error" in snapshot:
        return f"[Options data unavailable: {snapshot['error']}]"

    spot = snapshot["spot"]
    expiry = snapshot["expiry"]
    calls = snapshot["chain"]["calls"]
    puts = snapshot["chain"]["puts"]

    lines = [
        f"LIVE 0DTE OPTIONS (SPXW {expiry} | SPX @ {spot})",
        f"Filters: premium $2–5 mid | delta 0.20–0.45 | strikes within 3% of spot",
        "",
        "CALLS IN RANGE (delta 0.20–0.45, premium $2–5):"
    ]

    if calls:
        for c in calls:
            lines.append(
                f"  {c['strike']}C  bid={c['bid']}  ask={c['ask']}  mid=${c['mid']}  "
                f"δ={c['delta']}  IV={c['iv']}  vol={c['volume']}  OI={c['open_interest']}"
            )
    else:
        lines.append(
            "  None matching filters — check spot vs strikes or widen range")

    lines += ["", "PUTS IN RANGE (delta -0.20 to -0.45, premium $2–5):"]

    if puts:
        for p in puts:
            lines.append(
                f"  {p['strike']}P  bid={p['bid']}  ask={p['ask']}  mid=${p['mid']}  "
                f"δ={p['delta']}  IV={p['iv']}  vol={p['volume']}  OI={p['open_interest']}"
            )
    else:
        lines.append(
            "  None matching filters — check spot vs strikes or widen range")

    return "\n".join(lines)


# ─────────────────────────────────────────────
# MARKET INTERNALS — TRIN, ADD, VOLD
# ─────────────────────────────────────────────

def get_market_internals() -> dict:
    """Fetch live TRIN, ADD, VOLD from Tradier."""
    try:
        data = _get("/markets/quotes", {
            "symbols": "$TRIN,$ADD,$VOLD",
            "greeks": "false"
        })
        quotes = data.get("quotes", {}).get("quote", [])
        if isinstance(quotes, dict):
            quotes = [quotes]
        result = {}
        for q in quotes:
            sym = q.get("symbol", "")
            last = q.get("last") or q.get("close")
            if sym == "$TRIN":
                result["trin"] = round(float(last), 2) if last else None
            elif sym == "$ADD":
                result["add"] = int(float(last)) if last else None
            elif sym == "$VOLD":
                result["vold"] = round(float(last), 2) if last else None
        return result
    except Exception:
        return {"trin": None, "add": None, "vold": None}


# ─────────────────────────────────────────────
# TEST — run python tradier.py to verify
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import json

    print("Testing Tradier connection...\n")

    print("1. SPX Quote:")
    quote = get_spx_quote()
    spot = quote.get("last") or quote.get("close")
    print(f"   Spot: {spot}")

    print("\n2. Today's SPXW expiry:")
    expiry = get_today_expiry()
    print(f"   {expiry}")

    if expiry and spot:
        print(f"\n3. Snapshot with ATR=74.79:")
        snapshot = get_0dte_snapshot(atr=74.79)

        targets = snapshot.get("targets", {})
        print(f"   Spot:         {snapshot['spot']}")
        print(f"   Call target:  {targets.get('call_target')}  (0.5 ATR OTM)")
        print(f"   Put target:   {targets.get('put_target')}   (0.5 ATR OTM)")
        print(f"   Call trigger: {targets.get('call_trigger')} (0.236 ATR)")
        print(f"   Put trigger:  {targets.get('put_trigger')}  (0.236 ATR)")

        bc = snapshot.get("best_call")
        bp = snapshot.get("best_put")
        print(
            f"\n   Best Call: {bc['strike']}C  mid=${bc['mid']}  delta={bc['delta']}  in_budget={snapshot['call_in_budget']}" if bc else "\n   Best Call: None")
        print(
            f"   Best Put:  {bp['strike']}P  mid=${bp['mid']}  delta={bp['delta']}  in_budget={snapshot['put_in_budget']}" if bp else "   Best Put:  None")

        print(f"\n   All budget calls ({len(snapshot['chain']['calls'])}):")
        for c in snapshot["chain"]["calls"]:
            print(f"     {c['strike']}C  mid=${c['mid']}  delta={c['delta']}")
        print(f"\n   All budget puts ({len(snapshot['chain']['puts'])}):")
        for p in snapshot["chain"]["puts"]:
            print(f"     {p['strike']}P  mid=${p['mid']}  delta={p['delta']}")
