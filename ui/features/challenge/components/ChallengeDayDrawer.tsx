"use client";
import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ──────────────────────────────────────────────────────

interface CalendarDay {
  date: string;
  td_number: number;
  status: "win" | "loss" | "no_trade";
  day_pnl: number;
  trade_count: number;
  best_grade: string | null;
}

interface DrawerTrade {
  id: string | null;
  setup: string | null;
  direction: string | null;
  entry_premium: number | null;
  exit_premium: number | null;
  r_multiple: number | null;
  contracts: number;
  pnl: number | null;
  grade: string | null;
  process_review: string | null;
  notes: string | null;
}

interface DrawerDayDetail {
  date: string;
  trades: DrawerTrade[];
  day_pnl: number;
  balance_after: number | null;
  win_rate: number | null;
  avg_r_multiple: number | null;
}

interface Props {
  open: boolean;
  date: string | null;
  calDay: CalendarDay | null;
  detail: DrawerDayDetail | null;
  loading: boolean;
  error?: string | null;
  allCalDays: CalendarDay[];
  onClose: () => void;
  onNavigate: (date: string) => void;
  onRefetch?: () => void;
}

// ── Helpers ────────────────────────────────────────────────────

function fmtPnl(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${v >= 0 ? "+" : "−"}$${abs}`;
}

function gradeColor(g: string | null): string {
  if (!g) return "var(--text-mid)";
  if (g === "A+" || g === "A") return "var(--ch-green)";
  if (g === "B") return "var(--ch-warning)";
  return "var(--ch-red)";
}

function gradeKey(g: string | null): "a" | "b" | "c" | "none" {
  if (!g) return "none";
  if (g === "A+" || g === "A") return "a";
  if (g === "B") return "b";
  return "c";
}

// ── Skeleton shimmer ──────────────────────────────────────────

function Sk({ w = "100%", h = 14, mb = 0 }: { w?: string | number; h?: number; mb?: number }) {
  return (
    <span
      className="skel"
      style={{ width: w, height: h, marginBottom: mb, borderRadius: 6, display: "block" }}
    />
  );
}

function DayDetailSkeleton() {
  return (
    <>
      {/* Identity */}
      <div style={{ display: "flex", gap: 14, marginBottom: 18, alignItems: "flex-start" }}>
        <span className="skel" style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0, display: "block" }} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
          <Sk w="62%" h={18} />
          <Sk w="38%" h={11} />
        </div>
        <Sk w={64} h={24} />
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 18 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            style={{
              padding: "10px 12px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--border)",
              borderRadius: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <Sk w="52%" h={9} />
            <Sk w="68%" h={20} />
          </div>
        ))}
      </div>

      {/* Equity chart */}
      <div
        style={{
          background: "rgba(255,255,255,0.025)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: "14px 16px",
          marginBottom: 18,
        }}
      >
        <Sk w="36%" h={10} mb={14} />
        <Sk w="100%" h={74} />
      </div>

      {/* Trade rows */}
      <Sk w="30%" h={10} mb={10} />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{ marginBottom: 8, borderRadius: 9, overflow: "hidden", height: 46 }}
        >
          <span className="skel" style={{ display: "block", width: "100%", height: "100%" }} />
        </div>
      ))}
    </>
  );
}

// ── Day equity progression chart ──────────────────────────────

function DayEquityChart({
  trades,
  balanceAfter,
  dayPnl,
}: {
  trades: DrawerTrade[];
  balanceAfter: number | null;
  dayPnl: number;
}) {
  if (balanceAfter == null || trades.length === 0) return null;

  const startBal = balanceAfter - dayPnl;
  const rawPoints: number[] = [startBal];
  let running = startBal;
  let peak = startBal;
  let maxDD = 0;

  for (const t of trades) {
    running += t.pnl ?? 0;
    rawPoints.push(running);
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  }

  const isWin = dayPnl >= 0;
  const stroke = isWin ? "#35D48A" : "#FF5C6C";
  const gradId = isWin ? "eqFillG" : "eqFillR";
  const W = 400, H = 120, yPad = 14, xPad = 4;
  const minV = Math.min(...rawPoints);
  const maxV = Math.max(...rawPoints);
  const yRange = Math.max(maxV - minV, 1);
  const xStep = rawPoints.length > 1 ? (W - xPad * 2) / (rawPoints.length - 1) : W - xPad * 2;

  const toX = (i: number) => (xPad + i * xStep).toFixed(1);
  const toY = (v: number) => (H - yPad - ((v - minV) / yRange) * (H - 2 * yPad)).toFixed(1);

  const pts: Array<[string, string]> = rawPoints.map((v, i) => [toX(i), toY(v)]);

  // Smooth bezier: horizontal tangents between each point
  let linePath = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const cpx = ((parseFloat(x0) + parseFloat(x1)) / 2).toFixed(1);
    linePath += ` C${cpx},${y0} ${cpx},${y1} ${x1},${y1}`;
  }
  const lastPt = pts[pts.length - 1];
  const fillPath = `${linePath} L${lastPt[0]},${H} L${pts[0][0]},${H} Z`;

  // Horizontal grid lines
  const gridYs = [0.25, 0.5, 0.75].map((t) =>
    (yPad + (H - 2 * yPad) * t).toFixed(1),
  );

  return (
    <div className="cdd-equity">
      <p className="cdd-equity-title">Day Progression</p>
      <div className="cdd-equity-meta">
        <span className="cdd-equity-start">Open ${startBal.toLocaleString()}</span>
        <span className={`cdd-equity-end ${isWin ? "green" : "red"}`}>
          Close ${balanceAfter.toLocaleString()}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="cdd-equity-svg">
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.01" />
          </linearGradient>
        </defs>
        {gridYs.map((y, i) => (
          <line key={i} x1={xPad} y1={y} x2={W - xPad} y2={y}
            stroke="rgba(148,163,184,0.08)" strokeWidth="1" />
        ))}
        <path d={fillPath} fill={`url(#${gradId})`} />
        <path d={linePath} stroke={stroke} strokeWidth="2.5" fill="none"
          strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={lastPt[0]} cy={lastPt[1]} r="4.5" fill={stroke} />
        <circle cx={lastPt[0]} cy={lastPt[1]} r="8" fill={stroke} fillOpacity="0.18" />
      </svg>
      {maxDD > 0 && (
        <p className="cdd-equity-drawdown">↓ Max DD −${maxDD.toFixed(0)}</p>
      )}
    </div>
  );
}

