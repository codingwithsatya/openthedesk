"""
Ticker analysis — price, EMAs, ATR-14 Wilder, fundamentals, IV rank.
Used by /analyze and /screener endpoints.
"""
import os
from datetime import datetime
from typing import Optional
import math

try:
    import yfinance as yf
    _YF = True
except ImportError:
    _YF = False

import requests
from dotenv import load_dotenv

load_dotenv()

_TRADIER_TOKEN = os.environ.get("TRADIER_TOKEN")
_TRADIER_BASE = "https://api.tradier.com/v1"
_TRADIER_HDR = {
    "Authorization": f"Bearer {_TRADIER_TOKEN}",
    "Accept": "application/json",
}


# ── ATR-14 Wilder (same formula as market_data.py) ──────────────────────────

def _wilder_atr(bars: list[dict], period: int = 14) -> Optional[float]:
    """
    ATR-14 Wilder smoothing — matches ta.atr(14) in Pine Script.
    TR = max(H-L, |H-prev_close|, |L-prev_close|)
    Seed: simple average of first `period` TRs; then Wilder smooth.
    """
    if not bars or len(bars) < period + 1:
        return None
    trs = [
        max(
            bars[i]["high"] - bars[i]["low"],
            abs(bars[i]["high"] - bars[i - 1]["close"]),
            abs(bars[i]["low"] - bars[i - 1]["close"]),
        )
        for i in range(1, len(bars))
    ]
    atr = sum(trs[:period]) / period
    for tr in trs[period:]:
        atr = (atr * (period - 1) + tr) / period
    return round(atr, 4)


# ── Tradier helpers (US-only) ────────────────────────────────────────────────

def _tradier_get(path: str, params: dict) -> dict:
    try:
        r = requests.get(
            f"{_TRADIER_BASE}{path}",
            headers=_TRADIER_HDR,
            params=params,
            timeout=8,
        )
        r.raise_for_status()
        return r.json()
    except Exception:
        return {}


def _has_options(ticker: str) -> bool:
    data = _tradier_get("/options/expirations", {"symbol": ticker})
    exps = data.get("expirations", {}).get("date", [])
    return bool(exps)


def _get_iv_rank(ticker: str, spot: float) -> Optional[float]:
    """
    Approximate IV rank 0-100.
    Current IV: nearest-expiry ATM call IV from Tradier.
    52-week range: rolling 4-week realized vol annualised as a proxy.
    """
    try:
        exp_data = _tradier_get(
            "/options/expirations",
            {"symbol": ticker, "includeAllRoots": "true"},
        )
        exps = exp_data.get("expirations", {}).get("date", [])
        if not exps:
            return None
        expiry = exps[0] if isinstance(exps, list) else exps

        chain_data = _tradier_get(
            "/markets/options/chains",
            {"symbol": ticker, "expiration": expiry, "greeks": "true"},
        )
        options = chain_data.get("options", {}).get("option", []) or []
        calls = [o for o in options if o.get("option_type") == "call"]
        if not calls:
            return None

        atm = min(calls, key=lambda o: abs((o.get("strike") or 0) - spot))
        greeks = atm.get("greeks") or {}
        current_iv = greeks.get("smv_vol") or atm.get("implied_volatility")
        if not current_iv:
            return None

        if not _YF:
            return None

        tk = yf.Ticker(ticker)
        hist = tk.history(period="1y")
        if len(hist) < 20:
            return None

        weekly = hist["Close"].resample("W").last().pct_change().dropna()
        if len(weekly) < 10:
            return None
        rolling = weekly.rolling(4).std() * (52 ** 0.5)
        iv_lo = float(rolling.min())
        iv_hi = float(rolling.max())
        if iv_hi <= iv_lo:
            return None

        rank = (float(current_iv) - iv_lo) / (iv_hi - iv_lo) * 100
        return round(min(max(rank, 0), 100), 1)
    except Exception:
        return None


