import asyncio
import csv
import io
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse as FastAPIStreaming

from backend.app.core.auth import get_current_user
from backend.app.core.config import _sb
from backend.app.models.journal import JournalEntryPayload, JournalUpdatePayload
from backend.app.services.journal_service import (
    JOURNAL_ENTRIES,
    _calc_pnl,
    _compute_r_multiple,
    _enrich_entry,
    _run_process_review,
)
from backend.app.services.challenge_service import write_challenge_entry
from tradier import get_market_internals
import backend.app.core.state as _state
import uuid

router = APIRouter()


@router.post("/journal/entry")
async def create_journal_entry(payload: JournalEntryPayload, user_id: str = Depends(get_current_user)):
    pnl = payload.pnl if payload.pnl is not None else (
        _calc_pnl(payload.direction, payload.entry_price,
                  payload.exit_price, payload.contracts)
        if payload.exit_price is not None else None
    )
    internals = get_market_internals()
    if not any([internals.get("trin"), internals.get("add"), internals.get("vold")]):
        internals = {k: _state.INTERNALS_CACHE.get(k) for k in ["trin", "add", "vold"]}
    entry = {
        "id":               str(uuid.uuid4()),
        "created_at":       datetime.now(timezone.utc).isoformat(),
        "date":             payload.date,
        "ticker":           payload.ticker,
        "setup":            payload.setup,
        "direction":        payload.direction,
        "entry_price":      payload.entry_price,
        "entry_premium":    payload.entry_premium,
        "exit_price":       payload.exit_price,
        "exit_premium":     payload.exit_premium,
        "contracts":        payload.contracts,
        "pnl":              round(pnl, 2) if pnl is not None else None,
        "grade":            payload.grade or "",
        "process_grade":    payload.process_grade or "",
        "notes":            payload.notes or "",
        "status":           payload.status,
        "internals":        internals,
        "stop_loss_premium": payload.stop_loss_premium,
    }
    if _sb:
        try:
            result = _sb.table("trade_journal").insert({
                "user_id":            user_id,
                "date":               entry["date"],
                "ticker":             entry["ticker"],
                "setup":              entry["setup"],
                "direction":          entry["direction"],
                "entry_price":        entry["entry_price"],
                "entry_premium":      entry["entry_premium"],
                "exit_price":         entry["exit_price"],
                "exit_premium":       entry["exit_premium"],
                "stop_loss_premium":  entry["stop_loss_premium"],
                "contracts":          entry["contracts"],
                "pnl":                entry["pnl"],
                "grade":              entry["grade"],
                "process_grade":      entry["process_grade"],
                "notes":              entry["notes"],
                "status":             entry["status"],
                "internals":          entry["internals"],
            }).execute()
            if result.data and len(result.data) > 0:
                entry["id"] = result.data[0]["id"]
        except Exception as _e:
            print(f"[WARN] trade_journal insert failed: {_e}")
    JOURNAL_ENTRIES.insert(0, entry)
    if entry.get("id"):
        write_challenge_entry(user_id, entry, entry["id"])
        return {"status": "created", "id": entry["id"], "pnl": entry["pnl"]}


@router.post("/journal/review/{entry_id}")
async def run_process_review(entry_id: str, user_id: str = Depends(get_current_user)):
    if not _sb:
        raise HTTPException(status_code=503, detail="Database not configured")
    try:
        res = _sb.table("trade_journal").select(
            "*").eq("id", entry_id).eq("user_id", user_id).execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Entry not found or not yours")
        row = res.data[0]
        if row.get("status") != "closed":
            raise HTTPException(status_code=400, detail="Trade must be closed before review")
        review = await asyncio.to_thread(_run_process_review, entry_id, user_id, row)
        return {"status": "reviewed", "entry_id": entry_id, **review}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/journal/entry/{entry_id}")
