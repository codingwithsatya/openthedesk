from datetime import datetime, timedelta, date as date_type
from zoneinfo import ZoneInfo

from backend.app.core.config import _sb

_PROCESS_GRADE_SCORES: dict[str, float] = {"A+": 5.0, "A": 4.0, "B": 3.0, "C": 2.0}
_GRADE_RANK: dict[str, int] = {"A+": 4, "A": 3, "B": 2, "C": 1}


def get_active_challenge(user_id: str) -> dict | None:
    """Return the single active challenge row for user_id, or None."""
    if not _sb:
        return None
    try:
        res = _sb.table("challenges").select("*")\
            .eq("user_id", user_id)\
            .eq("status", "active")\
            .limit(1)\
            .execute()
        return res.data[0] if res.data else None
    except Exception as _e:
        print(f"[WARN] get_active_challenge failed: {_e}")
        return None


def compute_trading_day_number(start_date) -> int:
    """Count Mon–Fri days from start_date to today ET inclusive (no holiday adjustment)."""
    today = datetime.now(ZoneInfo("America/New_York")).date()
    start = date_type.fromisoformat(str(start_date)) if not isinstance(
        start_date, date_type) else start_date
    count = 0
    current = start
    while current <= today:
        if current.weekday() < 5:
            count += 1
        current += timedelta(days=1)
    return max(1, count)


def write_challenge_entry(user_id: str, trade: dict, source_entry_id: str) -> None:
    """Link trade_journal row to active challenge — 4-field insert, no field duplication."""
    if not _sb:
        return
    try:
        challenge = get_active_challenge(user_id)
        if not challenge:
            return
        day_number = compute_trading_day_number(challenge["start_date"])
        _sb.table("challenge_entries").insert({
            "challenge_id":    challenge["id"],
            "user_id":         user_id,
            "source_entry_id": source_entry_id,
            "day_number":      day_number,
        }).execute()
    except Exception as _e:
        print(f"[WARN] write_challenge_entry failed: {_e}")


def _best_grade_of(trades: list[dict]) -> str | None:
    grades = [g for t in trades if (g := (t.get("grade") or "")) in _GRADE_RANK]
    return max(grades, key=lambda g: _GRADE_RANK[g]) if grades else None


def _challenge_compute_stats(trades: list[dict], start_balance: float) -> dict:
    closed = [t for t in trades if t.get("pnl") is not None]
    wins = [t for t in closed if (t.get("pnl") or 0) > 0]
    losses = [t for t in closed if (t.get("pnl") or 0) <= 0]
    total_pnl = round(sum(t.get("pnl", 0) or 0 for t in closed), 2)
    avg_winner = round(
        sum(t.get("pnl", 0) or 0 for t in wins) / len(wins), 2) if wins else 0.0
    avg_loser = round(sum(t.get("pnl", 0) or 0 for t in losses) /
                      len(losses), 2) if losses else 0.0
    win_rate = round(len(wins) / len(closed) * 100, 1) if closed else 0.0
    setup_pnl: dict[str, float] = {}
    for t in closed:
        s = (t.get("setup") or "Unknown").upper()
        setup_pnl[s] = setup_pnl.get(s, 0) + (t.get("pnl") or 0)
    best_setup = max(
        setup_pnl, key=lambda k: setup_pnl[k]) if setup_pnl else None
    grades = {"A_plus": 0, "A": 0, "B": 0, "C": 0}
    for t in closed:
        pg = t.get("process_grade") or ""
        if pg == "A+":
            grades["A_plus"] += 1
        elif pg == "A":
            grades["A"] += 1
        elif pg == "B":
            grades["B"] += 1
        elif pg == "C":
            grades["C"] += 1
    pg_scores = [_PROCESS_GRADE_SCORES[pg] for t in closed
                 if (pg := t.get("process_grade") or "") in _PROCESS_GRADE_SCORES]
    avg_process_grade = round(sum(pg_scores) / len(pg_scores), 2) if pg_scores else None
    return {
        "total_trades": len(closed),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": win_rate,
        "total_pnl": total_pnl,
        "current_balance": round(start_balance + total_pnl, 2),
        "avg_winner": avg_winner,
        "avg_loser": avg_loser,
        "best_setup": best_setup,
        "process_grades": grades,
        "avg_process_grade": avg_process_grade,
    }


