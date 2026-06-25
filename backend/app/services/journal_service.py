import json
import re
import uuid
from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from backend.app.core.config import _sb
from backend.app.core.clients import client, HAIKU
from backend.app.core.state import INTERNALS_CACHE
from backend.app.core.utils import with_retry

JOURNAL_ENTRIES: list[dict] = [
    {
        "id": "seed-001", "created_at": "2026-05-12T09:47:00-04:00",
        "date": "2026-05-12", "ticker": "SPX", "setup": "GG", "direction": "BULL",
        "entry_price": 7382.50, "exit_price": 7410.00, "contracts": 2,
        "pnl": 5500.0, "grade": "A+", "process_grade": "A+",
        "notes": "Clean GG bull at open, ribbon aligned, vol above avg",
        "internals": {"trin": 0.72, "add": 312, "vold": 1.24},
    },
    {
        "id": "seed-002", "created_at": "2026-05-12T10:23:00-04:00",
        "date": "2026-05-12", "ticker": "SPX", "setup": "FLAG", "direction": "BULL",
        "entry_price": 7412.00, "exit_price": 7398.50, "contracts": 1,
        "pnl": -1350.0, "grade": "A", "process_grade": "A+",
        "notes": "Flag entry was clean but market reversed on high TRIN",
        "internals": {"trin": 1.31, "add": -108, "vold": 0.88},
    },
    {
        "id": "seed-003", "created_at": "2026-05-13T09:52:00-04:00",
        "date": "2026-05-13", "ticker": "SPX", "setup": "VOMY", "direction": "BULL",
        "entry_price": 7388.00, "exit_price": 7419.50, "contracts": 2,
        "pnl": 6300.0, "grade": "A+", "process_grade": "A+",
        "notes": "Vomy with PO zero-cross, ADD +480 confirmation, added second contract",
        "internals": {"trin": 0.61, "add": 480, "vold": 1.67},
    },
    {
        "id": "seed-004", "created_at": "2026-05-14T10:15:00-04:00",
        "date": "2026-05-14", "ticker": "SPX", "setup": "GG", "direction": "BEAR",
        "entry_price": 7435.00, "exit_price": 7419.00, "contracts": 1,
        "pnl": 1600.0, "grade": "A", "process_grade": "A",
        "notes": "GG bear at put trigger, quick scalp, exited early",
        "internals": {"trin": 1.18, "add": -220, "vold": 0.92},
    },
    {
        "id": "seed-005", "created_at": "2026-05-14T11:42:00-04:00",
        "date": "2026-05-14", "ticker": "SPX", "setup": "DIV", "direction": "BULL",
        "entry_price": 7395.00, "exit_price": 7381.00, "contracts": 1,
        "pnl": -1400.0, "grade": "A", "process_grade": "B",
        "notes": "DIV setup valid but traded against a strong bearish trend day, process error",
        "internals": {"trin": 1.44, "add": -390, "vold": 0.71},
    },
    {
        "id": "seed-006", "created_at": "2026-05-15T09:38:00-04:00",
        "date": "2026-05-15", "ticker": "SPX", "setup": "GG", "direction": "BULL",
        "entry_price": 7401.00, "exit_price": 7428.50, "contracts": 2,
        "pnl": 5500.0, "grade": "A+", "process_grade": "A+",
        "notes": "Best trade of the week — GG A+ at open, full target",
        "internals": {"trin": 0.68, "add": 520, "vold": 1.51},
    },
    {
        "id": "seed-007", "created_at": "2026-05-16T10:55:00-04:00",
        "date": "2026-05-16", "ticker": "SPX", "setup": "TWEEZER", "direction": "BEAR",
        "entry_price": 7420.00, "exit_price": 7408.50, "contracts": 1,
        "pnl": 1150.0, "grade": "A", "process_grade": "A",
        "notes": "Tweezer bear at GG open call, partial fill, good execution",
        "internals": {"trin": 1.09, "add": -145, "vold": 1.02},
    },
    {
        "id": "seed-008", "created_at": "2026-05-19T11:20:00-04:00",
        "date": "2026-05-19", "ticker": "SPX", "setup": "FLAG", "direction": "BEAR",
        "entry_price": 7430.00, "exit_price": 7438.50, "contracts": 1,
        "pnl": -850.0, "grade": "A", "process_grade": "A",
        "notes": "Flag bear invalidated by news spike, stopped correctly",
        "internals": {"trin": 0.95, "add": 88, "vold": 1.12},
    },
]


