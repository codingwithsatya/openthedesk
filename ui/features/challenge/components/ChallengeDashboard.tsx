"use client";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import Header from "@/app/components/Header";
import ChallengeIconRail from "@/features/challenge/components/ChallengeIconRail";
import ChallengeDayDrawer from "@/features/challenge/components/ChallengeDayDrawer";
// import ChallengeMountainHero from "@/features/challenge/components/ChallengeMountainHero";
import {
  gradeClass,
  gradeColor,
  fmtPnl,
  fmtEndDate,
  addWeekdays,
  buildMonthGrid,
  MONTH_NAMES,
} from "@/features/challenge/lib/helpers";
import type {
  StatsResponse,
  PastChallenge,
  CalendarDay,
  DayDetailResponse,
  GradeBreakdown,
  Streaks,
} from "../lib/types";
import s from "@/features/challenge/styles/challengeDashboard.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CAL_DOW = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

interface Props {
  data: StatsResponse;
  past: PastChallenge[];
  onRefresh: () => void;
}

// ── SparkLine ─────────────────────────────────────────────────

function SparkLine({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className={s.statMiniSpark} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 200,
    h = 26,
    pad = 2;
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => [
    pad + i * step,
    pad + (h - pad * 2) * (1 - (v - min) / range),
  ]);
  const path = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    )
    .join(" ");
  return (
    <div className={s.statMiniSpark}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: "100%", display: "block" }}
      >
        <path
          d={path}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

// ── DonutChart ────────────────────────────────────────────────

