"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import Header from "../components/Header";
import StartChallengeModal from "../components/StartChallengeModal";
import ChallengeIconRail from "../components/ChallengeIconRail";
import ChallengeDayDrawer from "../components/ChallengeDayDrawer";
import ChallengeMountainHero from "../components/ChallengeMountainHero";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CAL_DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// ── Types ──────────────────────────────────────────────────────

interface CalendarDay {
  date: string;
  td_number: number;
  status: "win" | "loss" | "no_trade";
  day_pnl: number;
  trade_count: number;
  best_grade: string | null;
}

interface TradeCard {
  id: string | null;
  setup: string | null;
  direction: string | null;
  entry_premium: number | null;
  exit_premium: number | null;
  stop_loss_premium: number | null;
  r_multiple: number | null;
  contracts: number;
  pnl: number | null;
  grade: string | null;
  process_grade: string | null;
  process_review: string | null;
  grade_factors: {
    setup_quality: number;
    execution: number;
    risk_management: number;
    trade_management: number;
    mindset_discipline: number;
  } | null;
  notes: string | null;
}

interface DayDetailResponse {
  date: string;
  trades: TradeCard[];
  day_pnl: number;
  balance_after: number | null;
  win_rate: number | null;
  avg_r_multiple: number | null;
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
  avg_process_grade: number | null;
}

interface ChallengeData {
  id: string;
  start_date: string;
  start_balance: number;
  target_days: number;
  status: string;
  name?: string;
}

interface EquityPoint { date: string; pnl: number; balance: number; }
interface Streaks { current: number; best: number; }
interface GradeBreakdown { a_plus: number; a: number; b: number; c: number; total: number; }

interface StatsResponse {
  active: boolean;
  challenge?: ChallengeData;
  day_number?: number;
  stats?: ChallengeStats;
  calendar?: CalendarDay[];
  equity?: EquityPoint[];
  streaks?: Streaks;
  grade_breakdown?: GradeBreakdown;
}

interface PastChallenge extends ChallengeData {
  stats: ChallengeStats;
}

// ── Helpers ────────────────────────────────────────────────────

function gradeClass(g: string | null): string {
  if (!g) return "";
  if (g === "A+" || g === "A") return "a";
  if (g === "B") return "b";
  return "c";
}

function gradeColor(g: string | null): string {
  if (!g) return "var(--text-mid)";
  if (g === "A+" || g === "A") return "var(--ch-green)";
  if (g === "B") return "var(--ch-warning)";
  return "var(--ch-red)";
}