def sanitize(obj):
    """Recursively replace nan/inf with None for JSON safety."""
    if isinstance(obj, float) and (math.isnan(obj) or math.isinf(obj)):
        return None
    if isinstance(obj, dict):
        return {k: sanitize(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    return obj

# ── Main analysis ────────────────────────────────────────────────────────────


def get_ticker_analysis(ticker: str) -> dict:
    """
    Full ticker analysis: price, EMAs, ATR-14, ATR levels, fundamentals.
    Returns a flat dict — all fields present, failures set to None.
    """
    ticker = ticker.strip().upper()
    is_india = ticker.endswith(".NS")
    market = "IN" if is_india else "US"

    result: dict = {
        "ticker":                    ticker,
        "market":                    market,
        "price":                     None,
        "prev_close":                None,
        "change_pct":                None,
        "ema_8":                     None,
        "ema_21":                    None,
        "ema_48":                    None,
        "ema_200":                   None,
        "ribbon_state":              None,
        "atr_14":                    None,
        "atr_levels":                None,
        "week52_high":               None,
        "week52_low":                None,
        "price_vs_52w_high_pct":     None,
        "distance_from_52w_high_pct": None,
        "avg_volume_10d":            None,
        "relative_volume":           None,
        "pe_ratio":                  None,
        "eps_growth_yoy":            None,
        "revenue_growth_yoy":        None,
        "market_cap":                None,
        "sector":                    None,
        "beta":                      None,
        "debt_to_equity":            None,
        "short_interest_pct":        None,
        "earnings_date":             None,
        "days_to_earnings":          None,
    }

    if not _YF:
        result["error"] = "yfinance not installed"
        return sanitize(result)

    try:
        tk = yf.Ticker(ticker)
        hist = tk.history(period="1y")

        if hist.empty:
            result["error"] = "no price data"
            return sanitize(result)

        closes = hist["Close"]
        price = float(closes.iloc[-1])
        prev_close = float(closes.iloc[-2]) if len(closes) >= 2 else price

        result["price"] = round(price, 2)
        result["prev_close"] = round(prev_close, 2)
        if prev_close:
            result["change_pct"] = round(
                (price - prev_close) / prev_close * 100, 2)

        # EMAs
        result["ema_8"] = round(
            float(closes.ewm(span=8,   adjust=False).mean().iloc[-1]), 2)
        result["ema_21"] = round(
            float(closes.ewm(span=21,  adjust=False).mean().iloc[-1]), 2)
        result["ema_48"] = round(
            float(closes.ewm(span=48,  adjust=False).mean().iloc[-1]), 2)
        result["ema_200"] = round(
            float(closes.ewm(span=200, adjust=False).mean().iloc[-1]), 2)

        e8, e21, e48 = result["ema_8"], result["ema_21"], result["ema_48"]
        if e8 >= e21 >= e48:
            result["ribbon_state"] = "BULLISH"
        elif e8 <= e21 <= e48:
            result["ribbon_state"] = "BEARISH"
        else:
            result["ribbon_state"] = "MIXED"

        # ATR-14 Wilder
        bars = [
            {
                "high":  float(hist["High"].iloc[i]),
                "low":   float(hist["Low"].iloc[i]),
                "close": float(hist["Close"].iloc[i]),
            }
            for i in range(len(hist))
        ]
        atr = _wilder_atr(bars, 14)
        result["atr_14"] = atr

        # Volume
        try:
            vol_today = float(hist["Volume"].iloc[-1])
            avg_vol   = float(hist["Volume"].tail(10).mean())
            result["avg_volume_10d"] = round(avg_vol)
            if avg_vol > 0:
                result["relative_volume"] = round(vol_today / avg_vol, 2)
        except Exception:
            pass

        if atr:
            pdc = prev_close
            result["atr_levels"] = {
                "trigger_up":       round(pdc + atr * 0.236, 2),
                "gg_open_up":       round(pdc + atr * 0.382, 2),
                "gg_complete_up":   round(pdc + atr * 0.618, 2),
                "full_atr_up":      round(pdc + atr * 1.000, 2),
                "trigger_down":     round(pdc - atr * 0.236, 2),
                "gg_open_down":     round(pdc - atr * 0.382, 2),
                "gg_complete_down": round(pdc - atr * 0.618, 2),
                "full_atr_down":    round(pdc - atr * 1.000, 2),
            }

        # Fundamentals
        try:
            info = tk.info or {}
            result["pe_ratio"] = info.get("trailingPE")
            result["sector"]   = info.get("sector")
            result["beta"]     = info.get("beta")
            result["debt_to_equity"] = info.get("debtToEquity")

            mc = info.get("marketCap")
            result["market_cap"] = round(mc / 1e9, 1) if mc else None

            eps = info.get("trailingEps")
            fwd = info.get("forwardEps")
            if eps and fwd and eps != 0:
                result["eps_growth_yoy"] = round((fwd - eps) / abs(eps) * 100, 1)

            rg = info.get("revenueGrowth")
            if rg is not None:
                result["revenue_growth_yoy"] = round(rg * 100, 1)

            si = info.get("shortPercentOfFloat")
            if si is not None:
                result["short_interest_pct"] = round(si * 100, 1)

            w52h = info.get("fiftyTwoWeekHigh")
            w52l = info.get("fiftyTwoWeekLow")
            result["week52_high"] = w52h
            result["week52_low"]  = w52l
            if w52h and w52h > 0:
                pct = round((price - w52h) / w52h * 100, 1)
                result["price_vs_52w_high_pct"]      = pct
                result["distance_from_52w_high_pct"] = round(abs(pct), 1)
        except Exception:
            pass

        # Earnings date
        try:
            earn_df = tk.earnings_dates
            if earn_df is not None and not earn_df.empty:
                today = datetime.now().date()
                future = sorted([
                    idx.date()
                    for idx in earn_df.index
                    if hasattr(idx, "date") and idx.date() > today
                ])
                if future:
                    next_earn = future[0]
                    result["earnings_date"] = next_earn.strftime("%b %d %Y")
                    result["days_to_earnings"] = (next_earn - today).days
        except Exception:
            pass

    except Exception as e:
        result["error"] = str(e)
        return sanitize(result)

    # US-only: options data via Tradier
    if market == "US" and _TRADIER_TOKEN:
        try:
            # all US watchlist stocks are optionable
            result["has_options"] = True
            if result.get("price"):
                result["iv_rank"] = _get_iv_rank(ticker, result["price"])
            else:
                result["iv_rank"] = None
        except Exception:
            result["has_options"] = True
            result["iv_rank"] = None

    return sanitize(result)