def _calc_pnl(direction: str, entry: float, exit_p: float, contracts: int) -> float:
    if direction.upper() == "BULL":
        return (exit_p - entry) * contracts * 100
    return (entry - exit_p) * contracts * 100


def _compute_r_multiple(entry_prem, exit_prem, sl_prem):
    """R = (exit - entry) / (entry - sl). Returns None if any value is missing or risk <= 0."""
    if entry_prem is None or exit_prem is None or sl_prem is None:
        return None
    risk = round(float(entry_prem) - float(sl_prem), 4)
    if risk <= 0:
        return None
    return round((float(exit_prem) - float(entry_prem)) / risk, 2)


_TAG_RE = re.compile(r"#(\w+)")


def _row_actions(status: str) -> list:
    if (status or "open") == "open":
        return ["edit_trade", "close_trade", "delete_trade"]
    return ["view_review", "edit_notes", "rerun_review", "duplicate_trade", "delete_trade"]


def _enrich_entry(r: dict) -> dict:
    """Attach all computed/derived fields to a journal row dict in-place."""
    r["r_multiple"] = _compute_r_multiple(
        r.get("entry_premium"), r.get("exit_premium"), r.get("stop_loss_premium")
    )
    r["instrument"] = r.get("ticker", "SPX")
    tags_list = _TAG_RE.findall(r.get("notes") or "")
    r["tags"] = ", ".join(tags_list) if tags_list else (r.get("setup") or "")
    st = r.get("status") or "open"
    pnl_v = r.get("pnl")
    r["win_loss"] = "open" if st == "open" or pnl_v is None else ("win" if pnl_v > 0 else "loss")
    r["row_actions"] = _row_actions(st)
    return r


_PROCESS_REVIEW_SYSTEM = """You are a trading process coach for a 0DTE SPX options trader.
Evaluate execution quality — not just outcome (P&L). Focus on plan adherence, risk discipline, and exit quality.

PHASE 2 RULES (must be followed):
- Account: ~$500 challenge
- Max 1 contract, premium $3–4 range, A or A+ setups only
- Max loss -$150/session, max 3 trades/day
- Dollar stop = premium paid - $1.00 (always honored)

Output ONLY valid JSON, no markdown or extra text:
{
  "grade": "A",
  "verdict": "2–3 sentence process evaluation",
  "grade_factors": {
    "setup_quality": 4.5,
    "execution": 4.0,
    "risk_management": 4.0,
    "trade_management": 4.5,
    "mindset_discipline": 4.0
  }
}

grade must be exactly one of: A+, A, B, C
grade_factors: each score 0.0–5.0, one decimal place, based only on available context — be honest when context is limited."""


def _build_review_prompt(row: dict) -> str:
    internals = row.get("internals") or {}
    parts = [
        f"Setup: {row.get('setup', '?')} | Direction: {row.get('direction', '?')}",
        f"Entry price: {row.get('entry_price')} | Entry premium: ${row.get('entry_premium', '?')}",
        f"Exit price: {row.get('exit_price', '?')} | Exit premium: ${row.get('exit_premium', '?')}",
        f"P&L: ${row.get('pnl', '?')} | Contracts: {row.get('contracts', 1)}",
        f"Pine signal grade: {row.get('grade', '?')}",
    ]
    trin, add = internals.get("trin"), internals.get("add")
    if trin is not None or add is not None:
        parts.append(f"Internals at entry: TRIN={trin}, ADD={add}")
    notes = (row.get("notes") or "")[:300]
    if notes:
        parts.append(f"Signal notes: {notes}")
    return "\n".join(parts)