function DonutChart({
  aplus,
  a,
  b,
  c,
}: {
  aplus: number;
  a: number;
  b: number;
  c: number;
}) {
  const total = aplus + a + b + c;
  const R = 68,
    CX = 100,
    CY = 100,
    STROKE = 19;
  const CIRC = 2 * Math.PI * R;
  const segments = [
    { count: aplus + a, color: "var(--ch-green)" },
    { count: b, color: "var(--ch-warning)" },
    { count: c, color: "var(--ch-red)" },
  ].filter((seg) => seg.count > 0);
  let offset = 0;
  const arcs = segments.map((seg, i) => {
    const len = (seg.count / (total || 1)) * CIRC;
    const gap = segments.length > 1 ? 3 : 0;
    const el = (
      <circle
        key={i}
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke={seg.color}
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
    <div className={s.donutWrap}>
      <svg viewBox="0 0 200 200">
        <circle
          cx={CX}
          cy={CY}
          r={R}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={STROKE}
        />
        {total > 0 ? arcs : null}
      </svg>
      <div className={s.donutCenter}>
        <span className={s.donutBig}>{total}</span>
        <span className={s.donutSmall}>DAYS</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────

export default function ChallengeDashboard({
  data,
  past: _past,
  onRefresh,
}: Props) {
  const { getToken } = useAuth();

  // Calendar navigation state
  const [calMonth, setCalMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetailResponse | null>(null);
  const [dayDetailLoading, setDayDetailLoading] = useState(false);
  const [dayDetailError, setDayDetailError] = useState<string | null>(null);

  // ── Derived values ────────────────────────────────────────────

  const ch = data.challenge;
  const stats = data.stats;
  const calendar: CalendarDay[] = data.calendar ?? [];
  const equity = data.equity ?? [];
  const streaks: Streaks = data.streaks ?? { current: 0, best: 0 };
  const gradeBreakdown: GradeBreakdown = data.grade_breakdown ?? {
    a_plus: 0,
    a: 0,
    b: 0,
    c: 0,
    total: 0,
  };
  const dayNumber = data.day_number ?? 1;

  const todayStr = useMemo(() => {
    const d = new Date();
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

  const displayCalDay =
    (selectedDate ? calDayMap.get(selectedDate) : null) ?? todayCalDay;
  const displayStr = selectedDate ?? todayStr;

  const endDate = useMemo(
    () => (ch?.start_date ? addWeekdays(ch.start_date, 90) : null),
    [ch?.start_date],
  );

  const daysRemaining = 90 - dayNumber;

  const equityValues = useMemo(() => equity.map((e) => e.balance), [equity]);

  const footerStats = useMemo(() => {
    const traded = calendar.filter((c) => c.status !== "no_trade");
    const winDays = traded.filter((c) => c.status === "win").length;
    const lossDays = traded.filter((c) => c.status === "loss").length;
    const totalPnl = traded.reduce((sum, c) => sum + c.day_pnl, 0);
    const avgPnl = traded.length > 0 ? totalPnl / traded.length : 0;
    return { daysTraded: traded.length, winDays, lossDays, totalPnl, avgPnl };
  }, [calendar]);

  const startBalance = ch?.start_balance ?? 500;
  const currentBalance = stats?.current_balance ?? startBalance;
  const totalPnl = stats?.total_pnl ?? 0;
  const totalPnlPct =
    startBalance > 0 ? ((totalPnl / startBalance) * 100).toFixed(1) : "0.0";
  const challengeProgress = ((dayNumber / 90) * 100).toFixed(1);

  const todayPnl = todayCalDay?.day_pnl ?? 0;
  const todayTradeCount = todayCalDay?.trade_count ?? 0;
  const todayBestGrade = todayCalDay?.best_grade ?? null;

  const displayPnl = displayCalDay?.day_pnl ?? 0;
  const displayTradeCount = displayCalDay?.trade_count ?? 0;
  const displaySessionStopReached = displayPnl <= -150;

  const avgPGNum = stats?.avg_process_grade ?? null;

  const RING_R = 16,
    RING_CIRC = 2 * Math.PI * RING_R;
  const streakArc =
    streaks.best > 0 ? (streaks.current / streaks.best) * RING_CIRC : 0;

  // ── Day detail fetch ──────────────────────────────────────────

  const fetchDayDetail = useCallback(
    async (date: string) => {
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
        const isAbort =
          err instanceof DOMException && err.name === "AbortError";
        setDayDetailError(
          isAbort ? "Request timed out — try again" : "Could not reach server",
        );
      } finally {
        clearTimeout(timer);
        setDayDetailLoading(false);
      }
    },
    [getToken],
  );

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

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className={s.page}>
      <Header
        deskOpen={false}
        refreshing={false}
        onRefresh={onRefresh}
        onClearSession={() => {}}
        marketData={null}
        activePage="challenge"
      />
      <div className={s.body}>
        <ChallengeIconRail />

        <main className={s.main}>
          <div className={s.wrap}>
            {/* Page title */}
            <div className={s.pageTitle}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                width="14"
                height="14"
              >
                <path d="M3 18l6-7 4 4 8-9" />
              </svg>
              90-Day Challenge
            </div>

            {/* ── Hero row ─────────────────────────────────── */}
            <div className={s.heroRow}>
              <div className={s.heroPanel}>
                <div className={s.heroContent}>
                  <p className={s.heroEyebrow}>90-Day Challenge</p>
                  <h1 className={s.heroTitle}>
                    Day <span className="accent">{dayNumber}</span>
                    <span className={s.heroOf}> of 90</span>
                  </h1>
                  <p className={s.heroSub}>
                    $500 account · A/A+ setups only · max 3 trades/day · −$150
                    session stop
                  </p>
                  <div className={s.heroPills}>
                    <span className={`${s.heroPill} ${s.progress}`}>
                      {challengeProgress}% complete
                    </span>
                    <span className={`${s.heroPill} ${s.discipline}`}>
                      Process first. P&amp;L follows.
                    </span>
                  </div>
                </div>
                <div className={s.heroVisual}>
                  {/* <ChallengeMountainHero dayNumber={dayNumber} /> */}
                </div>
              </div>
              <div className={s.endsCard}>
                <p className={s.endsLbl}>Challenge ends</p>
                <p className={s.endsDate}>
                  {endDate ? fmtEndDate(endDate) : "—"}
                </p>
                <p className={s.endsRem}>🏆 {daysRemaining} days remaining</p>
                <div className={s.endsProgress}>
                  <div
                    className={s.endsBar}
                    style={{ width: `${challengeProgress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* ── 5-card stat row ──────────────────────────── */}
            <div className={s.statRow}>
              {/* Account Balance */}
              <div className={s.statCard}>
                <p className={s.statK}>Account Balance</p>
                <p
                  className={`${s.statV} ${currentBalance >= startBalance ? s.green : s.red}`}
                >
                  ${currentBalance.toLocaleString()}
                </p>
                <p className={`${s.statSub} ${totalPnl >= 0 ? s.up : ""}`}>
                  {totalPnl >= 0 ? "+" : "−"}$
                  {Math.abs(totalPnl).toLocaleString()} ({totalPnlPct}%)
                </p>
                <SparkLine values={equityValues} color="var(--ch-green)" />
              </div>

              {/* Day P&L */}
              <div className={s.statCard}>
                <p className={s.statK}>Day P&amp;L</p>
                <div className={s.statVRow}>
                  <p
                    className={`${s.statV} ${todayPnl >= 0 ? s.green : s.red}`}
                  >
                    {fmtPnl(todayPnl)}
                  </p>
                  {todayBestGrade && (
                    <div
                      className={s.statGradeChip}
                      style={{ background: gradeColor(todayBestGrade) }}
                    >
                      {todayBestGrade}
                    </div>
                  )}
                </div>
                <p className={s.statSub}>
                  {todayTradeCount} trade{todayTradeCount !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Avg Process Grade */}
              <div className={s.statCard}>
                <p className={s.statK}>Avg Process Grade</p>
                <p className={`${s.statV} ${s.blue}`}>
                  {avgPGNum !== null
                    ? avgPGNum >= 4.5
                      ? "A+"
                      : avgPGNum >= 3.5
                        ? "A"
                        : avgPGNum >= 2.5
                          ? "B"
                          : "C"
                    : "—"}
                </p>
                <p className={s.statSub}>
                  {avgPGNum !== null
                    ? `${avgPGNum.toFixed(2)} / 5`
                    : "No reviews yet"}
                </p>
                <SparkLine values={equityValues} color="var(--ch-blue)" />
              </div>

              {/* Day Streak */}
              <div className={s.statCard}>
                <div className={s.statVRow}>
                  <div>
                    <p className={s.statK}>Day Streak</p>
                    <p
                      className={s.statV}
                      style={{
                        color:
                          streaks.current > 0
                            ? "var(--ch-green)"
                            : "var(--text-mid)",
                      }}
                    >
                      {streaks.current} day{streaks.current !== 1 ? "s" : ""}
                    </p>
                    <p className={s.statSub}>
                      Best: {streaks.best} day{streaks.best !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <svg className={s.statRing} viewBox="0 0 40 40">
                    <circle
                      cx="20"
                      cy="20"
                      r={RING_R}
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="4"
                    />
                    {streakArc > 0 && (
                      <circle
                        cx="20"
                        cy="20"
                        r={RING_R}
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
              <div className={s.statCard}>
                <p className={s.statK}>Total P&amp;L</p>
                <p className={`${s.statV} ${totalPnl >= 0 ? s.green : s.red}`}>
                  {fmtPnl(totalPnl)}
                </p>
                <p className={`${s.statSub} ${totalPnl >= 0 ? s.up : ""}`}>
                  {totalPnlPct}%
                </p>
                <SparkLine values={equityValues} color="var(--ch-green)" />
              </div>
            </div>

            {/* ── Calendar + right rail ────────────────────── */}
            <div className={s.calWrap}>
              <div className={s.calMain}>
                <div className={s.calHead}>
                  <h2>
                    {MONTH_NAMES[calMonth.month]} {calMonth.year}
                  </h2>
                  <div className={s.calLegend}>
                    <span>
                      <span
                        className={s.calLegendDot}
                        style={{ background: "var(--ch-green)" }}
                      />
                      Profitable
                    </span>
                    <span>
                      <span
                        className={s.calLegendDot}
                        style={{ background: "var(--ch-red)" }}
                      />
                      Losing
                    </span>
                    <button className={s.calNavBtn} onClick={prevMonth}>
                      ‹
                    </button>
                    <button className={s.calNavBtn} onClick={nextMonth}>
                      ›
                    </button>
                  </div>
                </div>

                <div className={s.calGridScroll}>
                  <div className={s.calGrid}>
                    {CAL_DOW.map((dow) => (
                      <div key={dow} className={s.calDow}>
                        {dow}
                      </div>
                    ))}

                    {gridCells.map((cell, idx) => {
                      if (cell.blank) {
                        return (
                          <div key={idx} className={`${s.calDay} ${s.blank}`} />
                        );
                      }

                      const cd = cell.calDay;
                      const isSelected = cell.date === selectedDate;

                      let dayClass = s.calDay;
                      if (cd) {
                        if (cd.status === "win") dayClass += ` ${s.win}`;
                        else if (cd.status === "loss") dayClass += ` ${s.loss}`;
                        else dayClass += ` ${s.noTrade}`;
                      } else {
                        dayClass += ` ${s.outOfWindow}`;
                      }
                      if (isSelected) dayClass += ` ${s.selected}`;

                      const isClickable = !!cd;

                      return (
                        <div
                          key={idx}
                          className={dayClass}
                          onClick={
                            isClickable
                              ? () => handleDayClick(cell.date)
                              : undefined
                          }
                          style={
                            !isClickable ? { cursor: "default" } : undefined
                          }
                        >
                          {cell.isToday && (
                            <span className={s.todayTag}>Today</span>
                          )}
                          <div className={s.calTopRow}>
                            <span className={s.calDaynum}>{cell.dayNum}</span>
                            {cd && cd.trade_count > 0 && cd.best_grade && (
                              <span
                                className={`${s.calGradeBadge} ${s[gradeClass(cd.best_grade)]}`}
                              >
                                {cd.best_grade}
                              </span>
                            )}
                          </div>
                          {cd && cd.trade_count > 0 ? (
                            <>
                              <span className={s.calPnl}>
                                {fmtPnl(cd.day_pnl)}
                              </span>
                              <span className={s.calTradeCt}>
                                {cd.trade_count} trade
                                {cd.trade_count !== 1 ? "s" : ""}
                              </span>
                            </>
                          ) : cd ? (
                            <span className={s.calNoTradeMark}>—</span>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* ── Right rail ─────────────────────────────── */}
              <div className={s.rightRail}>
                {/* Today's Focus */}
                <div className={s.focusCard}>
                  <div className={s.focusIcon}>🎯</div>
                  <div>
                    <p className={s.focusK}>Today&apos;s Focus</p>
                    <p className={s.focusV}>A/A+ setups with process</p>
                    <p className={s.focusSub}>Discipline &gt; Direction</p>
                  </div>
                </div>

                {/* Today card */}
                <div className={s.todayCard}>
                  <div className={s.todayCardHead}>
                    {selectedDate ? "Selected" : "Today"} ·{" "}
                    {new Date(displayStr + "T12:00:00Z").toLocaleDateString(
                      "en-US",
                      {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      },
                    )}
                  </div>
                  <div className={s.todayRow}>
                    <span className={s.todayL}>Trades</span>
                    <span className={s.todayR}>{displayTradeCount} / 3</span>
                  </div>
                  <div className={s.todayRow}>
                    <span className={s.todayL}>Session P&amp;L</span>
                    <span
                      className={`${s.todayR} ${displayPnl >= 0 ? s.green : s.red}`}
                    >
                      {fmtPnl(displayPnl)}
                    </span>
                  </div>
                  <div className={s.todayRow}>
                    <span className={s.todayL}>Session Stop</span>
                    <span
                      className={`${s.todayR} ${displaySessionStopReached ? s.red : s.amber}`}
                    >
                      −$150
                      <span className={s.todayNote}>
                        {displaySessionStopReached ? "REACHED" : "Not reached"}
                      </span>
                    </span>
                  </div>
                  <div className={s.todayRow}>
                    <span className={s.todayL}>Streak</span>
                    <span
                      className={`${s.todayR} ${streaks.current > 0 ? s.green : ""}`}
                    >
                      {streaks.current} day{streaks.current !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>

                {/* Grade breakdown donut */}
                <div className={s.gradeCard}>
                  <div className={s.gradeHead}>Grade Breakdown (90 Days)</div>
                  <div className={s.gradeWithDonut}>
                    <DonutChart
                      aplus={gradeBreakdown.a_plus}
                      a={gradeBreakdown.a}
                      b={gradeBreakdown.b}
                      c={gradeBreakdown.c}
                    />
                    <div className={s.donutLegend}>
                      {gradeBreakdown.total > 0 ? (
                        <>
                          <div className={s.donutLegendRow}>
                            <span
                              className={s.donutSq}
                              style={{ background: "var(--ch-green)" }}
                            />
                            A/A+
                            <span className={s.donutCount}>
                              {gradeBreakdown.a_plus + gradeBreakdown.a} (
                              {Math.round(
                                ((gradeBreakdown.a_plus + gradeBreakdown.a) /
                                  gradeBreakdown.total) *
                                  100,
                              )}
                              %)
                            </span>
                          </div>
                          <div className={s.donutLegendRow}>
                            <span
                              className={s.donutSq}
                              style={{ background: "var(--ch-warning)" }}
                            />
                            B
                            <span className={s.donutCount}>
                              {gradeBreakdown.b} (
                              {Math.round(
                                (gradeBreakdown.b / gradeBreakdown.total) * 100,
                              )}
                              %)
                            </span>
                          </div>
                          <div className={s.donutLegendRow}>
                            <span
                              className={s.donutSq}
                              style={{ background: "var(--ch-red)" }}
                            />
                            C
                            <span className={s.donutCount}>
                              {gradeBreakdown.c} (
                              {Math.round(
                                (gradeBreakdown.c / gradeBreakdown.total) * 100,
                              )}
                              %)
                            </span>
                          </div>
                        </>
                      ) : (
                        <span
                          style={{ fontSize: 11, color: "var(--text-dim)" }}
                        >
                          No traded days yet
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Challenge progress */}
                <div className={s.progressCard}>
                  <p className={s.progressK}>Challenge Progress</p>
                  <p className={s.progressV}>{challengeProgress}%</p>
                  <p className={s.progressSub}>
                    {dayNumber} / 90 days completed
                  </p>
                  <div className={s.progressTrack}>
                    <div
                      className={s.progressFill}
                      style={{ width: `${challengeProgress}%` }}
                    />
                  </div>
                  <p className={s.progressTip}>📈 Keep stacking green days.</p>
                </div>
              </div>
            </div>

            {/* ── Footer summary strip ──────────────────────── */}
            <div className={s.footer}>
              <div className={s.footerCell}>
                <p className={s.footerK}>Total P&amp;L (Days Traded)</p>
                <p
                  className={`${s.footerV} ${totalPnl >= 0 ? s.green : s.red}`}
                >
                  {fmtPnl(totalPnl)}
                </p>
              </div>
              <div className={s.footerCell}>
                <p className={s.footerK}>Total Days Traded</p>
                <p className={s.footerV}>{footerStats.daysTraded} / 90</p>
                <p className={s.footerSub}>{challengeProgress}%</p>
              </div>
              <div className={s.footerCell}>
                <p className={s.footerK}>Winning Days</p>
                <p className={`${s.footerV} ${s.green}`}>
                  {footerStats.winDays} (
                  {footerStats.daysTraded > 0
                    ? Math.round(
                        (footerStats.winDays / footerStats.daysTraded) * 100,
                      )
                    : 0}
                  %)
                </p>
              </div>
              <div className={s.footerCell}>
                <p className={s.footerK}>Losing Days</p>
                <p className={`${s.footerV} ${s.red}`}>
                  {footerStats.lossDays} (
                  {footerStats.daysTraded > 0
                    ? Math.round(
                        (footerStats.lossDays / footerStats.daysTraded) * 100,
                      )
                    : 0}
                  %)
                </p>
              </div>
              <div className={s.footerCell}>
                <p className={s.footerK}>Avg P&amp;L / Day Traded</p>
                <p
                  className={`${s.footerV} ${footerStats.avgPnl >= 0 ? s.green : s.red}`}
                >
                  {footerStats.avgPnl >= 0 ? "+" : "−"}$
                  {Math.abs(footerStats.avgPnl).toFixed(2)}
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
        onRefetch={
          selectedDate ? () => fetchDayDetail(selectedDate) : undefined
        }
      />
    </div>
  );
}
