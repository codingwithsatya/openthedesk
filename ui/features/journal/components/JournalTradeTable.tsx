"use client";

import { useState } from "react";
import s from "@/features/journal/styles/journalTradeTable.module.css";
import type { JournalEntry } from "@/features/journal/lib/types";
import { fmtRMult } from "@/features/journal/lib/helpers";

const ACTION_LABELS: Record<string, string> = {
  edit_trade: "Edit trade",
  close_trade: "Close trade",
  delete_trade: "Delete",
  view_review: "View review",
  edit_notes: "Edit notes",
  rerun_review: "Re-run review",
  duplicate_trade: "Duplicate",
};

interface JournalTradeTableProps {
  entries: JournalEntry[];
  totalPnl: string;
  avgWinner: string;
  avgLoser: string;
  winRate: string;
  profitFactor: string;
  expectancy: string;
  onExport: () => void;
  onAction: (action: string, entry: JournalEntry) => void;
  offset: number;
  limit: number;
  hasMore: boolean;
  onPageChange: (newOffset: number) => void;
}

function fmtTime(createdAt: string) {
  try {
    return new Date(createdAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function pnlText(v: number | null) {
  if (v == null) return "Open";
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${v >= 0 ? "+" : "-"}$${abs}`;
}

function directionClass(direction: string) {
  const d = direction.toUpperCase();
  if (d === "BULL" || d === "CALL" || d.includes("BULL")) return `${s.badge} ${s.badgeGreen}`;
  if (d === "BEAR" || d === "PUT" || d.includes("BEAR")) return `${s.badge} ${s.badgeRed}`;
  return `${s.badge} ${s.badgeBlue}`;
}

function gradeClass(grade: string) {
  if (grade === "A+" || grade === "A") return `${s.grade} ${s.gradeGood}`;
  if (grade === "B") return `${s.grade} ${s.gradeWarn}`;
  return `${s.grade} ${s.gradeNeutral}`;
}

export default function JournalTradeTable({
  entries,
  totalPnl,
  avgWinner,
  avgLoser,
  winRate,
  profitFactor,
  expectancy,
  onExport,
  onAction,
  offset,
  limit,
  hasMore,
  onPageChange,
}: JournalTradeTableProps) {
  const [menuId, setMenuId] = useState<string | null>(null);

  const wins = entries.filter((e) => (e.pnl ?? 0) > 0).length;
  const losses = entries.filter(
    (e) => e.status !== "open" && (e.pnl ?? 0) <= 0,
  ).length;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <>
      <div className={s.tableCard} onClick={() => setMenuId(null)}>
        <div className={s.header}>
          <span>Date</span>
          <span>Time</span>
          <span>Setup</span>
          <span>Direction</span>
          <span>Instrument</span>
          <span>Entry</span>
          <span>Exit</span>
          <span>P&L</span>
          <span>R-Mult</span>
          <span>Grade</span>
          <span>Process</span>
          <span>Tags</span>
          <span />
          <span />
        </div>

        {entries.length === 0 ? (
          <div className={s.empty}>No trades match this filter</div>
        ) : (
          entries.map((e) => {
            const isBull =
              e.direction?.toUpperCase().includes("BULL") ||
              e.direction?.toUpperCase() === "CALL";
            const isOpen = e.status === "open" || e.pnl == null;
            const isWin = (e.pnl ?? 0) > 0;
            const pnlClass = isOpen ? s.mono : isWin ? s.pnlWin : s.pnlLoss;
            const actions: string[] =
              e.row_actions?.length
                ? e.row_actions
                : isOpen
                  ? ["edit_trade", "close_trade", "delete_trade"]
                  : ["view_review", "edit_notes", "rerun_review", "duplicate_trade", "delete_trade"];

            return (
              <div
                className={s.row}
                key={e.id}
                style={{ position: "relative" }}
                onClick={() => setMenuId(null)}
              >
                <span className={s.mono}>{e.date.slice(5)}</span>
                <span className={s.mono}>{fmtTime(e.created_at)}</span>

                <span>
                  <span className={directionClass(e.direction)}>{e.setup}</span>
                </span>

                <span className={isBull ? s.bull : s.bear}>
                  {isBull ? "Bull ↑" : "Bear ↓"}
                </span>

                <span className={s.symbol}>
                  {e.instrument || e.ticker || "SPX"}
                </span>

                <span className={s.mono}>
                  {e.entry_price != null ? e.entry_price.toFixed(2) : "—"}
                </span>

                <span className={s.mono}>
                  {e.exit_price != null ? e.exit_price.toFixed(2) : "—"}
                </span>

                <span className={pnlClass}>{pnlText(e.pnl)}</span>

                <span className={pnlClass}>{fmtRMult(e.r_multiple)}</span>

                <span>
                  <span className={gradeClass(e.grade)}>{e.grade || "—"}</span>
                </span>

                <span>
                  <span className={gradeClass(e.process_grade)}>
                    {e.process_grade || "—"}
                  </span>
                </span>

                <span>
                  {e.tags ? (
                    <span className={s.tag}>{e.tags}</span>
                  ) : (
                    <span style={{ color: "rgba(100,116,139,0.6)" }}>—</span>
                  )}
                </span>

                {/* Comment/review icon */}
                <span
                  className={s.comment}
                  title={e.process_review ?? "No review yet"}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    if (e.process_review) onAction("view_review", e);
                  }}
                  style={{ cursor: e.process_review ? "pointer" : "default", opacity: e.process_review ? 1 : 0.35 }}
                >
                  💬
                </span>

                {/* Three-dot menu */}
                <span
                  className={s.more}
                  style={{ cursor: "pointer", position: "relative" }}
                  onClick={(ev) => {
                    ev.stopPropagation();
                    setMenuId(menuId === e.id ? null : e.id);
                  }}
                >
                  ⋮
                  {menuId === e.id && (
                    <div
                      style={{
                        position: "absolute",
                        right: 0,
                        top: "100%",
                        zIndex: 100,
                        background: "#0d1828",
                        border: "1px solid rgba(59,130,246,0.25)",
                        borderRadius: 8,
                        minWidth: 160,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        overflow: "hidden",
                      }}
                      onClick={(ev) => ev.stopPropagation()}
                    >
                      {actions.map((action) => (
                        <button
                          key={action}
                          style={{
                            display: "block",
                            width: "100%",
                            padding: "9px 14px",
                            background: "none",
                            border: "none",
                            borderBottom: "1px solid rgba(30,58,95,0.4)",
                            color: action === "delete_trade" ? "#f87171" : "#94a3b8",
                            fontSize: 12,
                            textAlign: "left",
                            cursor: "pointer",
                            fontFamily: "var(--font-inter), sans-serif",
                            fontWeight: 500,
                          }}
                          onMouseEnter={(ev) => {
                            (ev.currentTarget as HTMLElement).style.background = "rgba(37,99,235,0.12)";
                            if (action !== "delete_trade")
                              (ev.currentTarget as HTMLElement).style.color = "#f1f5f9";
                          }}
                          onMouseLeave={(ev) => {
                            (ev.currentTarget as HTMLElement).style.background = "none";
                            (ev.currentTarget as HTMLElement).style.color =
                              action === "delete_trade" ? "#f87171" : "#94a3b8";
                          }}
                          onClick={() => {
                            setMenuId(null);
                            onAction(action, e);
                          }}
                        >
                          {ACTION_LABELS[action] ?? action}
                        </button>
                      ))}
                    </div>
                  )}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className={s.summary}>
        <div>
          <div className={s.summaryLabel}>{entries.length} Trades</div>
          <div className={s.summaryValueSmall}>
            {wins}W / {losses}L
          </div>
        </div>

        <div>
          <div className={s.summaryLabel}>Total P&L</div>
          <div className={s.summaryValueGreen}>{totalPnl}</div>
        </div>

        <div>
          <div className={s.summaryLabel}>Avg Win</div>
          <div className={s.summaryValueGreen}>{avgWinner}</div>
        </div>

        <div>
          <div className={s.summaryLabel}>Avg Loss</div>
          <div className={s.summaryValueRed}>{avgLoser}</div>
        </div>

        <div>
          <div className={s.summaryLabel}>Win Rate</div>
          <div className={s.summaryValue}>{winRate}</div>
        </div>

        <div>
          <div className={s.summaryLabel}>Profit Factor</div>
          <div className={s.summaryValue}>{profitFactor}</div>
        </div>

        <div>
          <div className={s.summaryLabel}>Expectancy</div>
          <div className={s.summaryValueGreen}>{expectancy}</div>
        </div>

        <div className={s.summaryActions}>
          <button className={s.exportButton} onClick={onExport}>
            ↓ Download CSV
          </button>
          <button
            className={s.pageButton}
            onClick={() => onPageChange(Math.max(0, offset - limit))}
            disabled={offset === 0}
            style={{ opacity: offset === 0 ? 0.35 : 1 }}
          >
            ‹
          </button>
          <button className={`${s.pageButton} ${s.pageActive}`}>
            {currentPage}
          </button>
          <button
            className={s.pageButton}
            onClick={() => onPageChange(offset + limit)}
            disabled={!hasMore}
            style={{ opacity: !hasMore ? 0.35 : 1 }}
          >
            ›
          </button>
        </div>
      </div>
    </>
  );
}
