import os
import yfinance as yf
from datetime import date
from dotenv import load_dotenv

load_dotenv()


def get_spx_price() -> dict:
    """Get SPX data using Yahoo Finance."""
    try:
        spx = yf.Ticker("^GSPC")
        hist = spx.history(period="2d")
        if hist.empty:
            return {"error": "No SPX data"}
        last = hist.iloc[-1]
        prev = hist.iloc[-2] if len(hist) > 1 else hist.iloc[-1]
        return {
            "symbol": "SPX",
            "close": round(float(last["Close"]), 2),
            "open": round(float(last["Open"]), 2),
            "high": round(float(last["High"]), 2),
            "low": round(float(last["Low"]), 2),
            "pdc": round(float(prev["Close"]), 2),
            "pdh": round(float(prev["High"]), 2),
            "pdl": round(float(prev["Low"]), 2),
            "date": str(hist.index[-1].date())
        }
    except Exception as e:
        return {"error": str(e)}


def get_vix() -> dict:
    """Get VIX data using Yahoo Finance."""
    try:
        vix = yf.Ticker("^VIX")
        hist = vix.history(period="2d")
        if hist.empty:
            return {"error": "No VIX data"}
        last = hist.iloc[-1]
        return {
            "vix": round(float(last["Close"]), 2),
            "vix_high": round(float(last["High"]), 2),
            "vix_low": round(float(last["Low"]), 2),
            "date": str(hist.index[-1].date())
        }
    except Exception as e:
        return {"error": str(e)}


def calculate_atr_levels(pdc: float, atr: float) -> dict:
    """Calculate Saty ATR levels from PDC and ATR value."""
    return {
        "PDC": round(pdc, 2),
        "ATR": round(atr, 2),
        "call_trigger":     round(pdc + atr * 0.236, 2),
        "gg_open_call":     round(pdc + atr * 0.382, 2),
        "gg_complete_call": round(pdc + atr * 0.618, 2),
        "full_atr_call":    round(pdc + atr * 1.0,   2),
        "put_trigger":      round(pdc - atr * 0.236, 2),
        "gg_open_put":      round(pdc - atr * 0.382, 2),
        "gg_complete_put":  round(pdc - atr * 0.618, 2),
        "full_atr_put":     round(pdc - atr * 1.0,   2),
        "probabilities": {
            "trigger_to_gg_open":     "80%",
            "gg_open_to_complete":    "69%",
            "bilbo_bear_low_falling": "90.2%",
            "bilbo_bull_high_rising": "77.7%"
        }
    }


def get_market_summary(atr_override: float = None) -> dict:
    """Full market summary — SPX + VIX + ATR levels."""
    spx = get_spx_price()
    vix = get_vix()

    result = {"spx": spx, "vix": vix}

    if "pdc" in spx and "high" in spx and "low" in spx:
        pdc = spx["pdc"]
        # Use Saty ATR if provided, else approximate from prior day range
        atr = atr_override if atr_override else round(
            spx["high"] - spx["low"], 2)
        result["atr_levels"] = calculate_atr_levels(pdc, atr)
        result["atr_source"] = "saty_indicator" if atr_override else "approx_hl"
        result["note"] = "ATR from Saty indicator." if atr_override else "ATR approximated from prior day range. Use Saty ATR indicator for exact value."

    return result


if __name__ == "__main__":
    import json
    print("Market summary:")
    summary = get_market_summary()
    print(json.dumps(summary, indent=2))
