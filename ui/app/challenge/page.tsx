"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
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
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${v >= 0 ? "+" : "-"}$${abs}`;
}

function fmtDate(s: string) {
  return new Date(s + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Build a Mon–Sun calendar grid for a given month
function buildMonthGrid(year: number, month: number, calendarDays: CalendarDay[]) {
  const byDate = new Map(calendarDays.map((d) => [d.date, d.status]));
  const today = new Date().toISOString().split("T")[0];

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Start grid from Monday of week containing firstDay
  const startDow = firstDay.getDay(); // 0=Sun
  const offsetBack = startDow === 0 ? 6 : startDow - 1; // days to go back to Monday
  const gridStart = new Date(firstDay);
  gridStart.setDate(gridStart.getDate() - offsetBack);

  const rows: Array<Array<{ date: string; inMonth: boolean; isWeekend: boolean; status: string }>> = [];
  let current = new Date(gridStart);

  while (current <= lastDay || rows.length < 5) {
    const row: typeof rows[0] = [];
    for (let d = 0; d < 7; d++) {
      const iso = current.toISOString().split("T")[0];
      const inMonth = current.getMonth() === month && current.getFullYear() === year;
      const isWeekend = current.getDay() === 0 || current.getDay() === 6;
      const isFuture = iso > today;
      let status = "empty";
      if (!isWeekend) {
        if (isFuture) status = "future";
        else if (byDate.has(iso)) status = byDate.get(iso)!;
        else if (inMonth) status = "no_trade";
      }
      row.push({ date: iso, inMonth, isWeekend, status });
      current.setDate(current.getDate() + 1);
    }
    rows.push(row);
    if (current > lastDay && rows.length >= 4) break;
  }
  return rows;
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const CELL_COLORS: Record<string, string> = {
  win: "#14532d",
  loss: "#450a0a",
  no_trade: "#0f172a",
  future: "transparent",
  empty: "transparent",
};
const CELL_BORDER: Record<string, string> = {
  win: "#166534",
  loss: "#7f1d1d",
  no_trade: "#1e293b",
  future: "transparent",
  empty: "transparent",
};
const CELL_DOT: Record<string, string> = {
  win: "#4ade80",
  loss: "#f87171",
};

// ── Stat card ─────────────────────────────────────────────────
function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div
      style={{
        background: "#0d1320",
        border: "1px solid #1e3a5f",
        borderRadius: 8,
        padding: "14px 16px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 10, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: color ?? "#f1f5f9", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
        {value}
      </div>
    </div>
  );
}

// ── Grade bar ─────────────────────────────────────────────────
function GradeBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
      <span style={{ width: 24, fontSize: 11, fontWeight: 700, color, textAlign: "right", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 6, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ width: 20, fontSize: 11, color: "#64748b", textAlign: "right" }}>{count}</span>
    </div>
  );
}

// ── Past challenge row ────────────────────────────────────────
function PastChallengeRow({ ch }: { ch: PastChallenge }) {
  const s = ch.stats;
  return (
    <div
      style={{
        background: "#0d1320",
        border: "1px solid #1e3a5f",
        borderRadius: 8,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 20,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>{ch.name ?? "Challenge"}</div>
        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
          {fmtDate(ch.start_date)}
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: s.total_pnl >= 0 ? "#4ade80" : "#f87171" }}>
          {fmtPnl(s.total_pnl)}
        </div>
        <div style={{ fontSize: 11, color: "#64748b" }}>{s.win_rate}% WR · {s.total_trades} trades</div>
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
        setPast((allData.challenges ?? []).filter((c: PastChallenge) => c.status !== "active"));
      }
    } catch {}
    setLoading(false);
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  // ── Loading ──────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ height: "100dvh", display: "flex", flexDirection: "column", background: "#090e1a" }}>
        <Header deskOpen={false} refreshing={false} onRefresh={() => {}} onClearSession={() => {}} marketData={null} activePage="challenge" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#475569", fontSize: 13 }}>
          Loading...
        </div>
      </div>
    );
  }

  const isActive = data?.active === true;
  const ch = data?.challenge;
  const stats = data?.stats;
  const calendar = data?.calendar ?? [];
  const lessons = data?.lessons ?? [];
  const dayNumber = data?.day_number ?? 1;
  const dayPct = Math.min(100, ((dayNumber - 1) / 90) * 100);
  const gridRows = buildMonthGrid(calMonth.year, calMonth.month, calendar);
  const totalGrades = stats ? (stats.process_grades.A_plus + stats.process_grades.A + stats.process_grades.B + stats.process_grades.C) : 0;
  const aApluspct = stats && totalGrades > 0 ? Math.round(((stats.process_grades.A_plus + stats.process_grades.A) / totalGrades) * 100) : 0;

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#090e1a" }}>
      <Header deskOpen={false} refreshing={false} onRefresh={() => {}} onClearSession={() => {}} marketData={null} activePage="challenge" />

      <div style={{ flex: 1, overflowY: "auto", padding: "24px 28px 60px" }}>
        {/* ── No active challenge ──────────────────────────── */}
        {!isActive && (
          <div style={{ maxWidth: 680, margin: "0 auto" }}>
            <div style={{ textAlign: "center", padding: "48px 0 40px" }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 8 }}>
                No active challenge
              </div>
              <div style={{ fontSize: 13, color: "#64748b", marginBottom: 28 }}>
                Start a 90-day structured trading challenge to track your progress and build consistency.
              </div>
              <button
                onClick={() => setShowModal(true)}
                style={{
                  padding: "11px 28px",
                  borderRadius: 8,
                  background: "#1e40af",
                  color: "#fff",
                  border: "none",
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: "var(--font-inter), sans-serif",
                }}
              >
                Start 90-Day Challenge
              </button>
            </div>

            {past.length > 0 && (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                  Past Challenges
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {past.map((c) => <PastChallengeRow key={c.id} ch={c} />)}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Active challenge dashboard ───────────────────── */}
        {isActive && ch && stats && (
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            {/* Header row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#f1f5f9" }}>
                    {ch.name ?? "90-Day Challenge"}
                  </span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4, background: "#14532d", color: "#4ade80", border: "1px solid #166534" }}>
                    ACTIVE
                  </span>
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  Started {fmtDate(ch.start_date)}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#f1f5f9", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                  ${stats.current_balance.toLocaleString()}
                </div>
                <div style={{ fontSize: 11, color: "#64748b" }}>
                  ${ch.start_balance.toLocaleString()} → ${stats.current_balance.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Day progress bar */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: "#64748b" }}>Day {dayNumber} of {ch.target_days}</span>
                <span style={{ fontSize: 11, color: "#475569" }}>{ch.target_days - dayNumber} days remaining</span>
              </div>
              <div style={{ height: 5, background: "#1e293b", borderRadius: 3, overflow: "hidden" }}>
                <div style={{ width: `${dayPct}%`, height: "100%", background: "linear-gradient(90deg, #2563eb, #22d3ee)", borderRadius: 3, transition: "width 0.4s ease" }} />
              </div>
            </div>

            {/* Stat cards row */}
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              <StatCard
                label="Total P&L"
                value={fmtPnl(stats.total_pnl)}
                color={stats.total_pnl >= 0 ? "#4ade80" : "#f87171"}
              />
              <StatCard
                label="Win Rate"
                value={stats.total_trades > 0 ? `${stats.win_rate}%` : "—"}
                color={stats.win_rate >= 60 ? "#4ade80" : stats.win_rate >= 50 ? "#fbbf24" : "#f87171"}
              />
              <StatCard
                label="Avg Winner"
                value={stats.avg_winner !== 0 ? fmtPnl(stats.avg_winner) : "—"}
                color="#4ade80"
              />
              <StatCard
                label="Process A/A+"
                value={stats.total_trades > 0 ? `${aApluspct}%` : "—"}
                color={aApluspct >= 70 ? "#4ade80" : aApluspct >= 50 ? "#fbbf24" : "#f87171"}
              />
              <StatCard label="Best Setup" value={stats.best_setup ?? "—"} />
            </div>

            {/* Main content: Calendar + Right panel */}
            <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
              {/* Calendar */}
              <div style={{ flex: 1, minWidth: 0, background: "#0d1320", border: "1px solid #1e3a5f", borderRadius: 10, padding: "16px 18px" }}>
                {/* Month nav */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
                  <button
                    onClick={() => setCalMonth(({ year, month }) => month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 })}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}
                  >
                    ←
                  </button>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#f1f5f9" }}>
                    {new Date(calMonth.year, calMonth.month).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                  </span>
                  <button
                    onClick={() => setCalMonth(({ year, month }) => month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 })}
                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", fontSize: 14, padding: "2px 6px" }}
                  >
                    →
                  </button>
                </div>

                {/* DOW headers */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 6 }}>
                  {DOW_LABELS.map((d) => (
                    <div key={d} style={{ textAlign: "center", fontSize: 10, color: "#475569", fontWeight: 600, padding: "2px 0" }}>{d}</div>
                  ))}
                </div>

                {/* Calendar rows */}
                {gridRows.map((row, ri) => (
                  <div key={ri} style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 4 }}>
                    {row.map((cell, ci) => (
                      <div
                        key={ci}
                        title={cell.status !== "empty" && cell.status !== "future" ? `${cell.date}: ${cell.status.replace("_", " ")}` : undefined}
                        style={{
                          height: 32,
                          borderRadius: 5,
                          background: cell.inMonth || cell.status === "future" ? CELL_COLORS[cell.status] ?? "transparent" : "transparent",
                          border: `1px solid ${cell.inMonth ? (CELL_BORDER[cell.status] ?? "transparent") : "transparent"}`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          position: "relative",
                        }}
                      >
                        {cell.inMonth && !cell.isWeekend && cell.status !== "future" && cell.status !== "empty" && (
                          <span style={{ fontSize: 10, color: "#475569" }}>
                            {parseInt(cell.date.split("-")[2])}
                          </span>
                        )}
                        {cell.inMonth && !cell.isWeekend && (cell.status === "win" || cell.status === "loss") && (
                          <div style={{
                            position: "absolute",
                            bottom: 4,
                            width: 4,
                            height: 4,
                            borderRadius: "50%",
                            background: CELL_DOT[cell.status],
                          }} />
                        )}
                        {(!cell.inMonth || cell.isWeekend) && cell.status === "empty" && (
                          <span style={{ fontSize: 10, color: "#1e293b" }}>
                            {parseInt(cell.date.split("-")[2])}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ))}

                {/* Legend */}
                <div style={{ display: "flex", gap: 16, marginTop: 12, paddingTop: 10, borderTop: "1px solid #1e293b" }}>
                  {[["#4ade80", "Win"], ["#f87171", "Loss"], ["#334155", "No trade"]].map(([color, label]) => (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
                      <span style={{ fontSize: 10, color: "#64748b" }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right panel */}
              <div style={{ width: 280, flexShrink: 0, display: "flex", flexDirection: "column", gap: 14 }}>
                {/* Process grades */}
                <div style={{ background: "#0d1320", border: "1px solid #1e3a5f", borderRadius: 10, padding: "16px 18px" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 14 }}>
                    Process Grades
                  </div>
                  <GradeBar label="A+" count={stats.process_grades.A_plus} total={totalGrades} color="#60a5fa" />
                  <GradeBar label="A" count={stats.process_grades.A} total={totalGrades} color="#4ade80" />
                  <GradeBar label="B" count={stats.process_grades.B} total={totalGrades} color="#fbbf24" />
                  <GradeBar label="C" count={stats.process_grades.C} total={totalGrades} color="#f87171" />
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #1e293b", fontSize: 11, color: "#64748b" }}>
                    {aApluspct}% A-grade execution across {stats.total_trades} trade{stats.total_trades !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Where we lost */}
                {lessons.length > 0 && (
                  <div style={{ background: "#0d1320", border: "1px solid #1e3a5f", borderRadius: 10, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                      Where We Lost
                    </div>
                    {lessons.map((lesson, i) => (
                      <div
                        key={i}
                        style={{
                          marginBottom: i < lessons.length - 1 ? 12 : 0,
                          paddingBottom: i < lessons.length - 1 ? 12 : 0,
                          borderBottom: i < lessons.length - 1 ? "1px solid #1e293b" : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: "#f87171" }}>{lesson.setup}</span>
                          <span style={{ fontSize: 10, color: "#64748b" }}>{lesson.losses} loss{lesson.losses !== 1 ? "es" : ""}</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#94a3b8", lineHeight: 1.5 }}>
                          {lesson.verdict_summary}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {lessons.length === 0 && stats.total_trades === 0 && (
                  <div style={{ background: "#0d1320", border: "1px solid #1e3a5f", borderRadius: 10, padding: "16px 18px" }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                      Where We Lost
                    </div>
                    <div style={{ fontSize: 12, color: "#475569" }}>No trades yet — patterns will appear here.</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <StartChallengeModal
          onStarted={() => { setShowModal(false); load(); }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