async def update_journal_entry(
    entry_id: str,
    payload: JournalUpdatePayload,
    user_id: str = Depends(get_current_user)
):
    if not _sb:
        raise HTTPException(status_code=503, detail="Database not configured")
    try:
        update_data = {k: v for k, v in payload.model_dump().items() if v is not None}
        update_data.pop("tags", None)
        if not update_data:
            return {"status": "no changes"}
        if "exit_premium" in update_data and "pnl" not in update_data:
            try:
                existing = _sb.table("trade_journal")\
                    .select("entry_premium,contracts")\
                    .eq("id", entry_id).eq("user_id", user_id)\
                    .single().execute()
                if existing.data:
                    ep = existing.data.get("entry_premium") or 0
                    xp = update_data["exit_premium"]
                    ct = existing.data.get("contracts") or 1
                    update_data["pnl"] = round((xp - ep) * ct * 100, 2)
            except Exception:
                pass
        result = _sb.table("trade_journal")\
            .update(update_data)\
            .eq("id", entry_id)\
            .eq("user_id", user_id)\
            .execute()
        if not result.data:
            raise HTTPException(status_code=404, detail="Entry not found or not yours")
        row = result.data[0]
        _enrich_entry(row)
        response: dict = {"status": "updated", "entry": row}
        if payload.status == "closed":
            try:
                review = await asyncio.to_thread(_run_process_review, entry_id, user_id, row)
                response["review"] = review
            except Exception as _re:
                print(f"[WARN] auto process review failed: {_re}")
        return response
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/journal/entries")
def get_journal_entries(
    limit: int = 50,
    offset: int = 0,
    setup: Optional[str] = None,
    direction: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
    filter: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    limit = min(limit, 200)
    offset = max(offset, 0)
    if _sb:
        try:
            q = _sb.table("trade_journal").select("*").eq("user_id", user_id)
            if setup:
                q = q.ilike("setup", f"%{setup}%")
            if direction:
                q = q.ilike("direction", direction)
            if date_from:
                q = q.gte("date", date_from)
            if date_to:
                q = q.lte("date", date_to)
            if status:
                q = q.eq("status", status)
            if tag:
                q = q.ilike("notes", f"%#{tag}%")
            if filter:
                safe = filter.replace("%", r"\%")
                or_clause = ",".join(
                    f"{c}.ilike.%{safe}%"
                    for c in ["ticker", "setup", "direction", "notes", "status"]
                )
                q = q.or_(or_clause)
            res = q.order("date", desc=True).order("created_at", desc=True)\
                .range(offset, offset + limit - 1).execute()
            rows = res.data or []
            for r in rows:
                _enrich_entry(r)
            return {"entries": rows, "count": len(rows), "offset": offset, "limit": limit}
        except Exception as _e:
            print(f"[WARN] trade_journal fetch failed: {_e}")
    sliced = list(JOURNAL_ENTRIES[offset:offset + limit])
    for r in sliced:
        _enrich_entry(r)
    return {"entries": sliced, "count": len(sliced), "offset": offset, "limit": limit}


@router.get("/journal/stats")
def get_journal_stats(user_id: str = Depends(get_current_user)):
    entries = JOURNAL_ENTRIES
    if _sb:
        try:
            res = _sb.table("trade_journal").select(
                "*").eq("user_id", user_id).order("created_at", desc=True).limit(200).execute()
            entries = res.data or []
        except Exception as _e:
            print(f"[WARN] trade_journal stats fetch failed: {_e}")
    if not entries:
        return {
            "total_trades": 0, "wins": 0, "losses": 0, "win_rate": 0.0,
            "total_pnl": 0.0, "avg_winner": 0.0, "avg_loser": 0.0,
            "best_setup": None, "best_setup_pnl": None,
            "pnl_by_setup": {}, "pnl_by_hour": {}, "pnl_by_hour_grid": {},
            "equity_curve": [], "equity_dates": [],
            "profit_factor": 0.0, "expectancy": 0.0,
        }

    closed = [e for e in entries if e.get("pnl") is not None]
    wins = [e for e in closed if e["pnl"] > 0]
    losses = [e for e in closed if e["pnl"] <= 0]

    avg_winner = sum(e["pnl"] for e in wins) / len(wins) if wins else 0.0
    avg_loser = sum(e["pnl"] for e in losses) / len(losses) if losses else 0.0

    pnl_by_setup: dict[str, dict] = {}
    for e in entries:
        s = e.get("setup", "OTHER")
        if s not in pnl_by_setup:
            pnl_by_setup[s] = {"wins": 0, "losses": 0, "total_pnl": 0.0}
        pnl = e.get("pnl") or 0
        if pnl > 0:
            pnl_by_setup[s]["wins"] += 1
        else:
            pnl_by_setup[s]["losses"] += 1
        pnl_by_setup[s]["total_pnl"] = round(pnl_by_setup[s]["total_pnl"] + pnl, 2)

    best_setup = None
    best_wr = -1.0
    for s, data in pnl_by_setup.items():
        total = data["wins"] + data["losses"]
        if total >= 3:
            wr = data["wins"] / total
            if wr > best_wr:
                best_wr = wr
                best_setup = s

    pnl_by_hour: dict[str, dict] = {}
    for e in entries:
        try:
            hr = str(datetime.fromisoformat(e.get("created_at", "")).hour)
        except Exception:
            hr = "unknown"
        if hr not in pnl_by_hour:
            pnl_by_hour[hr] = {"wins": 0, "losses": 0}
        if (e.get("pnl") or 0) > 0:
            pnl_by_hour[hr]["wins"] += 1
        else:
            pnl_by_hour[hr]["losses"] += 1

    sorted_entries = sorted(entries, key=lambda e: e.get("created_at", ""))
    equity_curve: list[float] = []
    running = 0.0
    for e in sorted_entries:
        running += e.get("pnl") or 0
        equity_curve.append(round(running, 2))

    gross_wins = sum(e["pnl"] for e in wins)
    gross_losses = abs(sum(e["pnl"] for e in losses))
    profit_factor = round(gross_wins / gross_losses, 2) if gross_losses > 0 else 0.0

    wr_decimal = len(wins) / len(closed) if closed else 0.0
    expectancy = round((wr_decimal * avg_winner) + ((1 - wr_decimal) * avg_loser), 2)

    best_setup_pnl = pnl_by_setup.get(best_setup, {}).get("total_pnl") if best_setup else None

    _DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    pnl_by_hour_grid: dict[str, dict] = {}
    for e in entries:
        try:
            dt = datetime.fromisoformat(e.get("created_at", ""))
            day_name = _DAY_NAMES[dt.weekday()]
            hr = dt.hour
            key = f"{day_name}_{hr}"
            if key not in pnl_by_hour_grid:
                pnl_by_hour_grid[key] = {"wins": 0, "losses": 0, "pnl": 0.0}
            pnl = e.get("pnl") or 0
            if pnl > 0:
                pnl_by_hour_grid[key]["wins"] += 1
            else:
                pnl_by_hour_grid[key]["losses"] += 1
            pnl_by_hour_grid[key]["pnl"] = round(pnl_by_hour_grid[key]["pnl"] + pnl, 2)
        except Exception:
            pass

    equity_dates: list[str] = [e.get("date", "") for e in sorted_entries]

    return {
        "total_trades": len(closed),
        "wins": len(wins),
        "losses": len(losses),
        "win_rate": round(len(wins) / len(closed) * 100, 1) if closed else 0.0,
        "total_pnl": round(sum(e["pnl"] for e in closed), 2),
        "avg_winner": round(avg_winner, 2),
        "avg_loser": round(avg_loser, 2),
        "best_setup": best_setup,
        "pnl_by_setup": pnl_by_setup,
        "pnl_by_hour": pnl_by_hour,
        "equity_curve": equity_curve,
        "profit_factor": profit_factor,
        "expectancy": expectancy,
        "best_setup_pnl": best_setup_pnl,
        "pnl_by_hour_grid": pnl_by_hour_grid,
        "equity_dates": equity_dates,
    }


@router.post("/journal/entry/{entry_id}/duplicate")
async def duplicate_journal_entry(entry_id: str, user_id: str = Depends(get_current_user)):
    if not _sb:
        raise HTTPException(status_code=503, detail="Database not configured")
    try:
        res = _sb.table("trade_journal").select("*").eq("id", entry_id).eq(
            "user_id", user_id).single().execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Entry not found")
        row = dict(res.data)
        row.pop("id", None)
        row.pop("created_at", None)
        row["status"] = "open"
        row["exit_price"] = None
        row["exit_premium"] = None
        row["pnl"] = None
        row["process_review"] = None
        row["notes"] = f"[Duplicate] {row.get('notes', '') or ''}".strip()
        insert_res = _sb.table("trade_journal").insert(row).execute()
        if not insert_res.data:
            raise HTTPException(status_code=500, detail="Duplicate failed")
        new_row = insert_res.data[0]
        _enrich_entry(new_row)
        return {"status": "duplicated", "entry": new_row}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/journal/entry/{entry_id}")
async def delete_journal_entry(entry_id: str, user_id: str = Depends(get_current_user)):
    if not _sb:
        raise HTTPException(status_code=503, detail="Database not configured")
    try:
        res = _sb.table("trade_journal")\
            .delete()\
            .eq("id", entry_id)\
            .eq("user_id", user_id)\
            .execute()
        if not res.data:
            raise HTTPException(status_code=404, detail="Entry not found or not yours")
        return {"status": "deleted", "id": entry_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/journal/export")
def export_journal(
    format: str = "csv",
    setup: Optional[str] = None,
    direction: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    tag: Optional[str] = None,
    filter: Optional[str] = None,
    user_id: str = Depends(get_current_user)
):
    if not _sb:
        raise HTTPException(status_code=503, detail="Database not configured")
    try:
        q = _sb.table("trade_journal").select("*").eq("user_id", user_id)
        if setup:
            q = q.ilike("setup", f"%{setup}%")
        if direction:
            q = q.ilike("direction", direction)
        if date_from:
            q = q.gte("date", date_from)
        if date_to:
            q = q.lte("date", date_to)
        if status:
            q = q.eq("status", status)
        if tag:
            q = q.ilike("notes", f"%#{tag}%")
        if filter:
            safe = filter.replace("%", r"\%")
            or_clause = ",".join(
                f"{c}.ilike.%{safe}%"
                for c in ["ticker", "setup", "direction", "notes", "status"]
            )
            q = q.or_(or_clause)
        res = q.order("date", desc=True).limit(1000).execute()
        rows = res.data or []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    EXPORT_COLS = [
        "date", "setup", "direction", "ticker", "entry_price", "exit_price",
        "entry_premium", "exit_premium", "contracts", "pnl", "grade",
        "process_grade", "notes", "status"
    ]

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=EXPORT_COLS, extrasaction="ignore")
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r.get(k, "") for k in EXPORT_COLS})
    output.seek(0)

    return FastAPIStreaming(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=journal_export.csv"}
    )