// ── No-trade empty state ──────────────────────────────────────

function EmptyNoTradeState({ dateLabel }: { dateLabel: string }) {
  return (
    <div className="cdd-no-trade">
      <div className="cdd-no-trade-icon">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
          stroke="rgba(148,163,184,0.35)" strokeWidth="1.3"
          strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/>
          <line x1="8"  y1="2" x2="8"  y2="6"/>
          <line x1="3"  y1="10" x2="21" y2="10"/>
        </svg>
      </div>
      <p className="cdd-no-trade-h">No trades logged</p>
      <p className="cdd-no-trade-sub">
        Use {dateLabel} to record market context or note why you stayed out.
      </p>
      <div className="cdd-no-trade-btns">
        <button className="cdd-btn outline" disabled>Add Journal Note</button>
        <button className="cdd-btn primary" disabled>Add Manual Trade</button>
      </div>
      <p className="cdd-no-trade-hint">
        Documenting no-trade days builds discipline awareness over time.
      </p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

export default function ChallengeDayDrawer({
  open,
  date,
  calDay,
  detail,
  loading,
  error,
  allCalDays,
  onClose,
  onNavigate,
  onRefetch,
}: Props) {
  const { getToken } = useAuth();

  const [editingNotes, setEditingNotes] = useState(false);
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({});
  const [noteSaving, setNoteSaving] = useState(false);
  const [noteSaveError, setNoteSaveError] = useState<string | null>(null);

  useEffect(() => {
    setEditingNotes(false);
    setNoteEdits({});
    setNoteSaveError(null);
  }, [date]);

  const sortedDays = useMemo(
    () => [...allCalDays].sort((a, b) => a.date.localeCompare(b.date)),
    [allCalDays],
  );

  const idx = date ? sortedDays.findIndex((d) => d.date === date) : -1;
  const prevDay = idx > 0 ? sortedDays[idx - 1] : null;
  const nextDay = idx >= 0 && idx < sortedDays.length - 1 ? sortedDays[idx + 1] : null;

  const dateLabel = date
    ? new Date(date + "T12:00:00Z").toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : "—";

  const tdLabel =
    calDay?.td_number && calDay.td_number > 0 ? `TD ${calDay.td_number} of 90` : null;

  const isNoTradeDay =
    !loading && !error && (!detail || detail.trades.length === 0) && calDay?.status === "no_trade";

  const dayPnl = detail?.day_pnl ?? calDay?.day_pnl ?? 0;
  const sessionStopReached = dayPnl <= -150;
  const bestGrade = calDay?.best_grade ?? null;
  const tradeCount = calDay?.trade_count ?? 0;
  const winRate = detail?.win_rate ?? null;
  const avgR = detail?.avg_r_multiple ?? null;
  const trades = detail?.trades ?? [];
  const editableTrades = trades.filter((t) => t.id);

  const hasProcessReview = trades.some((t) => t.process_review);
  const hasNotes = trades.some((t) => t.notes);

  // ── Edit Notes ────────────────────────────────────────────────

  function handleEditNotes() {
    const initial: Record<string, string> = {};
    for (const t of trades) {
      if (t.id) initial[t.id] = t.notes ?? "";
    }
    setNoteEdits(initial);
    setNoteSaveError(null);
    setEditingNotes(true);
  }

  function handleCancelEdit() {
    setEditingNotes(false);
    setNoteEdits({});
    setNoteSaveError(null);
  }

  async function handleSaveNotes() {
    if (!detail || editableTrades.length === 0) return;
    setNoteSaving(true);
    setNoteSaveError(null);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };
      const results = await Promise.all(
        editableTrades.map((t) =>
          fetch(`${API}/journal/entry/${t.id}`, {
            method: "PATCH",
            headers,
            body: JSON.stringify({ notes: noteEdits[t.id!] ?? "" }),
          }),
        ),
      );
      if (results.some((r) => !r.ok)) {
        setNoteSaveError("Some notes failed to save — try again");
      } else {
        setEditingNotes(false);
        setNoteEdits({});
        onRefetch?.();
      }
    } catch {
      setNoteSaveError("Could not reach server — try again");
    } finally {
      setNoteSaving(false);
    }
  }

  function handleClose() {
    setEditingNotes(false);
    setNoteEdits({});
    setNoteSaveError(null);
    onClose();
  }

  // ── Render ────────────────────────────────────────────────────

  return (
    <>
      <div
        className={`cdd-overlay${open ? " open" : ""}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      <aside
        className={`cdd-drawer${open ? " open" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Day Detail"
      >
        {/* ── Drawer header ──────────────────────────── */}
        <div className="cdd-head">
          <div className="cdd-head-top">
            <span className="cdd-head-title">Day Detail</span>
            <div className="cdd-head-actions">
              <button
                className="cdd-nav-btn"
                disabled={!prevDay}
                onClick={() => prevDay && onNavigate(prevDay.date)}
                aria-label="Previous day"
              >‹</button>
              <button
                className="cdd-nav-btn"
                disabled={!nextDay}
                onClick={() => nextDay && onNavigate(nextDay.date)}
                aria-label="Next day"
              >›</button>
              <button className="cdd-close-btn" onClick={handleClose} aria-label="Close">
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* ── Drawer body ────────────────────────────── */}
        <div className="cdd-body">

          {/* Loading skeleton */}
          {loading ? (
            <DayDetailSkeleton />

          /* Error state */
          ) : error ? (
            <div className="cdd-empty-state">
              <p style={{ color: "var(--otd-red)", marginBottom: 14 }}>{error}</p>
              {onRefetch && (
                <button
                  onClick={onRefetch}
                  className="cdd-btn primary"
                  style={{ width: "auto", padding: "8px 24px", flex: "none" }}
                >
                  Retry
                </button>
              )}
            </div>

          /* No-trade day */
          ) : isNoTradeDay ? (
            <EmptyNoTradeState dateLabel={dateLabel} />

          /* Traded day — full content */
          ) : (
            <>
              {/* ── Day identity strip ─────────────── */}
              <div className="cdd-identity">
                <div className={`cdd-identity-grade ${gradeKey(bestGrade)}`}>
                  {bestGrade ?? "—"}
                </div>
                <div className="cdd-identity-info">
                  <p className="cdd-identity-date">{dateLabel}</p>
                  {tdLabel && <p className="cdd-identity-meta">{tdLabel}</p>}
                </div>
                {tradeCount > 0 && (
                  <p className={`cdd-identity-pnl ${dayPnl >= 0 ? "green" : "red"}`}>
                    {fmtPnl(dayPnl)}
                  </p>
                )}
              </div>

              {/* ── KPI 2×3 grid ──────────────────── */}
              <div className="cdd-summary">
                <div className="cdd-sum-cell">
                  <p className="cdd-sum-k">Day P&amp;L</p>
                  <p className={`cdd-sum-v ${tradeCount === 0 ? "" : dayPnl > 0 ? "green" : dayPnl < 0 ? "red" : ""}`}>
                    {tradeCount === 0 ? "—" : fmtPnl(dayPnl)}
                  </p>
                </div>

                <div className="cdd-sum-cell">
                  <p className="cdd-sum-k">Process Grade</p>
                  {bestGrade ? (
                    <div className="cdd-sum-grade-wrap" style={{ background: gradeColor(bestGrade) }}>
                      {bestGrade}
                    </div>
                  ) : (
                    <p className="cdd-sum-v" style={{ color: "var(--text-dim)" }}>—</p>
                  )}
                </div>

                <div className="cdd-sum-cell">
                  <p className="cdd-sum-k">Trades Used</p>
                  <p className="cdd-sum-v blue">{tradeCount} / 3</p>
                </div>

                <div className="cdd-sum-cell">
                  <p className="cdd-sum-k">Win Rate</p>
                  <p className={`cdd-sum-v ${winRate !== null ? (winRate >= 50 ? "green" : "red") : ""}`}>
                    {winRate !== null ? `${winRate}%` : "—"}
                  </p>
                </div>

                <div className="cdd-sum-cell">
                  <p className="cdd-sum-k">Avg R</p>
                  <p className={`cdd-sum-v ${avgR !== null ? (avgR >= 0 ? "green" : "red") : ""}`}>
                    {avgR !== null ? `${avgR >= 0 ? "+" : ""}${avgR.toFixed(2)}R` : "—"}
                  </p>
                </div>

                <div className="cdd-sum-cell">
                  <p className="cdd-sum-k">Session Stop</p>
                  <p className={`cdd-sum-v ${sessionStopReached ? "red" : "amber"}`} style={{ fontSize: 12, lineHeight: 1.3 }}>
                    {sessionStopReached ? "REACHED" : "Not Reached"}
                  </p>
                </div>
              </div>

              {/* ── Day progression chart ──────────── */}
              <DayEquityChart
                trades={trades}
                balanceAfter={detail?.balance_after ?? null}
                dayPnl={dayPnl}
              />

              {/* ── Trade cards ────────────────────── */}
              {trades.length > 0 && (
                <div className="cdd-trades" style={{ marginBottom: 20 }}>
                  <p className="cdd-section">Trades · {trades.length}</p>
                  {trades.map((t, i) => {
                    const dir = (t.direction ?? "").toLowerCase();
                    const dirClass = dir === "call" ? "call" : dir === "put" ? "put" : "unknown";
                    const dirLabel = dir === "call" ? "CALL" : dir === "put" ? "PUT" : (t.direction ?? "—").toUpperCase();
                    const pnlClass = t.pnl == null ? "muted" : t.pnl > 0 ? "green" : t.pnl < 0 ? "red" : "muted";
                    const rClass   = t.r_multiple == null ? "" : t.r_multiple >= 0 ? "green" : "red";
                    const entryExit = t.entry_premium != null && t.exit_premium != null
                      ? `Entry ${t.entry_premium.toFixed(2)} → Exit ${t.exit_premium.toFixed(2)}`
                      : t.entry_premium != null
                        ? `Entry ${t.entry_premium.toFixed(2)}`
                        : null;
                    return (
                      <div key={i} className="cdd-trade-card">
                        <div className="cdd-trade-card-top">
                          <div className="cdd-trade-card-badges">
                            <span className="cdd-trade-setup-badge">{t.setup ?? "—"}</span>
                            <span className={`cdd-trade-dir-badge ${dirClass}`}>{dirLabel}</span>
                          </div>
                          <span className={`cdd-trade-card-pnl ${pnlClass}`}>
                            {t.pnl != null ? fmtPnl(t.pnl) : "—"}
                          </span>
                        </div>
                        <div className="cdd-trade-card-mid">
                          {entryExit && (
                            <span className="cdd-trade-card-entry-exit">{entryExit}</span>
                          )}
                          <div className="cdd-trade-card-metrics">
                            {t.r_multiple != null && (
                              <span className={`cdd-trade-card-r ${rClass}`}>
                                {t.r_multiple >= 0 ? "+" : ""}{t.r_multiple.toFixed(2)}R
                              </span>
                            )}
                            {t.grade && (
                              <span className={`cdd-trade-card-grade grade-${gradeKey(t.grade)}`}>
                                {t.grade}
                              </span>
                            )}
                          </div>
                        </div>
                        {t.notes && <p className="cdd-trade-card-note">{t.notes}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Notes panel ───────────────────── */}
              {!editingNotes ? (
                <div style={{ marginBottom: 18 }}>
                  <p className="cdd-section">Notes</p>

                  {/* Process Review */}
                  {hasProcessReview && (
                    <div className="cdd-notes-block" style={{ marginBottom: 8 }}>
                      <p className="cdd-notes-block-head">Process Review</p>
                      {trades.filter((t) => t.process_review).map((t, i) => (
                        <p key={i} className="cdd-notes-block-text">{t.process_review}</p>
                      ))}
                    </div>
                  )}

                  {/* Journal Note (from trade notes) */}
                  {hasNotes ? (
                    <div className="cdd-notes-block" style={{ marginBottom: 8 }}>
                      <p className="cdd-notes-block-head">Journal Note</p>
                      {trades.filter((t) => t.notes).map((t, i) => (
                        <p key={i} className="cdd-notes-block-text">
                          {trades.filter((x) => x.notes).length > 1 && (
                            <span style={{ fontSize: 10, color: "var(--otd-text-soft)", display: "block", marginBottom: 4 }}>
                              Trade {trades.indexOf(t) + 1} · {t.setup ?? "—"}
                            </span>
                          )}
                          {t.notes}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <button className="cdd-notes-add" onClick={handleEditNotes}>
                      + Add journal note — capture the lesson while it&apos;s fresh
                    </button>
                  )}

                  {/* What went well / to improve */}
                  <div className="cdd-note-2col">
                    <div className="cdd-notes-block">
                      <div className="cdd-note-icon-row">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke="#35D48A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <span className="cdd-note-icon-label">Went well</span>
                      </div>
                      <button className="cdd-note-action" onClick={handleEditNotes}>
                        + Add what went well
                      </button>
                    </div>
                    <div className="cdd-notes-block">
                      <div className="cdd-note-icon-row">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                          stroke="#F6C453" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10"/>
                          <line x1="12" y1="8" x2="12" y2="12"/>
                          <line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                        <span className="cdd-note-icon-label">Improve</span>
                      </div>
                      <button className="cdd-note-action" onClick={handleEditNotes}>
                        + Add one improvement
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* ── Edit notes mode ──────────────── */
                <div style={{ marginBottom: 18 }}>
                  <p className="cdd-section">Edit Notes</p>
                  {editableTrades.map((t) => (
                    <div key={t.id} className="cdd-notes-block" style={{ marginBottom: 8 }}>
                      {editableTrades.length > 1 && (
                        <p className="cdd-notes-block-head">
                          Trade {trades.indexOf(t) + 1} · {t.setup ?? "—"}
                        </p>
                      )}
                      <textarea
                        value={noteEdits[t.id!] ?? ""}
                        onChange={(e) => setNoteEdits((prev) => ({ ...prev, [t.id!]: e.target.value }))}
                        rows={3}
                        placeholder="Add a note…"
                        style={{
                          width: "100%",
                          background: "rgba(255,255,255,0.04)",
                          border: "1px solid var(--border-mid)",
                          borderRadius: 7,
                          color: "var(--text-bright)",
                          fontSize: 12.5,
                          padding: "8px 10px",
                          resize: "vertical",
                          fontFamily: "var(--sans)",
                          lineHeight: 1.5,
                          outline: "none",
                          display: "block",
                        }}
                      />
                    </div>
                  ))}
                  {noteSaveError && (
                    <p style={{ fontSize: 11, color: "var(--otd-red)", marginTop: 6 }}>{noteSaveError}</p>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────── */}
        <div className="cdd-footer">
          {editingNotes ? (
            <>
              <button className="cdd-btn outline" onClick={handleCancelEdit} disabled={noteSaving}>Cancel</button>
              <button
                className="cdd-btn primary"
                onClick={handleSaveNotes}
                disabled={noteSaving || editableTrades.length === 0}
              >
                {noteSaving ? "Saving…" : "Save Notes"}
              </button>
            </>
          ) : (
            <>
              <Link href="/journal" className="cdd-btn outline">View Full Journal</Link>
              <button
                className="cdd-btn primary"
                onClick={handleEditNotes}
                disabled={!detail || trades.length === 0 || editableTrades.length === 0}
              >
                Edit Notes
              </button>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