def _run_process_review(entry_id: str, user_id: str, row: dict) -> dict:
    """Sync: call Haiku to grade the trade process, write result back to Supabase."""
    prompt = _build_review_prompt(row)
    grade = "B"
    verdict = "Review could not be completed — try Re-run Review."
    grade_factors = None
    try:
        r = with_retry(lambda: client.messages.create(
            model=HAIKU,
            max_tokens=512,
            system=_PROCESS_REVIEW_SYSTEM,
            messages=[{"role": "user", "content": f"Review this trade:\n{prompt}"}],
        ))
        raw = r.content[0].text.strip()
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
        parsed = json.loads(raw)
        grade = parsed.get("grade", "B")
        verdict = parsed.get("verdict", raw)
        gf = parsed.get("grade_factors")
        if isinstance(gf, dict) and len(gf) == 5:
            grade_factors = {
                "setup_quality":      round(float(gf.get("setup_quality", 3)), 1),
                "execution":          round(float(gf.get("execution", 3)), 1),
                "risk_management":    round(float(gf.get("risk_management", 3)), 1),
                "trade_management":   round(float(gf.get("trade_management", 3)), 1),
                "mindset_discipline": round(float(gf.get("mindset_discipline", 3)), 1),
            }
    except Exception as _pe:
        print(f"[WARN] process review parse failed: {_pe}")

    if _sb:
        try:
            update = {"process_grade": grade, "process_review": verdict}
            if grade_factors is not None:
                update["grade_factors"] = grade_factors
            _sb.table("trade_journal").update(update)\
                .eq("id", entry_id).eq("user_id", user_id).execute()
        except Exception as _we:
            print(f"[WARN] process_review write failed: {_we}")

    return {"grade": grade, "verdict": verdict, "grade_factors": grade_factors}


def _save_journal_entry(fields: dict, user_id: str) -> dict:
    """Write extracted journal fields to trade_journal. Returns saved entry dict."""
    from backend.app.services.challenge_service import write_challenge_entry

    direction = (fields.get("direction") or "BULL").upper()
    entry_price = float(fields.get("entry_price", 0))
    exit_price = float(fields.get("exit_price", 0))
    contracts = int(fields.get("contracts") or 1)

    pnl = fields.get("pnl")
    if pnl is None:
        entry_premium = fields.get("entry_premium")
        exit_premium = fields.get("exit_premium")
        if entry_premium is not None and exit_premium is not None:
            pnl = (float(exit_premium) - float(entry_premium)) * contracts * 100
        else:
            pnl = _calc_pnl(direction, entry_price, exit_price, contracts)
    pnl = round(float(pnl), 2)

    internals = {k: INTERNALS_CACHE.get(k) for k in ["trin", "add", "vold"]}

    entry = {
        "id":            str(uuid.uuid4()),
        "created_at":    datetime.now(timezone.utc).isoformat(),
        "date":          datetime.now(ZoneInfo("America/New_York")).strftime("%Y-%m-%d"),
        "ticker":        fields.get("ticker", "SPX"),
        "setup":         fields.get("setup", ""),
        "direction":     direction,
        "entry_price":   entry_price,
        "exit_price":    exit_price,
        "entry_premium": float(fields.get("entry_premium") or 0) or None,
        "exit_premium":  float(fields.get("exit_premium") or 0) or None,
        "contracts":     contracts,
        "pnl":           pnl,
        "grade":         fields.get("grade", "A"),
        "process_grade": fields.get("process_grade", "A"),
        "notes":         fields.get("notes") or "",
        "status":        "closed",
        "internals":     internals,
    }

    if _sb:
        actual_id = None
        try:
            result = _sb.table("trade_journal").insert({
                "user_id":       user_id,
                "date":          entry["date"],
                "ticker":        entry["ticker"],
                "setup":         entry["setup"],
                "direction":     entry["direction"],
                "entry_price":   entry["entry_price"],
                "exit_price":    entry["exit_price"],
                "entry_premium": entry["entry_premium"],
                "exit_premium":  entry["exit_premium"],
                "contracts":     entry["contracts"],
                "pnl":           entry["pnl"],
                "grade":         entry["grade"],
                "process_grade": entry["process_grade"],
                "notes":         entry["notes"],
                "status":        entry["status"],
                "internals":     entry["internals"],
            }).execute()
            if result.data and len(result.data) > 0:
                actual_id = result.data[0]["id"]
                entry["id"] = actual_id
        except Exception as _e:
            print(f"[WARN] chat→journal insert failed: {_e}")

        if actual_id:
            try:
                write_challenge_entry(user_id, entry, actual_id)
            except Exception as _ce:
                print(f"[WARN] challenge write failed: {_ce}")

    JOURNAL_ENTRIES.insert(0, entry)
    return entry