def _challenge_build_calendar(start_date_str: str, trades: list[dict]) -> list[dict]:
    today = datetime.now(ZoneInfo("America/New_York")).date()
    start = date_type.fromisoformat(str(start_date_str))
    by_date: dict[str, list[dict]] = {}
    for t in trades:
        d = t.get("date") or ""
        if d:
            by_date.setdefault(str(d)[:10], []).append(t)
    result = []
    td_counter = 0
    current = start
    while current <= today:
        if current.weekday() < 5:
            td_counter += 1
            day_str = current.isoformat()
            day_trades = by_date.get(day_str, [])
            if day_trades:
                net = round(sum(t.get("pnl", 0) or 0 for t in day_trades), 2)
                status = "win" if net > 0 else "loss"
            else:
                net = 0.0
                status = "no_trade"
            result.append({
                "date": day_str,
                "td_number": td_counter,
                "status": status,
                "day_pnl": net,
                "trade_count": len(day_trades),
                "best_grade": _best_grade_of(day_trades),
            })
        current += timedelta(days=1)
    return result


def _challenge_build_streaks(calendar: list[dict]) -> dict:
    """Win streak stats from calendar (win/loss days only, not no-trade)."""
    traded = [c for c in calendar if c["status"] in ("win", "loss")]
    current = 0
    for c in reversed(traded):
        if c["status"] == "win":
            current += 1
        else:
            break
    best = 0
    run = 0
    for c in traded:
        if c["status"] == "win":
            run += 1
            best = max(best, run)
        else:
            run = 0
    return {"current": current, "best": best}


def _challenge_build_grade_breakdown(calendar: list[dict]) -> dict:
    """Grade distribution using each traded day's best trade grade."""
    a_plus = sum(1 for c in calendar if c.get("best_grade") == "A+")
    a = sum(1 for c in calendar if c.get("best_grade") == "A")
    b = sum(1 for c in calendar if c.get("best_grade") == "B")
    c = sum(1 for c in calendar if c.get("best_grade") == "C")
    return {"a_plus": a_plus, "a": a, "b": b, "c": c, "total": a_plus + a + b + c}


def _challenge_build_equity(trades: list[dict], start_balance: float) -> list[dict]:
    """Per-day balance snapshots ordered chronologically across ALL trade dates."""
    by_date: dict[str, float] = {}
    for t in trades:
        d = str(t.get("date") or "")[:10]
        if d:
            by_date[d] = round(by_date.get(d, 0.0) + (t.get("pnl") or 0), 2)
    running = start_balance
    result = []
    for day_str in sorted(by_date.keys()):
        running = round(running + by_date[day_str], 2)
        result.append({"date": day_str, "pnl": by_date[day_str], "balance": running})
    return result


def _challenge_build_lessons(trades: list[dict]) -> list[dict]:
    losing = [t for t in trades if (t.get("pnl") or 0) < 0]
    by_setup: dict[str, list[dict]] = {}
    for t in losing:
        s = (t.get("setup") or "Unknown").upper()
        by_setup.setdefault(s, []).append(t)
    lessons = []
    for setup, items in sorted(by_setup.items(), key=lambda x: len(x[1]), reverse=True)[:3]:
        verdicts = [t.get("process_review") or "" for t in items if t.get("process_review")]
        summary = " | ".join(v[:120] for v in verdicts[:2]) if verdicts else "No process review yet"
        lessons.append({"setup": setup, "losses": len(items), "verdict_summary": summary})
    return lessons


def _fetch_challenge_trades(challenge_id: str, user_id: str) -> list[dict]:
    """Fetch all closed trade_journal rows linked to this challenge via JOIN."""
    if not _sb:
        return []
    try:
        ce_res = _sb.table("challenge_entries").select("source_entry_id")\
            .eq("challenge_id", challenge_id).execute()
        source_ids = [r["source_entry_id"]
                      for r in (ce_res.data or []) if r.get("source_entry_id")]
        if not source_ids:
            return []
        tj_res = _sb.table("trade_journal").select("*")\
            .in_("id", source_ids)\
            .eq("user_id", user_id)\
            .eq("status", "closed")\
            .order("created_at", desc=False)\
            .execute()
        return tj_res.data or []
    except Exception as _e:
        print(f"[WARN] _fetch_challenge_trades failed: {_e}")
        return []
