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

def _get(endpoint: str, params: dict = {}) -> dict:
    """Make a GET request to Tradier API."""
    try:
        response = requests.get(
            f"{BASE_URL}{endpoint}",
            headers=HEADERS,
            params=params,
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
            "mid": round((opt.get("bid", 0) + opt.get("ask", 0)) / 2, 2),
            "last": opt.get("last"),
            "volume": opt.get("volume"),
            "open_interest": opt.get("open_interest"),
            "iv": opt.get("greeks", {}).get("mid_iv"),
            "delta": opt.get("greeks", {}).get("delta"),
            "gamma": opt.get("greeks", {}).get("gamma"),
            "theta": opt.get("greeks", {}).get("theta"),
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


# ─────────────────────────────────────────────
# MAIN ENTRY POINT — FULL 0DTE SNAPSHOT
# ─────────────────────────────────────────────

def get_0dte_snapshot() -> dict:
    """
    Full 0DTE options snapshot for OpenTheDesk.
    Returns: spot price, expiry, filtered chain (premium in budget), ATR context.
    Call this from market_data.py or directly from endpoints.
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

    # 3. Pull full chain near spot
    chain = get_0dte_chain(expiry, spot, width_pct=0.02)
    if "error" in chain:
        return {"error": f"Chain pull failed: {chain['error']}"}

    # 4. Filter to $3–4 premium budget (with slight buffer)
    budgeted = filter_by_premium(chain, min_prem=2.0, max_prem=5.0)

    return {
        "spot": spot,
        "expiry": expiry,
        "source": "tradier",
        "chain": budgeted,
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
        f"Premium budget filter: $2.00–$5.00 mid | Strikes within 2% of spot",
        "",
        "CALLS IN BUDGET:"
    ]

    if calls:
        for c in calls:
            lines.append(
                f"  {c['strike']}C  bid={c['bid']}  ask={c['ask']}  mid=${c['mid']}  "
                f"δ={c['delta']}  IV={c['iv']}  vol={c['volume']}  OI={c['open_interest']}"
            )
    else:
        lines.append("  None in $2–5 range")

    lines += ["", "PUTS IN BUDGET:"]

    if puts:
        for p in puts:
            lines.append(
                f"  {p['strike']}P  bid={p['bid']}  ask={p['ask']}  mid=${p['mid']}  "
                f"δ={p['delta']}  IV={p['iv']}  vol={p['volume']}  OI={p['open_interest']}"
            )
    else:
        lines.append("  None in $2–5 range")

    return "\n".join(lines)


# ─────────────────────────────────────────────
# TEST — run python tradier.py to verify
# ─────────────────────────────────────────────

if __name__ == "__main__":
    import json

    print("Testing Tradier connection...\n")

    print("1. SPX Quote:")
    quote = get_spx_quote()
    print(json.dumps(quote, indent=2))

    print("\n2. Raw SPXW expirations response:")
    raw_exp = _get("/markets/options/expirations", {
        "symbol": "SPX",
        "includeAllRoots": "true",
        "strikes": "false"
    })
    print(json.dumps(raw_exp, indent=2)[:800])

    print("\n3. Today's SPXW expiry (parsed):")
    expiry = get_today_expiry()
    print(expiry)

    if expiry and "error" not in quote:
        spot = quote.get("last") or quote.get("close")
        print(f"\n4. 0DTE chain near spot ({spot}):")
        chain = get_0dte_chain(expiry, spot)
        print(f"   Calls: {len(chain.get('calls', []))} strikes")
        print(f"   Puts:  {len(chain.get('puts', []))} strikes")

        print("\n5. Full snapshot + premium filter:")
        snapshot = get_0dte_snapshot()
        print(format_options_context(snapshot))
