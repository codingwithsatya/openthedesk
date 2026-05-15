"""
Ticker analysis — price, EMAs, ATR-14 Wilder, fundamentals, IV rank.
Used by /analyze and /screener endpoints.
"""
import os
from datetime import datetime, date
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
    data = _tradier_get("/markets/options/expirations",
                        {"symbol": ticker, "includeAllRoots": "true"})
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
            "/markets/options/expirations",
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


def get_options_chain_for_analysis(
    ticker: str,
    trading_mode: str,
    spot_price: float,
    atr_14: float,
) -> Optional[dict]:
    """
    Fetch real options chain from Tradier.
    Selects expiry based on trading_mode, returns target call/put + debit spreads.
    Returns None on any failure.
    """
    try:
        # Step 1 — expiry dates
        exp_data = _tradier_get(
            "/markets/options/expirations",
            {"symbol": ticker, "includeAllRoots": "true"},
        )
        raw_exps = exp_data.get("expirations", {}).get("date", [])
        if not raw_exps:
            return None
        if isinstance(raw_exps, str):
            raw_exps = [raw_exps]

        # Step 2 — select target expiry
        today = date.today()
        min_days = {"day": 7, "multiday": 21, "swing": 35,
                    "position": 60}.get(trading_mode, 7)

        future_exps: list[date] = []
        for d in raw_exps:
            try:
                future_exps.append(datetime.strptime(d, "%Y-%m-%d").date())
            except Exception:
                continue
        future_exps = sorted(e for e in future_exps if e > today)
        if not future_exps:
            return None

        target_exp = next(
            (e for e in future_exps if (e - today).days >= min_days),
            future_exps[-1],
        )
        expiry_str = target_exp.strftime("%Y-%m-%d")
        days_to_expiry = (target_exp - today).days

        # Step 3 — fetch chain
        chain_data = _tradier_get(
            "/markets/options/chains",
            {"symbol": ticker, "expiration": expiry_str, "greeks": "true"},
        )
        options = chain_data.get("options", {}).get("option", []) or []
        if not options:
            return None

        calls = [o for o in options if o.get("option_type") == "call"]
        puts = [o for o in options if o.get("option_type") == "put"]
        if not calls or not puts:
            return None

        # Step 4 — contract extractor
        def _extract(contract: dict) -> dict:
            g = contract.get("greeks") or {}
            bid = float(contract.get("bid") or 0)
            ask = float(contract.get("ask") or 0)
            mid = round((bid + ask) / 2, 2)
            iv = g.get("smv_vol") or contract.get("implied_volatility")
            dlt = g.get("delta")
            tht = g.get("theta")
            return {
                "strike":             float(contract.get("strike") or 0),
                "expiration":         contract.get("expiration_date") or expiry_str,
                "days_to_expiry":     days_to_expiry,
                "bid":                bid,
                "ask":                ask,
                "mid":                mid,
                "volume":             int(contract.get("volume") or 0),
                "open_interest":      int(contract.get("open_interest") or 0),
                "implied_volatility": round(float(iv), 4) if iv is not None else None,
                "delta":              round(float(dlt), 4) if dlt is not None else None,
                "theta":              round(float(tht), 4) if tht is not None else None,
                "in_budget":          1.50 <= mid <= 4.00,
            }

        # Target strikes
        t_call = spot_price + 0.5 * atr_14
        t_put = spot_price - 0.5 * atr_14
        s_call = spot_price + 2.0 * atr_14   # short leg of call spread
        s_put = spot_price - 2.0 * atr_14   # short leg of put spread

        best_call = min(calls, key=lambda o: abs(
            (o.get("strike") or 0) - t_call))
        best_put = min(puts,  key=lambda o: abs(
            (o.get("strike") or 0) - t_put))
        short_call = min(calls, key=lambda o: abs(
            (o.get("strike") or 0) - s_call))
        short_put = min(puts,  key=lambda o: abs(
            (o.get("strike") or 0) - s_put))

        tc = _extract(best_call)
        tp = _extract(best_put)
        sc = _extract(short_call)
        sp = _extract(short_put)

        # Step 5 — spreads
        cs_cost = round(tc["mid"] - sc["mid"], 2)
        cs_profit = round((sc["strike"] - tc["strike"]) - cs_cost, 2)
        ps_cost = round(tp["mid"] - sp["mid"], 2)
        ps_profit = round((tp["strike"] - sp["strike"]) - ps_cost, 2)

        # IV environment from ATM call
        atm_call = min(calls, key=lambda o: abs(
            (o.get("strike") or 0) - spot_price))
        atm_iv = (atm_call.get("greeks") or {}).get(
            "smv_vol") or atm_call.get("implied_volatility") or 0
        atm_iv = float(atm_iv)
        iv_env = (
            "EXTREME" if atm_iv >= 0.70 else
            "HIGH" if atm_iv >= 0.50 else
            "MODERATE" if atm_iv >= 0.30 else
            "LOW"
        )

        return {
            "expiry":         expiry_str,
            "days_to_expiry": days_to_expiry,
            "target_call":    tc,
            "target_put":     tp,
            "call_spread": {
                "long_strike":       tc["strike"],
                "short_strike":      sc["strike"],
                "long_mid":          tc["mid"],
                "short_mid":         sc["mid"],
                "spread_cost":       cs_cost,
                "spread_max_profit": cs_profit,
                "expiration":        expiry_str,
            },
            "put_spread": {
                "long_strike":       tp["strike"],
                "short_strike":      sp["strike"],
                "long_mid":          tp["mid"],
                "short_mid":         sp["mid"],
                "spread_cost":       ps_cost,
                "spread_max_profit": ps_profit,
                "expiration":        expiry_str,
            },
            "iv_environment": iv_env,
        }

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


