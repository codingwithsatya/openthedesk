import os
import requests
from datetime import date, timedelta
from dotenv import load_dotenv

load_dotenv()

TRADIER_TOKEN = os.environ.get("TRADIER_TOKEN")
BASE_URL = "https://api.tradier.com/v1"
HEADERS = {
    "Authorization": f"Bearer {TRADIER_TOKEN}",
    "Accept": "application/json"
}


def get_spx_data() -> dict:
    """Get SPX OHLC + previous close from Tradier."""
    try:
        response = requests.get(
            f"{BASE_URL}/markets/quotes",
            headers=HEADERS,
            params={"symbols": "SPX", "greeks": "false"},
            timeout=10
        )
        response.raise_for_status()
        quote = response.json()["quotes"]["quote"]
        return {
            "symbol": "SPX",
            "last":  quote.get("last"),
            "open":  quote.get("open"),
            "high":  quote.get("high"),
            "low":   quote.get("low"),
            "close": quote.get("close"),        # today's close (null intraday)
            # previous day close ← key field
            "pdc":   quote.get("prevclose"),
            "source": "tradier"
        }
    except Exception as e:
        return {"error": str(e)}


def get_vix_data() -> dict:
    """Get VIX from Tradier."""
    try:
        response = requests.get(
            f"{BASE_URL}/markets/quotes",
            headers=HEADERS,
            params={"symbols": "VIX", "greeks": "false"},
            timeout=10
        )
        response.raise_for_status()
        quote = response.json()["quotes"]["quote"]
        return {
            "vix":      quote.get("last"),
            "vix_high": quote.get("high"),
            "vix_low":  quote.get("low"),
            "source":   "tradier"
        }
    except Exception as e:
        return {"error": str(e)}


def calculate_atr_levels(pdc: float, atr: float) -> dict:
    """Calculate all 11 Saty ATR levels from PDC and ATR value."""
    return {
        "PDC":              round(pdc, 2),
        "ATR":              round(atr, 2),
        # Call side
        "call_trigger":     round(pdc + atr * 0.236, 2),
        "gg_open_call":     round(pdc + atr * 0.382, 2),
        "gg_50_call":       round(pdc + atr * 0.500, 2),
        "gg_complete_call": round(pdc + atr * 0.618, 2),
        "full_atr_call":    round(pdc + atr * 1.000, 2),
        # Put side
        "put_trigger":      round(pdc - atr * 0.236, 2),
        "gg_open_put":      round(pdc - atr * 0.382, 2),
        "gg_50_put":        round(pdc - atr * 0.500, 2),
        "gg_complete_put":  round(pdc - atr * 0.618, 2),
        "full_atr_put":     round(pdc - atr * 1.000, 2),
        "probabilities": {
            "trigger_to_gg_open":     "80%",
            "gg_open_to_complete":    "69%",
            "bilbo_bear_low_falling": "90.2%",
            "bilbo_bull_high_rising": "77.7%"
        }
    }


def get_saty_atr(period: int = 10) -> float | None:
    """
    Auto-calculate Saty ATR-10 Simple from Tradier daily history.
    Formula: simple average of the last 10 True Ranges.
    TR = max(high-low, |high-prev_close|, |low-prev_close|)
    Returns None on any fetch or parse failure so caller can fall back gracefully.
    """
    end = str(date.today())
    start = str(date.today() - timedelta(days=30))  # ~30 calendar days → 20+ trading days

    try:
        response = requests.get(
            f"{BASE_URL}/markets/history",
            headers=HEADERS,
            params={"symbol": "SPX", "interval": "daily", "start": start, "end": end},
            timeout=10
        )
        response.raise_for_status()
        days = response.json().get("history", {}).get("day", [])
        if isinstance(days, dict):
            days = [days]
        if len(days) < period + 1:
            return None

        trs = [
            max(
                days[i]["high"] - days[i]["low"],
                abs(days[i]["high"] - days[i - 1]["close"]),
                abs(days[i]["low"]  - days[i - 1]["close"]),
            )
            for i in range(1, len(days))
        ]
        return round(sum(trs[-period:]) / period, 2)

    except Exception:
        return None


def get_market_summary(atr_override: float = None) -> dict:
    """Full market summary — SPX + VIX + ATR levels. Single source: Tradier."""
    spx = get_spx_data()
    vix = get_vix_data()

    result = {"spx": spx, "vix": vix}

    pdc = spx.get("pdc")
    if pdc:
        if atr_override:
            # Manual entry always wins
            atr = atr_override
            atr_source = "saty_indicator"
            note = "ATR from Saty indicator — exact levels."
        else:
            # Auto-calculate ATR-10 Simple from Tradier history
            auto_atr = get_saty_atr()
            if auto_atr:
                atr = auto_atr
                atr_source = "auto_atr10"
                note = "ATR-10 Simple auto-calculated from Tradier history."
            else:
                # Last-resort fallback: today's H-L range
                high = spx.get("high", 0)
                low = spx.get("low", 0)
                atr = round(high - low, 2) if high and low else 0
                atr_source = "approx_hl"
                note = "ATR approximated from day range (history unavailable)."

        result["atr_levels"] = calculate_atr_levels(pdc, atr)
        result["atr_source"] = atr_source
        result["note"] = note

    return result


if __name__ == "__main__":
    import json
    print(json.dumps(get_market_summary(), indent=2))
