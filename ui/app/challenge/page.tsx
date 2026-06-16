"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Header from "../components/Header";
import StartChallengeModal from "../components/StartChallengeModal";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────
interface ChallengeData {
  id: string;
  name?: string;
  start_date: string;
  start_balance: number;
  monthly_target?: number;
  target_days: number;
  status: string;
}

interface ChallengeStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  current_balance: number;
  avg_winner: number;
  avg_loser: number;
  best_setup: string | null;
  process_grades: { A_plus: number; A: number; B: number; C: number };
}

interface CalendarDay {
  date: string;
  status: "win" | "loss" | "no_trade";
}

interface Lesson {
  setup: string;
  losses: number;
  verdict_summary: string;
}

interface FullChallengeResponse {
  active: boolean;
  challenge?: ChallengeData;
  day_number?: number;
  stats?: ChallengeStats;
  calendar?: CalendarDay[];
  lessons?: Lesson[];
}

interface PastChallenge extends ChallengeData {
  stats: ChallengeStats;
}

// ── Helpers ───────────────────────────────────────────────────
function fmtPnl(v: number) {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${v >= 0 ? "+" : "-"}$${abs}`;
}

function fmtDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ── Calendar grid ─────────────────────────────────────────────
// Accepts challengeStartDate so days before challenge are "pre-ch" (blank),
// not "no_trade". Today gets its own state regardless of trade status.
function buildMonthGrid(
  year: number,
  month: number,
  calendarDays: CalendarDay[],
  challengeStartDate: string
) {
  const byDate = new Map(calendarDays.map((d) => [d.date, d.status]));
  const today = new Date().toISOString().split("T")[0];

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  const startDow = firstDay.getDay();
  const offsetBack = startDow === 0 ? 6 : startDow - 1;
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - offsetBack);

  const rows: Array<
    Array<{ date: string; inMonth: boolean; isWeekend: boolean; status: string; dayNum: number }>
  > = [];
  let current = new Date(gridStart);

  while (current <= lastDay || rows.length < 5) {
    const row: (typeof rows)[0] = [];
    for (let d = 0; d < 7; d++) {
      const iso = current.toISOString().split("T")[0];
      const inMonth =
        current.getMonth() === month && current.getFullYear() === year;
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      const dayNum = current.getDate();

      let status = "out-month";
      if (isWeekend) {
        status = inMonth ? "weekend" : "out-month";
      } else if (!inMonth) {
        status = "out-month";
      } else if (iso < challengeStartDate) {
        status = "pre-ch";
      } else if (iso === today) {
        status = "today";
      } else if (iso > today) {
        status = "future";
      } else {
        status = byDate.get(iso) ?? "no_trade";
      }

      // normalize no_trade to CSS-safe name
      if (status === "no_trade") status = "no-trade";

      row.push({ date: iso, inMonth, isWeekend, status, dayNum });
      current.setDate(current.getDate() + 1);
    }
    rows.push(row);
    if (current > lastDay && rows.length >= 4) break;
  }
  return rows;
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ── Icons (inline SVG, no external dependency) ────────────────
const TrophyIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 9H4a2 2 0 0 1-2-2V5h4" />
    <path d="M18 9h2a2 2 0 0 0 2-2V5h-4" />
    <path d="M12 17v4" />
    <path d="M8 21h8" />
    <path d="M7 4h10v5a5 5 0 0 1-10 0V4z" />
  </svg>
);

const CoinsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
    <path d="M7 6h1v4" />
    <path d="m16.71 13.88.7.71-2.82 2.82" />
  </svg>
);

const CandleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5v4" />
    <rect width="4" height="6" x="7" y="9" rx="1" />
    <path d="M9 15v4" />
    <path d="M17 3v2" />
    <rect width="4" height="8" x="15" y="5" rx="1" />
    <path d="M17 13v3" />
  </svg>
);

const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
  </svg>
);

const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ChevronLeft = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6" />
  </svg>
);

const ChevronRight = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6" />
  </svg>
);

// ── Sub-components ────────────────────────────────────────────
function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="ch-stat">
      <div className="ch-stat-label">{label}</div>
      <div className="ch-stat-value" style={{ color: color ?? "#f1f5f9" }}>
        {value}
      </div>
      {sub && <div className="ch-stat-sub">{sub}</div>}
    </div>
  );
}

function GradeRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="ch-grade-row">
      <span className="ch-grade-lbl" style={{ color }}>
        {label}
      </span>
      <div className="ch-grade-track">
        <div
          className="ch-grade-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="ch-grade-count">{count}</span>
    </div>
  );
}

function PastRow({ ch }: { ch: PastChallenge }) {
  const s = ch.stats;
  const pnlColor = s.total_pnl >= 0 ? "#22c55e" : "#ef4444";
  return (
    <div className="ch-past-row">
      <div style={{ flex: 1 }}>
        <div className="ch-past-name">{ch.name ?? "Challenge"}</div>
        <div className="ch-past-date">{fmtDate(ch.start_date)}</div>
      </div>
      <div>
        <div className="ch-past-pnl" style={{ color: pnlColor }}>
          {fmtPnl(s.total_pnl)}
        </div>
        <div className="ch-past-meta">
          {s.win_rate}% WR · {s.total_trades} trades
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function ChallengePage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<FullChallengeResponse | null>(null);
  const [past, setPast] = useState<PastChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const load = useCallback(async () => {
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const [statsRes, allRes] = await Promise.all([
        fetch(`${API}/challenge/stats`, { headers }),
        fetch(`${API}/challenge/all`, { headers }),
      ]);
      if (statsRes.ok) setData(await statsRes.json());
      if (allRes.ok) {
        const allData = await allRes.json();
        setPast(
          (allData.challenges ?? []).filter(
            (c: PastChallenge) => c.status !== "active"
          )
        );
      }
    } catch {}
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    load();
  }, [load]);

  // ── Derived values ───────────────────────────────────────────
  const isActive = data?.active === true;
  const ch = data?.challenge;
  const stats = data?.stats;
  const calendar = data?.calendar ?? [];
  const lessons = data?.lessons ?? [];
  const dayNumber = data?.day_number ?? 1;
  const dayPct = Math.min(100, (dayNumber / 90) * 100);

  const totalGrades = stats
    ? stats.process_grades.A_plus +
      stats.process_grades.A +
      stats.process_grades.B +
      stats.process_grades.C
    : 0;
  const aApluspct =
    stats && totalGrades > 0
      ? Math.round(
          ((stats.process_grades.A_plus + stats.process_grades.A) /
            totalGrades) *
            100
        )
      : 0;

  const startBalance = ch?.start_balance ?? 500;
  const accountPct =
    stats && startBalance > 0
      ? ((stats.total_pnl / startBalance) * 100).toFixed(1)
      : "0.0";

  const gridRows = buildMonthGrid(
    calMonth.year,
    calMonth.month,
    calendar,
    ch?.start_date ?? "9999-99-99"
  );

  const monthLabel = new Date(
    calMonth.year,
    calMonth.month
  ).toLocaleDateString("en-US", { month: "long", year: "numeric" });

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="ch-page">
        <Header
          deskOpen={false}
          refreshing={false}
          onRefresh={() => {}}
          onClearSession={() => {}}
          marketData={null}
          activePage="challenge"
        />
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#334155",
            fontSize: 13,
            fontFamily: "var(--sans)",
          }}
        >
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="ch-page">
      <Header
        deskOpen={false}
        refreshing={false}
        onRefresh={() => {}}
        onClearSession={() => {}}
        marketData={null}
        activePage="challenge"
      />

      <div className="ch-body">
        {/* ── Empty state ──────────────────────────────────── */}
        {!isActive && (
          <>
            <div className="ch-empty">
              {/* Trophy */}
              <div className="ch-trophy-wrap">
                <TrophyIcon />
              </div>

              <h1 className="ch-title">Saty 90-Day Challenge</h1>

              <p className="ch-subtitle">
                90 trading days. Prove consistency before sizing up.
                Process first — P&amp;L is the byproduct.
              </p>

              {/* Saty quote */}
              <blockquote className="ch-quote">
                Don&apos;t size up until you are consistent for at least 90
                days. A year is even better. In 90 days you will see A LOT of
                different market conditions.
                <span className="ch-quote-attr">— Saty Mahajan</span>
              </blockquote>

              <button
                className="ch-start-btn"
                onClick={() => setShowModal(true)}
              >
                Start Challenge — Day 1 begins today
              </button>
            </div>

            {/* Rules */}
            <div className="ch-rules">
              <hr className="ch-rules-divider" />
              <div className="ch-rules-label">
                Phase 2 rules — active throughout
              </div>
              <div className="ch-rules-grid">
                <div className="ch-rule-card">
                  <div className="ch-rule-icon">
                    <CoinsIcon />
                  </div>
                  <div className="ch-rule-title">Starting balance</div>
                  <div className="ch-rule-value">$500</div>
                </div>
                <div className="ch-rule-card">
                  <div className="ch-rule-icon">
                    <CandleIcon />
                  </div>
                  <div className="ch-rule-title">Premium range</div>
                  <div className="ch-rule-value">$3 – $4</div>
                </div>
                <div className="ch-rule-card">
                  <div className="ch-rule-icon">
                    <ShieldIcon />
                  </div>
                  <div className="ch-rule-title">Max loss / session</div>
                  <div className="ch-rule-value">–$150</div>
                </div>
                <div className="ch-rule-card">
                  <div className="ch-rule-icon">
                    <StarIcon />
                  </div>
                  <div className="ch-rule-title">Setups only</div>
                  <div className="ch-rule-value">A / A+</div>
                </div>
              </div>
            </div>

            {/* Past challenges */}
            {past.length > 0 && (
              <div className="ch-past">
                <div className="ch-past-label">Past challenges</div>
                {past.map((c) => (
                  <PastRow key={c.id} ch={c} />
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Active dashboard ─────────────────────────────── */}
        {isActive && ch && stats && (
          <>
            {/* Header */}
            <div className="ch-header">
              <div className="ch-header-row">
                <div>
                  <span className="ch-active-badge">ACTIVE</span>
                  <div className="ch-name">{ch.name ?? "90-Day Challenge"}</div>
                  <div className="ch-start-date">
                    Started {fmtDate(ch.start_date)}
                  </div>
                </div>
                <div>
                  <div className="ch-balance">
                    ${stats.current_balance.toLocaleString()}
                  </div>
                  <div className="ch-balance-sub">
                    ${startBalance.toLocaleString()} →{" "}
                    ${stats.current_balance.toLocaleString()} · {stats.total_pnl >= 0 ? "+" : ""}
                    {accountPct}%
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="ch-progress-wrap">
                <div className="ch-progress-track">
                  <div
                    className="ch-progress-fill"
                    style={{ width: `${dayPct}%` }}
                  />
                </div>
                <div className="ch-progress-label">
                  Day {dayNumber} / {ch.target_days}
                </div>
              </div>
            </div>

            {/* Stat cards */}
            <div className="ch-stats">
              <StatCard
                label="Total P&L"
                value={fmtPnl(stats.total_pnl)}
                sub={`${stats.total_pnl >= 0 ? "+" : ""}${accountPct}% account`}
                color={stats.total_pnl >= 0 ? "#22c55e" : "#ef4444"}
              />
              <StatCard
                label="Win Rate"
                value={
                  stats.total_trades > 0 ? `${stats.win_rate}%` : "—"
                }
                sub={`${stats.wins}W · ${stats.losses}L`}
                color="#22d3ee"
              />
              <StatCard
                label="Avg Winner"
                value={stats.avg_winner !== 0 ? fmtPnl(stats.avg_winner) : "—"}
                sub={
                  stats.avg_loser !== 0
                    ? `vs avg loss ${fmtPnl(stats.avg_loser)}`
                    : "no losses"
                }
                color="#22c55e"
              />
              <StatCard
                label="Process A/A+"
                value={stats.total_trades > 0 ? `${aApluspct}%` : "—"}
                sub={
                  totalGrades > 0
                    ? `${stats.process_grades.A_plus + stats.process_grades.A} of ${totalGrades} trades`
                    : "no grades yet"
                }
                color="#f1f5f9"
              />
              <StatCard
                label="Best Setup"
                value={stats.best_setup ?? "—"}
                color="#f59e0b"
              />
            </div>

            {/* Two-column: calendar + right panels */}
            <div className="ch-main">
              {/* Calendar */}
              <div className="ch-cal">
                <div className="ch-cal-nav">
                  <button
                    className="ch-cal-nav-btn"
                    onClick={() =>
                      setCalMonth(({ year, month }) =>
                        month === 0
                          ? { year: year - 1, month: 11 }
                          : { year, month: month - 1 }
                      )
                    }
                  >
                    <ChevronLeft />
                  </button>
                  <span className="ch-cal-month">{monthLabel}</span>
                  <button
                    className="ch-cal-nav-btn"
                    onClick={() =>
                      setCalMonth(({ year, month }) =>
                        month === 11
                          ? { year: year + 1, month: 0 }
                          : { year, month: month + 1 }
                      )
                    }
                  >
                    <ChevronRight />
                  </button>
                </div>

                {/* Day-of-week headers */}
                <div className="ch-cal-grid" style={{ marginBottom: 4 }}>
                  {DOW_LABELS.map((d) => (
                    <div key={d} className="ch-cal-dow">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Day cells */}
                {gridRows.map((row, ri) => (
                  <div key={ri} className="ch-cal-grid" style={{ marginBottom: 3 }}>
                    {row.map((cell, ci) => (
                      <div
                        key={ci}
                        className={`ch-cal-cell ${cell.status}`}
                        title={
                          cell.status !== "out-month" &&
                          cell.status !== "pre-ch" &&
                          cell.status !== "future"
                            ? `${cell.date}: ${cell.status.replace("-", " ")}`
                            : undefined
                        }
                      >
                        {cell.inMonth && (
                          <span>{cell.dayNum}</span>
                        )}
                        {!cell.inMonth && (
                          <span style={{ color: "#111827" }}>{cell.dayNum}</span>
                        )}
                        {(cell.status === "win" || cell.status === "loss") && (
                          <div className={`ch-cal-dot ${cell.status}`} />
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Legend */}
                <div className="ch-cal-legend">
                  {(
                    [
                      ["ch-legend-win", "Win"],
                      ["ch-legend-loss", "Loss"],
                      ["ch-legend-no-trade", "No trade"],
                      ["ch-legend-today", "Today"],
                      ["ch-legend-future", "Future"],
                    ] as [string, string][]
                  ).map(([cls, label]) => (
                    <div key={label} className="ch-cal-legend-item">
                      <div className={`ch-cal-legend-swatch ${cls}`} />
                      <span className="ch-cal-legend-label">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panels */}
              <div className="ch-right">
                {/* Process grades */}
                <div className="ch-panel">
                  <div className="ch-panel-label">Process grades</div>
                  <GradeRow
                    label="A+"
                    count={stats.process_grades.A_plus}
                    total={totalGrades}
                    color="#22c55e"
                  />
                  <GradeRow
                    label="A"
                    count={stats.process_grades.A}
                    total={totalGrades}
                    color="#22d3ee"
                  />
                  <GradeRow
                    label="B"
                    count={stats.process_grades.B}
                    total={totalGrades}
                    color="#f59e0b"
                  />
                  <GradeRow
                    label="C"
                    count={stats.process_grades.C}
                    total={totalGrades}
                    color="#ef4444"
                  />
                  <div className="ch-grade-summary">
                    {aApluspct}% A-grade execution · {stats.total_trades}{" "}
                    trade{stats.total_trades !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Where we lost */}
                <div className="ch-panel">
                  <div className="ch-panel-label">Where we lost</div>
                  {lessons.length === 0 ? (
                    <div className="ch-no-losses">
                      No losses yet — keep it that way.
                    </div>
                  ) : (
                    lessons.map((lesson, i) => (
                      <div key={i} className="ch-lesson">
                        <div className="ch-lesson-hdr">
                          <span className="ch-lesson-badge">
                            {lesson.setup}
                          </span>
                          <span className="ch-lesson-count">
                            {lesson.losses} loss
                            {lesson.losses !== 1 ? "es" : ""}
                          </span>
                        </div>
                        <div className="ch-lesson-text">
                          {lesson.verdict_summary}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {showModal && (
        <StartChallengeModal
          onStarted={() => {
            setShowModal(false);
            load();
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
