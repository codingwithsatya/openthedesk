import asyncio
import json
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse as FastAPIStreaming

import backend.app.core.state as _state
from backend.app.core.auth import get_current_user
from backend.app.core.config import _sb, TV_WEBHOOK_SECRET
from backend.app.models.challenge import AlertReadPayload

router = APIRouter()


async def _handle_internals(data: dict) -> dict:
    """Handle OTD Internals Heartbeat payload — updates INTERNALS_CACHE only."""
    def _sf(v):
        try:
            return round(float(v), 4) if v is not None else None
        except (ValueError, TypeError):
            return None

    bias_raw = data.get("bias")
    _state.INTERNALS_CACHE = {
        "type":        "internals",
        "signal":      "INTERNALS",
        "ticker":      data.get("ticker", "SPX"),
        "timeframe":   data.get("timeframe", "3"),
        "trin":        _sf(data.get("trin")),
        "add":         _sf(data.get("add")),
        "vold":        _sf(data.get("vold")),
        "pcc":         _sf(data.get("pcc")),
        "bias":        bias_raw.strip().upper() if bias_raw else None,
        "received_at": datetime.now(timezone.utc).isoformat(),
        "source":      "tradingview",
    }
    return {"status": "ok", "cached": _state.INTERNALS_CACHE}


async def _handle_trade_alert(data: dict) -> dict:
    """Handle Manual Planner v3.3.2 and ATR Clean backup alerts.

    Pine Script computes entry/t1/t2/t3/sl/trail_sl — use directly, no recalc.
    """
    def _sf(v):
        try:
            return float(v) if v is not None else None
        except (ValueError, TypeError):
            return None

    signal = (data.get("signal") or "").upper()
    direction = (data.get("direction") or "").upper()
    setup = data.get("setup", "")
    condition_str = (data.get("condition") or "").upper()

    if signal in ("EXIT", "STOP") or "REVERSAL" in condition_str:
        display_type = "stop"
    elif signal == "ENTRY":
        display_type = "entry"
    elif signal in ("TRAIL", "TARGET"):
        display_type = "update"
    else:
        display_type = None

    internals_snapshot = None
    internals_age = None
    if _state.INTERNALS_CACHE.get("received_at"):
        internals_snapshot = _state.INTERNALS_CACHE.copy()
        try:
            received = datetime.fromisoformat(_state.INTERNALS_CACHE["received_at"])
            internals_age = round(
                (datetime.now(timezone.utc) - received).total_seconds()
            )
        except Exception:
            pass

    alert = {
        "id":                    str(uuid.uuid4()),
        "ts":                    datetime.now(timezone.utc).isoformat(),
        "ticker":                data.get("ticker"),
        "timeframe":             data.get("timeframe"),
        "condition":             data.get("condition"),
        "price":                 data.get("price"),
        "signal":                signal,
        "display_type":          display_type,
        "setup":                 setup,
        "grade":                 data.get("grade"),
        "direction":             direction,
        "atr_level":             data.get("atr_level"),
        "entry":                 _sf(data.get("entry")),
        "t1":                    _sf(data.get("t1")),
        "t2":                    _sf(data.get("t2")),
        "t3":                    _sf(data.get("t3")),
        "sl":                    _sf(data.get("sl")),
        "trail_sl":              _sf(data.get("trail_sl")),
        "internals":             internals_snapshot,
        "internals_age_seconds": internals_age,
    }

    is_atr_backup = setup in ("ATR_TARGET", "ATR_STOP")

    if signal == "ENTRY" and direction in ("BULL", "BEAR") and not is_atr_backup:
        entry = alert["entry"] or _sf(data.get("price"))
        t1 = alert["t1"]
        t2 = alert["t2"]
        t3 = alert["t3"]
        sl = alert["sl"]

        if entry and t1:
            def _pts(target):
                return round(abs(target - entry), 2) if target is not None else None

            alert["trade_plan"] = {
                "entry":     entry,
                "direction": direction,
                "t1":        t1,       "t1_pts": _pts(t1),  "t1_label": "GG Open — Scale 50%",
                "t2":        t2,       "t2_pts": _pts(t2),  "t2_label": "GG Complete — Scale 25%",
                "t3":        t3,       "t3_pts": _pts(t3),  "t3_label": "Full Extension — Exit All",
                "sl":        sl,       "sl_pts": _pts(sl),
                "trail_sl":  alert["trail_sl"],
            }

    _state.TV_ALERTS.insert(0, alert)
    if len(_state.TV_ALERTS) > 50:
        _state.TV_ALERTS.pop()
    for q in set(_state.ALERT_SUBSCRIBERS):
        q.put_nowait(alert)

    if _sb:
        try:
            _sb.table("tv_alerts").upsert({
                "alert_id":              alert["id"],
                "ts":                    alert["ts"],
                "ticker":                alert.get("ticker"),
                "timeframe":             alert.get("timeframe"),
                "condition":             alert.get("condition"),
                "price":                 alert.get("price"),
                "signal":                alert.get("signal"),
                "display_type":          alert.get("display_type"),
                "setup":                 alert.get("setup"),
                "grade":                 alert.get("grade"),
                "direction":             alert.get("direction"),
                "atr_level":             alert.get("atr_level"),
                "entry":                 alert.get("entry"),
                "t1":                    alert.get("t1"),
                "t2":                    alert.get("t2"),
                "t3":                    alert.get("t3"),
                "sl":                    alert.get("sl"),
                "trail_sl":              alert.get("trail_sl"),
                "internals":             alert.get("internals"),
                "internals_age_seconds": alert.get("internals_age_seconds"),
                "trade_plan":            alert.get("trade_plan"),
            }, on_conflict="alert_id").execute()
        except Exception as _e:
            print(f"[WARN] tv_alerts insert failed: {_e}")

    return {"status": "received", "id": alert["id"]}