# trading_mode → yfinance history kwargs
_HISTORY_PARAMS: dict[str, dict] = {
    "day":      {"period": "1y",  "interval": "1d"},
    "multiday": {"period": "2y",  "interval": "1wk"},
    "swing":    {"period": "5y",  "interval": "1mo"},
    "position": {"period": "10y", "interval": "3mo"},
}


def _po_zone(val: float) -> str:
    if val >= 100:
        return "EXTREME_UP"
    if val >= 61.8:
        return "DISTRIBUTION"
    if val >= 23.6:
        return "NEUTRAL_UP"
    if val >= -23.6:
        return "NEUTRAL"
    if val >= -61.8:
        return "NEUTRAL_DOWN"
    if val >= -100:
        return "ACCUMULATION"
    return "EXTREME_DOWN"


def _build_atr_levels(pdc: float, atr: float) -> dict:
    """Full Fibonacci ATR levels — core + extensions to 3×ATR."""
    def _l(mult: float) -> float:
        return round(pdc + atr * mult, 2)

    return {
        # Core upside
        "trigger_up":      _l(0.236),
        "gg_open_up":      _l(0.382),
        "half_up":         _l(0.500),
        "gg_complete_up":  _l(0.618),
        "full_atr_up":     _l(1.000),
        # Extension upside
        "ext_1236_up":     _l(1.236),
        "ext_1618_up":     _l(1.618),
        "ext_2000_up":     _l(2.000),
        "ext_2236_up":     _l(2.236),
        "ext_2618_up":     _l(2.618),
        "ext_3000_up":     _l(3.000),
        # Core downside
        "trigger_down":    _l(-0.236),
        "gg_open_down":    _l(-0.382),
        "half_down":       _l(-0.500),
        "gg_complete_down": _l(-0.618),
        "full_atr_down":   _l(-1.000),
        # Extension downside
        "ext_1236_down":   _l(-1.236),
        "ext_1618_down":   _l(-1.618),
        "ext_2000_down":   _l(-2.000),
        "ext_2236_down":   _l(-2.236),
        "ext_2618_down":   _l(-2.618),
        "ext_3000_down":   _l(-3.000),
    }


# ── Main analysis ────────────────────────────────────────────────────────────