function fmtPnl(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${v >= 0 ? "+" : "−"}$${abs}`;
}

function fmtDate(d: string): string {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtEndDate(d: string): string {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Advance N weekdays from startDateStr, return ISO date
function addWeekdays(startDateStr: string, n: number): string {
  const d = new Date(startDateStr + "T12:00:00Z");
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

interface GridCell {
  blank: boolean;
  date: string;
  dayNum: number;
  calDay: CalendarDay | null;
  isToday: boolean;
}

function buildMonthGrid(
  year: number,
  month: number,
  calDayMap: Map<string, CalendarDay>,
  todayStr: string,
): GridCell[] {
  const cells: GridCell[] = [];
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDow; i++)
    cells.push({ blank: true, date: "", dayNum: 0, calDay: null, isToday: false });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({ blank: false, date, dayNum: d, calDay: calDayMap.get(date) ?? null, isToday: date === todayStr });
  }
  return cells;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// ── Sub-components ──────────────────────────────────────────────

function SparkLine({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="cf-stat-mini-spark" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200, h = 26, pad = 2;
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => [
    pad + i * step,
    pad + (h - pad * 2) * (1 - (v - min) / range),
  ]);
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <div className="cf-stat-mini-spark">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block" }}>
        <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

function DonutChart({ aplus, a, b, c }: { aplus: number; a: number; b: number; c: number }) {
  const total = aplus + a + b + c;
  const R = 68, CX = 100, CY = 100, STROKE = 19;
  const CIRC = 2 * Math.PI * R;
  const segments = [
    { count: aplus + a, color: "var(--ch-green)" },
    { count: b, color: "var(--ch-warning)" },
    { count: c, color: "var(--ch-red)" },
  ].filter(s => s.count > 0);
  let offset = 0;
  const arcs = segments.map((s, i) => {
    const len = (s.count / (total || 1)) * CIRC;
    const gap = segments.length > 1 ? 3 : 0;
    const el = (
      <circle
        key={i}
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke={s.color}
        strokeWidth={STROKE}
        strokeDasharray={`${Math.max(len - gap, 0)} ${CIRC - Math.max(len - gap, 0)}`}
        strokeDashoffset={-offset}
        strokeLinecap="round"
        style={{ transform: "rotate(-90deg)", transformOrigin: "center" }}
      />
    );
    offset += len;
    return el;
  });
  return (
    <div className="cf-donut-wrap">
      <svg viewBox="0 0 200 200">
        <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} />
        {total > 0 ? arcs : null}
      </svg>
      <div className="cf-donut-center">
        <span className="cf-donut-big">{total}</span>
        <span className="cf-donut-small">DAYS</span>
      </div>
    </div>
  );
}

// ── Empty-state icons (unchanged from previous version) ─────────

const TrophyIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8m-4-4v4M7 3H5a2 2 0 00-2 2v3c0 2.76 2.24 5 5 5h.1M17 3h2a2 2 0 012 2v3c0 2.76-2.24 5-5 5h-.1M7 3h10v5a5 5 0 01-10 0V3z" />
  </svg>
);
const CoinsIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="8" r="6" /><path d="M18.09 10.37A6 6 0 1110.34 18" /><path d="M7 6h1v4" /><path d="M16.71 13.88l.7.71-2.82 2.82" />
  </svg>
);
const CandleIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5v4m6-4v4M9 15v4m6-4v4M5 9h4v6H5zM15 9h4v6h-4z" />
  </svg>
);
const ShieldIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z" />
  </svg>
);
const StarIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

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
        <div className="ch-past-pnl" style={{ color: pnlColor }}>{fmtPnl(s.total_pnl)}</div>
        <div className="ch-past-meta">{s.win_rate}% WR · {s.total_trades} trades</div>
      </div>
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────

export default function ChallengePage() {
  const { getToken } = useAuth();
  const [data, setData] = useState<StatsResponse | null>(null);
  const [past, setPast] = useState<PastChallenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetailResponse | null>(null);
  const [dayDetailLoading, setDayDetailLoading] = useState(false);
  const [dayDetailError, setDayDetailError] = useState<string | null>(null);

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
          (allData.challenges ?? []).filter((c: PastChallenge) => c.status !== "active"),
        );
      }
    } catch {}
    setLoading(false);
  }, [getToken]);

  useEffect(() => { load(); }, [load]);

  // ── Derived ────────────────────────────────────────────────────

  const isActive = data?.active === true;
  const ch = data?.challenge;
  const stats = data?.stats;
  const calendar: CalendarDay[] = data?.calendar ?? [];
  const equity: EquityPoint[] = data?.equity ?? [];
  const streaks: Streaks = data?.streaks ?? { current: 0, best: 0 };
  const gradeBreakdown: GradeBreakdown = data?.grade_breakdown ?? { a_plus: 0, a: 0, b: 0, c: 0, total: 0 };
  const dayNumber = data?.day_number ?? 1;

  const todayStr = useMemo(() => {
    const d = new Date();
    // Format in ET — just use local date since server/client timezone is same timezone context
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }, []);

  const calDayMap = useMemo(() => {
    const m = new Map<string, CalendarDay>();
    for (const c of calendar) m.set(c.date, c);
    return m;
  }, [calendar]);

  const gridCells = useMemo(
    () => buildMonthGrid(calMonth.year, calMonth.month, calDayMap, todayStr),
    [calMonth, calDayMap, todayStr],
  );

  const todayCalDay = calDayMap.get(todayStr) ?? null;

  const displayCalDay = (selectedDate ? calDayMap.get(selectedDate) : null) ?? todayCalDay;
  const displayStr = selectedDate ?? todayStr;

  const endDate = useMemo(
    () => (ch?.start_date ? addWeekdays(ch.start_date, 90) : null),
    [ch?.start_date],
  );

  const daysRemaining = 90 - dayNumber;

  const equityValues = useMemo(() => equity.map((e) => e.balance), [equity]);

  // Footer stats — computed from calendar array (single source of truth)
  const footerStats = useMemo(() => {
    const traded = calendar.filter((c) => c.status !== "no_trade");
    const winDays = traded.filter((c) => c.status === "win").length;
    const lossDays = traded.filter((c) => c.status === "loss").length;
    const totalPnl = traded.reduce((s, c) => s + c.day_pnl, 0);
    const avgPnl = traded.length > 0 ? totalPnl / traded.length : 0;
    return { daysTraded: traded.length, winDays, lossDays, totalPnl, avgPnl };
  }, [calendar]);

  // ── Day detail fetch (extracted so it can be called from retry / note-save) ──

  async function fetchDayDetail(date: string) {
    setDayDetail(null);
    setDayDetailError(null);
    setDayDetailLoading(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${API}/challenge/day/${date}`, {
        headers,
        signal: controller.signal,
      });
      if (res.ok) {
        setDayDetail(await res.json());
      } else {
        setDayDetailError(`Server returned ${res.status}`);
      }
    } catch (err: unknown) {
      const isAbort = err instanceof DOMException && err.name === "AbortError";
      setDayDetailError(isAbort ? "Request timed out — try again" : "Could not reach server");
    } finally {
      clearTimeout(timer);
      setDayDetailLoading(false);
    }
  }

  // ── Day click handler ─────────────────────────────────────────

  function handleDayClick(date: string) {
    if (selectedDate === date) {
      setSelectedDate(null);
      setDayDetail(null);
      setDayDetailError(null);
      return;
    }
    setSelectedDate(date);
    fetchDayDetail(date);
  }

  function prevMonth() {
    setCalMonth(({ year, month }) =>
      month === 0 ? { year: year - 1, month: 11 } : { year, month: month - 1 },
    );
  }
  function nextMonth() {
    setCalMonth(({ year, month }) =>
      month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 },
    );
  }

  // ── Loading ───────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="ch-page">
        <Header deskOpen={false} refreshing={false} onRefresh={() => {}} onClearSession={() => {}} marketData={null} activePage="challenge" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-dim)", fontSize: 13 }}>
          Loading…
        </div>
      </div>
    );
  }

  // ── Empty state ───────────────────────────────────────────────

  if (!isActive) {
    return (
      <div className="ch-page">
        <Header deskOpen={false} refreshing={false} onRefresh={() => {}} onClearSession={() => {}} marketData={null} activePage="challenge" />
        <div className="ch-body">
          <div className="ch-empty">
            <div className="ch-trophy-wrap"><TrophyIcon /></div>
            <h1 className="ch-title">Saty 90-Day Challenge</h1>
            <p className="ch-subtitle">
              90 trading days. Prove consistency before sizing up. Process first — P&amp;L is the byproduct.
            </p>
            <blockquote className="ch-quote">
              Don&apos;t size up until you are consistent for at least 90 days. A year is even better. In 90 days you will see A LOT of different market conditions.
              <span className="ch-quote-attr">— Saty Mahajan</span>
            </blockquote>
            <button className="ch-start-btn" onClick={() => setShowModal(true)}>
              Start Challenge — Day 1 begins today
            </button>
          </div>
          <div className="ch-rules">
            <hr className="ch-rules-divider" />
            <div className="ch-rules-label">Phase 2 rules — active throughout</div>
            <div className="ch-rules-grid">
              <div className="ch-rule-card"><div className="ch-rule-icon"><CoinsIcon /></div><div className="ch-rule-title">Starting balance</div><div className="ch-rule-value">$500</div></div>
              <div className="ch-rule-card"><div className="ch-rule-icon"><CandleIcon /></div><div className="ch-rule-title">Premium range</div><div className="ch-rule-value">$3 – $4</div></div>
              <div className="ch-rule-card"><div className="ch-rule-icon"><ShieldIcon /></div><div className="ch-rule-title">Max loss / session</div><div className="ch-rule-value">–$150</div></div>
              <div className="ch-rule-card"><div className="ch-rule-icon"><StarIcon /></div><div className="ch-rule-title">Setups only</div><div className="ch-rule-value">A / A+</div></div>
            </div>
          </div>
          {past.length > 0 && (
            <div className="ch-past">
              <div className="ch-past-label">Past challenges</div>
              {past.map((c) => <PastRow key={c.id} ch={c} />)}
            </div>
          )}
          {showModal && (
            <StartChallengeModal
              onStarted={() => { setShowModal(false); load(); }}
              onClose={() => setShowModal(false)}
            />
          )}
        </div>
      </div>
    );
  }

  // ── Active — Calendar-First layout ───────────────────────────

  const startBalance = ch?.start_balance ?? 500;
  const currentBalance = stats?.current_balance ?? startBalance;
  const totalPnl = stats?.total_pnl ?? 0;
  const totalPnlPct = startBalance > 0 ? (totalPnl / startBalance * 100).toFixed(1) : "0.0";
  const challengeProgress = (dayNumber / 90 * 100).toFixed(1);

  // Today's session P&L and grade from the calendar (single source of truth)
  const todayPnl = todayCalDay?.day_pnl ?? 0;
  const todayTradeCount = todayCalDay?.trade_count ?? 0;
  const todayBestGrade = todayCalDay?.best_grade ?? null;

  const displayPnl = displayCalDay?.day_pnl ?? 0;
  const displayTradeCount = displayCalDay?.trade_count ?? 0;
  const displaySessionStopReached = displayPnl <= -150;

  // Avg process grade display (A+=5, A=4, B=3, C=2 scale, see _challenge_compute_stats)
  const avgPGNum = stats?.avg_process_grade ?? null;

  // Streak ring arc
  const RING_R = 16, RING_CIRC = 2 * Math.PI * RING_R;
  const streakArc = streaks.best > 0
    ? (streaks.current / streaks.best) * RING_CIRC
    : 0;

  return (
    <div className="cf-page">
      <Header
        deskOpen={false}
        refreshing={false}
        onRefresh={load}
        onClearSession={() => {}}
        marketData={null}
        activePage="challenge"
      />
      <div className="cf-body">
        <ChallengeIconRail />

        <main className="cf-main">
          <div className="cf-wrap">

            {/* Page title */}
            <div className="cf-page-title">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                <path d="M3 18l6-7 4 4 8-9" />
              </svg>
              90-Day Challenge
            </div>

            {/* ── Hero row ─────────────────────────────────── */}
            <div className="cf-hero-row">
              <div className="cf-hero-panel">
                <div className="cf-hero-content">
                  <p className="cf-hero-eyebrow">90-Day Challenge</p>
                  <h1 className="cf-hero-title">
                    Day <span className="accent">{dayNumber}</span>
                    <span className="cf-hero-of"> of 90</span>
                  </h1>
                  <p className="cf-hero-sub">
                    $500 account · A/A+ setups only · max 3 trades/day · −$150 session stop
                  </p>
                  <div className="cf-hero-pills">
                    <span className="cf-hero-pill progress">
                      {challengeProgress}% complete
                    </span>
                    <span className="cf-hero-pill discipline">
                      Process first. P&amp;L follows.
                    </span>
                  </div>
                </div>
                <div className="cf-hero-visual">
                  <ChallengeMountainHero dayNumber={dayNumber} />
                </div>
              </div>
              <div className="cf-ends-card">
                <p className="cf-ends-lbl">Challenge ends</p>
                <p className="cf-ends-date">{endDate ? fmtEndDate(endDate) : "—"}</p>
                <p className="cf-ends-rem">🏆 {daysRemaining} days remaining</p>
                <div className="cf-ends-progress">
                  <div className="cf-ends-bar" style={{ width: `${challengeProgress}%` }} />
                </div>
              </div>
            </div>

            {/* ── 5-card stat row ──────────────────────────── */}
            <div className="cf-stat-row">
              {/* Account Balance */}
              <div className="cf-stat-card">
                <p className="cf-stat-k">Account Balance</p>
                <p className={`cf-stat-v ${currentBalance >= startBalance ? "green" : "red"}`}>
                  ${currentBalance.toLocaleString()}
                </p>
                <p className={`cf-stat-sub ${totalPnl >= 0 ? "up" : ""}`}>
                  {totalPnl >= 0 ? "+" : "−"}${Math.abs(totalPnl).toLocaleString()} ({totalPnlPct}%)
                </p>
                <SparkLine values={equityValues} color="var(--ch-green)" />
              </div>

              {/* Day P&L — from today's calendar entry */}
              <div className="cf-stat-card">
                <p className="cf-stat-k">Day P&amp;L</p>
                <div className="cf-stat-v-row">
                  <p className={`cf-stat-v ${todayPnl >= 0 ? "green" : "red"}`}>
                    {fmtPnl(todayPnl)}
                  </p>
                  {todayBestGrade && (
                    <div
                      className="cf-stat-grade-chip"
                      style={{ background: gradeColor(todayBestGrade) }}
                    >
                      {todayBestGrade}
                    </div>
                  )}
                </div>
                <p className="cf-stat-sub">{todayTradeCount} trade{todayTradeCount !== 1 ? "s" : ""}</p>
              </div>

              {/* Avg Process Grade */}
              <div className="cf-stat-card">
                <p className="cf-stat-k">Avg Process Grade</p>
                <p className="cf-stat-v blue">
                  {avgPGNum !== null
                    ? avgPGNum >= 4.5 ? "A+" : avgPGNum >= 3.5 ? "A" : avgPGNum >= 2.5 ? "B" : "C"
                    : "—"}
                </p>
                <p className="cf-stat-sub">
                  {avgPGNum !== null ? `${avgPGNum.toFixed(2)} / 5` : "No reviews yet"}
                </p>
                <SparkLine values={equityValues} color="var(--ch-blue)" />
              </div>

              {/* Day Streak */}
              <div className="cf-stat-card">
                <div className="cf-stat-v-row">
                  <div>
                    <p className="cf-stat-k">Day Streak</p>
                    <p className="cf-stat-v" style={{ color: streaks.current > 0 ? "var(--ch-green)" : "var(--text-mid)" }}>
                      {streaks.current} day{streaks.current !== 1 ? "s" : ""}
                    </p>
                    <p className="cf-stat-sub">Best: {streaks.best} day{streaks.best !== 1 ? "s" : ""}</p>
                  </div>
                  <svg className="cf-stat-ring" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r={RING_R} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
                    {streakArc > 0 && (
                      <circle
                        cx="20" cy="20" r={RING_R}
                        fill="none"
                        stroke="var(--ch-green)"
                        strokeWidth="4"
                        strokeDasharray={`${streakArc.toFixed(2)} ${RING_CIRC}`}
                        strokeLinecap="round"
                        transform="rotate(-90 20 20)"
                      />
                    )}
                  </svg>
                </div>
              </div>

              {/* Total P&L */}
              <div className="cf-stat-card">
                <p className="cf-stat-k">Total P&amp;L</p>
                <p className={`cf-stat-v ${totalPnl >= 0 ? "green" : "red"}`}>
                  {fmtPnl(totalPnl)}
                </p>
                <p className={`cf-stat-sub ${totalPnl >= 0 ? "up" : ""}`}>{totalPnlPct}%</p>
                <SparkLine values={equityValues} color="var(--ch-green)" />
              </div>
            </div>

            {/* ── Calendar + right rail ────────────────────── */}
            <div className="cf-cal-wrap">
              <div className="cf-cal-main">
                <div className="cf-cal-head">
                  <h2>{MONTH_NAMES[calMonth.month]} {calMonth.year}</h2>
                  <div className="cf-cal-legend">
                    <span>
                      <span className="cf-cal-legend-dot" style={{ background: "var(--ch-green)" }} />
                      Profitable
                    </span>
                    <span>
                      <span className="cf-cal-legend-dot" style={{ background: "var(--ch-red)" }} />
                      Losing
                    </span>
                    <button className="cf-cal-nav-btn" onClick={prevMonth}>‹</button>
                    <button className="cf-cal-nav-btn" onClick={nextMonth}>›</button>
                  </div>
                </div>

                {/* Day-of-week header + day cells — scrollable on mobile */}
                <div className="cf-cal-grid-scroll">
                <div className="cf-cal-grid">
                  {CAL_DOW.map((dow) => (
                    <div key={dow} className="cf-cal-dow">{dow}</div>
                  ))}

                  {/* Day cells */}
                  {gridCells.map((cell, idx) => {
                    if (cell.blank) {
                      return <div key={idx} className="cf-cal-day blank" />;
                    }

                    const cd = cell.calDay;
                    const isSelected = cell.date === selectedDate;
                    const cdStatus = cd?.status === "no_trade" ? "no-trade" : (cd?.status ?? null);
                    const dayClass = cd
                      ? `cf-cal-day ${cdStatus}${isSelected ? " selected" : ""}`
                      : "cf-cal-day out-of-window";
                    const isClickable = !!cd;

                    return (
                      <div
                        key={idx}
                        className={dayClass}
                        onClick={isClickable ? () => handleDayClick(cell.date) : undefined}
                        style={!isClickable ? { cursor: "default" } : undefined}
                      >
                        {cell.isToday && <span className="cf-today-tag">Today</span>}
                        <div className="cf-cal-top-row">
                          <span className="cf-cal-daynum">{cell.dayNum}</span>
                          {cd && cd.trade_count > 0 && cd.best_grade && (
                            <span className={`cf-cal-grade-badge ${gradeClass(cd.best_grade)}`}>
                              {cd.best_grade}
                            </span>
                          )}
                        </div>
                        {cd && cd.trade_count > 0 ? (
                          <>
                            <span className="cf-cal-pnl">{fmtPnl(cd.day_pnl)}</span>
                            <span className="cf-cal-trade-ct">
                              {cd.trade_count} trade{cd.trade_count !== 1 ? "s" : ""}
                            </span>
                          </>
                        ) : cd ? (
                          <span className="cf-cal-no-trade-mark">—</span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                </div>{/* cf-cal-grid-scroll */}

              </div>

              {/* ── Right rail ─────────────────────────────── */}
              <div className="cf-right-rail">
                {/* Today's Focus */}
                <div className="cf-focus-card">
                  <div className="cf-focus-icon">🎯</div>
                  <div>
                    <p className="cf-focus-k">Today&apos;s Focus</p>
                    <p className="cf-focus-v">A/A+ setups with process</p>
                    <p className="cf-focus-sub">Discipline &gt; Direction</p>
                  </div>
                </div>

                {/* Today card — updates to show selected day when drawer is open */}
                <div className="cf-today-card">
                  <div className="cf-today-card-head">
                    {selectedDate ? "Selected" : "Today"} ·{" "}
                    {new Date(displayStr + "T12:00:00Z").toLocaleDateString("en-US", {
                      weekday: "short", month: "short", day: "numeric",
                    })}
                  </div>
                  <div className="cf-today-row">
                    <span className="cf-today-l">Trades</span>
                    <span className="cf-today-r">{displayTradeCount} / 3</span>
                  </div>
                  <div className="cf-today-row">
                    <span className="cf-today-l">Session P&amp;L</span>
                    <span className={`cf-today-r ${displayPnl >= 0 ? "green" : "red"}`}>
                      {fmtPnl(displayPnl)}
                    </span>
                  </div>
                  <div className="cf-today-row">
                    <span className="cf-today-l">Session Stop</span>
                    <span className={`cf-today-r ${displaySessionStopReached ? "red" : "amber"}`}>
                      −$150
                      <span className="cf-today-note">
                        {displaySessionStopReached ? "REACHED" : "Not reached"}
                      </span>
                    </span>
                  </div>
                  <div className="cf-today-row">
                    <span className="cf-today-l">Streak</span>
                    <span className={`cf-today-r ${streaks.current > 0 ? "green" : ""}`}>
                      {streaks.current} day{streaks.current !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Grade breakdown donut */}
                <div className="cf-grade-card">
                  <div className="cf-grade-head">Grade Breakdown (90 Days)</div>
                  <div className="cf-grade-with-donut">
                    <DonutChart
                      aplus={gradeBreakdown.a_plus}
                      a={gradeBreakdown.a}
                      b={gradeBreakdown.b}
                      c={gradeBreakdown.c}
                    />
                    <div className="cf-donut-legend">
                      {gradeBreakdown.total > 0 ? (
                        <>
                          <div className="cf-donut-legend-row">
                            <span className="cf-donut-sq" style={{ background: "var(--ch-green)" }} />
                            A/A+
                            <span className="cf-donut-count">
                              {gradeBreakdown.a_plus + gradeBreakdown.a} ({Math.round((gradeBreakdown.a_plus + gradeBreakdown.a) / gradeBreakdown.total * 100)}%)
                            </span>
                          </div>
                          <div className="cf-donut-legend-row">
                            <span className="cf-donut-sq" style={{ background: "var(--ch-warning)" }} />
                            B
                            <span className="cf-donut-count">
                              {gradeBreakdown.b} ({Math.round(gradeBreakdown.b / gradeBreakdown.total * 100)}%)
                            </span>
                          </div>
                          <div className="cf-donut-legend-row">
                            <span className="cf-donut-sq" style={{ background: "var(--ch-red)" }} />
                            C
                            <span className="cf-donut-count">
                              {gradeBreakdown.c} ({Math.round(gradeBreakdown.c / gradeBreakdown.total * 100)}%)
                            </span>
                          </div>
                        </>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-dim)" }}>No traded days yet</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Challenge progress */}
                <div className="cf-progress-card">
                  <p className="cf-progress-k">Challenge Progress</p>
                  <p className="cf-progress-v">{challengeProgress}%</p>
                  <p className="cf-progress-sub">{dayNumber} / 90 days completed</p>
                  <div className="cf-progress-track">
                    <div className="cf-progress-fill" style={{ width: `${challengeProgress}%` }} />
                  </div>
                  <p className="cf-progress-tip">📈 Keep stacking green days.</p>
                </div>
              </div>
            </div>

            {/* ── Footer summary strip ──────────────────────── */}
            <div className="cf-footer">
              <div className="cf-footer-cell">
                <p className="cf-footer-k">Total P&amp;L (Days Traded)</p>
                <p className={`cf-footer-v ${totalPnl >= 0 ? "green" : "red"}`}>
                  {fmtPnl(totalPnl)}
                </p>
              </div>
              <div className="cf-footer-cell">
                <p className="cf-footer-k">Total Days Traded</p>
                <p className="cf-footer-v">{footerStats.daysTraded} / 90</p>
                <p className="cf-footer-sub">{challengeProgress}%</p>
              </div>
              <div className="cf-footer-cell">
                <p className="cf-footer-k">Winning Days</p>
                <p className="cf-footer-v green">
                  {footerStats.winDays} ({footerStats.daysTraded > 0 ? Math.round(footerStats.winDays / footerStats.daysTraded * 100) : 0}%)
                </p>
              </div>
              <div className="cf-footer-cell">
                <p className="cf-footer-k">Losing Days</p>
                <p className="cf-footer-v red">
                  {footerStats.lossDays} ({footerStats.daysTraded > 0 ? Math.round(footerStats.lossDays / footerStats.daysTraded * 100) : 0}%)
                </p>
              </div>
              <div className="cf-footer-cell">
                <p className="cf-footer-k">Avg P&amp;L / Day Traded</p>
                <p className={`cf-footer-v ${footerStats.avgPnl >= 0 ? "green" : "red"}`}>
                  {footerStats.avgPnl >= 0 ? "+" : "−"}${Math.abs(footerStats.avgPnl).toFixed(2)}
                </p>
              </div>
            </div>

          </div>
        </main>
      </div>

      <ChallengeDayDrawer
        open={selectedDate !== null}
        date={selectedDate}
        calDay={selectedDate ? (calDayMap.get(selectedDate) ?? null) : null}
        detail={dayDetail}
        loading={dayDetailLoading}
        error={dayDetailError}
        allCalDays={calendar}
        onClose={() => {
          setSelectedDate(null);
          setDayDetail(null);
          setDayDetailError(null);
        }}
        onNavigate={handleDayClick}
        onRefetch={selectedDate ? () => fetchDayDetail(selectedDate) : undefined}
      />
    </div>
  );
}
