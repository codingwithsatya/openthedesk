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


def _fetch_history(interval: str, lookback_days: int) -> list[dict] | None:
    """
    Shared Tradier history fetcher used by both ATR functions.
    Returns a list of OHLC bars or None on failure.
    """
    end = str(date.today())
    start = str(date.today() - timedelta(days=lookback_days))
    try:
        response = requests.get(
            f"{BASE_URL}/markets/history",
            headers=HEADERS,
            params={"symbol": "SPX", "interval": interval, "start": start, "end": end},
            timeout=10
        )
        response.raise_for_status()
        bars = response.json().get("history", {}).get("day", [])
        if isinstance(bars, dict):
            bars = [bars]
        return bars if bars else None
    except Exception:
        return None


def _wilder_atr(bars: list[dict], period: int = 14) -> float | None:
    """
    ATR-14 Wilder smoothing — matches ta.atr(14) in Pine Script exactly.
    TR = max(high-low, |high-prev_close|, |low-prev_close|)
    Seed: simple average of first `period` TRs.
    Smooth: atr = (prev_atr * (period-1) + current_tr) / period
    Returns None if not enough bars.
    """
    if not bars or len(bars) < period + 1:
        return None

    trs = [
        max(
            bars[i]["high"] - bars[i]["low"],
            abs(bars[i]["high"] - bars[i - 1]["close"]),
            abs(bars[i]["low"]  - bars[i - 1]["close"]),
        )
        for i in range(1, len(bars))
    ]

    # Seed with simple average of first `period` TRs
    atr = sum(trs[:period]) / period
    # Wilder smoothing for the remainder
    for tr in trs[period:]:
        atr = (atr * (period - 1) + tr) / period

    return round(atr, 2)


def get_saty_atr() -> float | None:
    """
    ATR-14 Wilder on daily bars — matches Saty Pine Script ta.atr(14), Day mode.
    Fetches 60 calendar days (~42 trading days) so Wilder has enough bars to converge.
    Returns None on any failure so callers degrade gracefully.
    """
    bars = _fetch_history(interval="daily", lookback_days=60)
    return _wilder_atr(bars, period=14)


def get_saty_atr_multiday() -> float | None:
    """
    ATR-14 Wilder on weekly bars — matches Saty Pine Script ta.atr(14), Multiday mode.
    Fetches ~280 calendar days (~40 weekly bars) for Wilder convergence.
    Returns None on any failure so callers degrade gracefully.
    """
    bars = _fetch_history(interval="weekly", lookback_days=280)
    return _wilder_atr(bars, period=14)


def get_market_summary(atr_override: float = None, trading_mode: str = "day") -> dict:
    """Full market summary — SPX + VIX + ATR levels. Single source: Tradier."""
    spx = get_spx_data()
    vix = get_vix_data()

    result = {"spx": spx, "vix": vix, "trading_mode": trading_mode}

    pdc = spx.get("pdc")
    if pdc:
        if atr_override:
            # Manual entry always wins regardless of mode
            atr = atr_override
            atr_source = "saty_indicator"
            note = "ATR from Saty indicator — exact levels."
        else:
            # Auto-calculate using the correct ATR for the selected mode
            auto_atr = get_saty_atr_multiday() if trading_mode == "multiday" else get_saty_atr()
            if auto_atr:
                atr = auto_atr
                atr_source = "atr14_wilder_weekly" if trading_mode == "multiday" else "atr14_wilder"
                note = f"ATR-14 Wilder ({'weekly' if trading_mode == 'multiday' else 'daily'} bars) — matches Saty Pine Script."
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
    print("\n=== Day mode (ATR-14 Wilder daily) ===")
    print(json.dumps(get_market_summary(), indent=2))
    print("\n=== Multiday mode (ATR-14 Wilder weekly) ===")
    result = get_market_summary(trading_mode="multiday")
    print(f"  atr_source: {result.get('atr_source')}")
    print(f"  ATR:        {result.get('atr_levels', {}).get('ATR')}")