@router.post("/webhook/tv")
async def webhook_tv(request: Request):
    try:
        body = await request.body()
        data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON")

    x_tv_secret = request.headers.get("x-tv-secret")
    secret = data.get("secret") or x_tv_secret
    if secret != TV_WEBHOOK_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if data.get("type") == "internals" or data.get("signal") == "INTERNALS":
        return await _handle_internals(data)

    return await _handle_trade_alert(data)


@router.get("/internals")
def get_internals():
    return _state.INTERNALS_CACHE


@router.get("/alerts")
def get_alerts(limit: int = 20):
    limit = min(limit, 50)
    if _sb:
        try:
            res = _sb.table("tv_alerts").select(
                "*").order("ts", desc=True).limit(limit).execute()
            rows = res.data or []
            for r in rows:
                if "alert_id" in r:
                    r["id"] = r.pop("alert_id")
            return {"alerts": rows, "count": len(rows)}
        except Exception as _e:
            print(f"[WARN] tv_alerts fetch failed: {_e}")
    sliced = _state.TV_ALERTS[:limit]
    return {"alerts": sliced, "count": len(sliced)}


@router.get("/alerts/read-state")
async def get_alert_read_state(user_id: str = Depends(get_current_user)):
    if _sb:
        try:
            res = _sb.table("alert_reads").select("read_ids").eq(
                "user_id", user_id).limit(1).execute()
            if res.data:
                return {"read_ids": res.data[0].get("read_ids") or []}
        except Exception as _e:
            print(f"[WARN] alert_reads fetch failed: {_e}")
    return {"read_ids": []}


@router.post("/alerts/read")
async def save_alert_read_state(payload: AlertReadPayload, user_id: str = Depends(get_current_user)):
    if _sb:
        try:
            _sb.table("alert_reads").upsert({
                "user_id":    user_id,
                "read_ids":   payload.read_ids,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict="user_id").execute()
        except Exception as _e:
            print(f"[WARN] alert_reads upsert failed: {_e}")
    return {"ok": True}


@router.get("/alerts/stream")
async def alerts_stream():
    queue: asyncio.Queue = asyncio.Queue()
    _state.ALERT_SUBSCRIBERS.add(queue)

    async def generate():
        try:
            while True:
                try:
                    alert = await asyncio.wait_for(queue.get(), timeout=1.0)
                    yield f"data: {json.dumps(alert)}\n\n"
                except asyncio.TimeoutError:
                    yield "data: ping\n\n"
        finally:
            _state.ALERT_SUBSCRIBERS.discard(queue)

    return FastAPIStreaming(
        generate(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
