from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException

from backend.app.core.auth import get_current_user
from backend.app.core.config import _sb
from backend.app.models.challenge import StartChallengePayload
from backend.app.services.challenge_service import (
    get_active_challenge,
    compute_trading_day_number,
    _challenge_compute_stats,
    _challenge_build_calendar,
    _challenge_build_streaks,
    _challenge_build_grade_breakdown,
    _challenge_build_equity,
    _challenge_build_lessons,
    _fetch_challenge_trades,
    write_challenge_entry,
)
from backend.app.services.journal_service import _compute_r_multiple

router = APIRouter()


@router.post("/challenge/start")
async def start_challenge(payload: StartChallengePayload, user_id: str = Depends(get_current_user)):
    existing = get_active_challenge(user_id)
    if existing:
        raise HTTPException(status_code=409, detail="An active challenge already exists.")
    if not _sb:
        raise HTTPException(status_code=503, detail="Database unavailable")
    try:
        today = datetime.now(ZoneInfo("America/New_York")).date().isoformat()
        row = {
            "user_id":       user_id,
            "start_date":    today,
            "start_balance": payload.start_balance,
            "target_days":   90,
            "status":        "active",
        }
        try:
            row["name"] = payload.name
            row["monthly_target"] = payload.monthly_target
        except Exception:
            pass
        res = _sb.table("challenges").insert(row).execute()
        if not res.data:
            raise HTTPException(status_code=500, detail="Insert returned no data")
        return res.data[0]
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=str(_e))


@router.get("/challenge/status")
async def get_challenge_status(user_id: str = Depends(get_current_user)):
    challenge = get_active_challenge(user_id)
    if not challenge:
        return {"active": False}
    day_number = compute_trading_day_number(challenge["start_date"])
    return {**challenge, "active": True, "day_number": day_number}


@router.get("/challenge/stats")
async def get_challenge_stats(user_id: str = Depends(get_current_user)):
    challenge = get_active_challenge(user_id)
    if not challenge:
        return {"active": False}
    day_number = compute_trading_day_number(challenge["start_date"])
    trades = _fetch_challenge_trades(challenge["id"], user_id)
    start_balance = challenge.get("start_balance") or 500
    start_date_str = str(challenge["start_date"])[:10]
    in_window = [t for t in trades if str(t.get("date") or "")[:10] >= start_date_str]
    stats = _challenge_compute_stats(in_window, start_balance)
    calendar = _challenge_build_calendar(challenge["start_date"], in_window)
    lessons = _challenge_build_lessons(in_window)
    equity = _challenge_build_equity(in_window, start_balance)
    streaks = _challenge_build_streaks(calendar)
    grade_breakdown = _challenge_build_grade_breakdown(calendar)
    return {
        "active": True,
        "challenge": challenge,
        "day_number": day_number,
        "stats": stats,
        "calendar": calendar,
        "lessons": lessons,
        "equity": equity,
        "streaks": streaks,
        "grade_breakdown": grade_breakdown,
    }


@router.get("/challenge/day/{date}")
async def get_challenge_day(date: str, user_id: str = Depends(get_current_user)):
    challenge = get_active_challenge(user_id)
    if not challenge:
        raise HTTPException(status_code=404, detail="No active challenge")
    if not _sb:
        raise HTTPException(status_code=503, detail="Database unavailable")
    start_date_str = str(challenge["start_date"])[:10]
    if date < start_date_str:
        raise HTTPException(status_code=400, detail="Date is before challenge start date")
    try:
        ce_res = _sb.table("challenge_entries").select("source_entry_id")\
            .eq("challenge_id", challenge["id"]).execute()
        source_ids = [r["source_entry_id"] for r in (ce_res.data or []) if r.get("source_entry_id")]
        if not source_ids:
            return {"date": date, "trades": [], "day_pnl": 0.0, "balance_after": None,
                    "win_rate": None, "avg_r_multiple": None}
        tj_res = _sb.table("trade_journal").select("*")\
            .in_("id", source_ids)\
            .eq("user_id", user_id)\
            .eq("status", "closed")\
            .eq("date", date)\
            .order("created_at", desc=False)\
            .execute()
        day_trades = tj_res.data or []
        day_pnl = round(sum(t.get("pnl") or 0 for t in day_trades), 2)
        all_trades = _fetch_challenge_trades(challenge["id"], user_id)
        start_balance = challenge.get("start_balance") or 500
        in_window = [t for t in all_trades if str(t.get("date") or "")[:10] >= start_date_str]
        equity = _challenge_build_equity(in_window, start_balance)
        balance_after = None
        for point in equity:
            if point["date"] <= date:
                balance_after = point["balance"]
        day_wins = [t for t in day_trades if (t.get("pnl") or 0) > 0]
        day_win_rate = round(len(day_wins) / len(day_trades) * 100, 1) if day_trades else None
        r_vals = [r for t in day_trades if (r := _compute_r_multiple(
            t.get("entry_premium"), t.get("exit_premium"), t.get("stop_loss_premium")
        )) is not None]
        avg_r_multiple = round(sum(r_vals) / len(r_vals), 2) if r_vals else None
        return {
            "date": date,
            "day_pnl": day_pnl,
            "balance_after": balance_after,
            "win_rate": day_win_rate,
            "avg_r_multiple": avg_r_multiple,
            "trades": [
                {
                    "id": t.get("id"),
                    "setup": t.get("setup"),
                    "direction": t.get("direction"),
                    "entry_premium": t.get("entry_premium"),
                    "exit_premium": t.get("exit_premium"),
                    "stop_loss_premium": t.get("stop_loss_premium"),
                    "r_multiple": _compute_r_multiple(
                        t.get("entry_premium"), t.get("exit_premium"), t.get("stop_loss_premium")
                    ),
                    "contracts": t.get("contracts") or 1,
                    "pnl": t.get("pnl"),
                    "grade": t.get("grade"),
                    "process_grade": t.get("process_grade"),
                    "process_review": t.get("process_review"),
                    "grade_factors": t.get("grade_factors"),
                    "notes": t.get("notes"),
                }
                for t in day_trades
            ],
        }
    except HTTPException:
        raise
    except Exception as _e:
        raise HTTPException(status_code=500, detail=str(_e))


@router.get("/challenge/all")
async def get_all_challenges(user_id: str = Depends(get_current_user)):
    if not _sb:
        return {"challenges": []}
    try:
        res = _sb.table("challenges").select("*")\
            .eq("user_id", user_id)\
            .order("created_at", desc=True)\
            .execute()
        challenges = res.data or []
        result = []
        for ch in challenges:
            trades = _fetch_challenge_trades(ch["id"], user_id)
            start_balance = ch.get("start_balance") or 500
            stats = _challenge_compute_stats(trades, start_balance)
            result.append({**ch, "stats": stats})
        return {"challenges": result}
    except Exception as _e:
        print(f"[WARN] get_all_challenges failed: {_e}")
        return {"challenges": []}