def get_ticker_analysis(ticker: str, trading_mode: str = "day") -> dict:
    """
    Full ticker analysis: price, EMAs (8/13/21/34/48/200), ATR-14, ATR levels,
    Phase Oscillator, compression, fundamentals.
    trading_mode: "day" | "multiday" | "swing" | "position"
    Returns a flat dict — all fields present, failures set to None.
    """
    ticker = ticker.strip().upper()
    is_india = ticker.endswith(".NS")
    market = "IN" if is_india else "US"

    hist_kwargs = _HISTORY_PARAMS.get(trading_mode, _HISTORY_PARAMS["day"])

    result: dict = {
        "ticker":                     ticker,
        "market":                     market,
        "trading_mode":               trading_mode,
        "price":                      None,
        "prev_close":                 None,
        "change_pct":                 None,
        # Saty Pivot Ribbon Pro EMAs
        "ema_8":                      None,
        "ema_13":                     None,   # conviction EMA
        "ema_21":                     None,
        "ema_34":                     None,   # ribbon EMA (8/21/34)
        "ema_48":                     None,   # bias + conviction EMA
        "ema_200":                    None,
        # Ribbon / bias / conviction
        # BULLISH / BEARISH / MIXED (8/21/34)
        "ribbon_state":               None,
        # BULLISH_CONVICTION / BEARISH_CONVICTION (13 vs 48)
        "conviction_state":           None,
        # BULLISH_BIAS / BEARISH_BIAS (price vs 48)
        "candle_bias":                None,
        # ATR
        "atr_14":                     None,
        "atr_levels":                 None,
        # Phase Oscillator
        "po_value":                   None,
        "po_zone":                    None,
        "compression":                None,
        # Volume
        "avg_volume_10d":             None,
        "relative_volume":            None,
        # 52-week
        "week52_high":                None,
        "week52_low":                 None,
        "price_vs_52w_high_pct":      None,
        "distance_from_52w_high_pct": None,
        # Fundamentals
        "pe_ratio":                   None,
        "eps_growth_yoy":             None,
        "revenue_growth_yoy":         None,
        "market_cap":                 None,
        "sector":                     None,
        "beta":                       None,
        "debt_to_equity":             None,
        "short_interest_pct":         None,
        "earnings_date":              None,
        "days_to_earnings":           None,
        "options_chain":              None,
    }

    if not _YF:
        result["error"] = "yfinance not installed"
        return sanitize(result)

    try:
        tk = yf.Ticker(ticker)
        hist = tk.history(**hist_kwargs)

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

        # ── EMAs (8, 13, 21, 34, 48, 200) ───────────────────────────────────
        def _ema(span: int) -> float:
            return round(float(closes.ewm(span=span, adjust=False).mean().iloc[-1]), 2)

        result["ema_8"] = _ema(8)
        result["ema_13"] = _ema(13)
        result["ema_21"] = _ema(21)
        result["ema_34"] = _ema(34)
        result["ema_48"] = _ema(48)
        result["ema_200"] = _ema(200)

        # Ribbon state: Saty Pivot Ribbon Pro uses 8/21/34
        e8, e21, e34 = result["ema_8"], result["ema_21"], result["ema_34"]
        if e8 >= e21 >= e34:
            result["ribbon_state"] = "BULLISH"
        elif e8 <= e21 <= e34:
            result["ribbon_state"] = "BEARISH"
        else:
            result["ribbon_state"] = "MIXED"

        # Conviction: EMA 13 vs EMA 48 crossover (Pine Script conviction arrow)
        e13, e48 = result["ema_13"], result["ema_48"]
        result["conviction_state"] = (
            "BULLISH_CONVICTION" if e13 >= e48 else "BEARISH_CONVICTION"
        )

        # Candle bias: price vs EMA 48
        result["candle_bias"] = (
            "BULLISH_BIAS" if price >= e48 else "BEARISH_BIAS"
        )

        # ── ATR-14 Wilder ────────────────────────────────────────────────────
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

        # ── Volume ────────────────────────────────────────────────────────────
        try:
            vol_today = float(hist["Volume"].iloc[-1])
            avg_vol = float(hist["Volume"].tail(10).mean())
            result["avg_volume_10d"] = round(avg_vol)
            if avg_vol > 0:
                result["relative_volume"] = round(vol_today / avg_vol, 2)
        except Exception:
            pass

        # ── ATR levels (full Fibonacci + extensions) ─────────────────────────
        if atr:
            result["atr_levels"] = _build_atr_levels(prev_close, atr)

        # ── Phase Oscillator + compression ───────────────────────────────────
        if atr:
            try:
                e21_val = result["ema_21"]
                po_val = round(((price - e21_val) / (3.0 * atr)) * 100, 1)
                result["po_value"] = po_val
                result["po_zone"] = _po_zone(po_val)

                # Bollinger compression: bband_up vs ema_21 + 2×ATR
                std_21 = float(closes.rolling(21).std(ddof=1).iloc[-1])
                bband_up = e21_val + 2.0 * std_21
                threshold_up = e21_val + 2.0 * atr
                result["compression"] = (bband_up - threshold_up) <= 0
            except Exception:
                pass

        # ── Fundamentals ─────────────────────────────────────────────────────
        try:
            info = tk.info or {}
            result["pe_ratio"] = info.get("trailingPE")
            result["sector"] = info.get("sector")
            result["beta"] = info.get("beta")
            result["debt_to_equity"] = info.get("debtToEquity")

            mc = info.get("marketCap")
            result["market_cap"] = round(mc / 1e9, 1) if mc else None

            eps = info.get("trailingEps")
            fwd = info.get("forwardEps")
            if eps and fwd and eps != 0:
                result["eps_growth_yoy"] = round(
                    (fwd - eps) / abs(eps) * 100, 1)

            rg = info.get("revenueGrowth")
            if rg is not None:
                result["revenue_growth_yoy"] = round(rg * 100, 1)

            si = info.get("shortPercentOfFloat")
            if si is not None:
                result["short_interest_pct"] = round(si * 100, 1)

            w52h = info.get("fiftyTwoWeekHigh")
            w52l = info.get("fiftyTwoWeekLow")
            result["week52_high"] = w52h
            result["week52_low"] = w52l
            if w52h and w52h > 0:
                pct = round((price - w52h) / w52h * 100, 1)
                result["price_vs_52w_high_pct"] = pct
                result["distance_from_52w_high_pct"] = round(abs(pct), 1)
        except Exception:
            pass

        # ── Earnings date ─────────────────────────────────────────────────────
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

    # ── US-only: options / IV rank via Tradier ────────────────────────────────
    if market == "US" and _TRADIER_TOKEN:
        try:
            result["has_options"] = True
            result["options_chain"] = get_options_chain_for_analysis(
                ticker, trading_mode, result["price"], result["atr_14"]
            )
            result["iv_rank"] = _get_iv_rank(ticker, result["price"])
        except Exception as e:
            print(f"[analyzer] US options error: {e}")
            result["has_options"] = True
            result["iv_rank"] = None

    return sanitize(result)
