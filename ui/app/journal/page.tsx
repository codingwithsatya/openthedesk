"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
} from "chart.js";
import Header from "../components/Header";
import AppIconRail from "@/app/components/AppIconRail";
import styles from "@/features/journal/styles/journalPage.module.css";
import JournalSidebar from "@/features/journal/components/JournalSidebar";
import JournalStatsCards from "@/features/journal/components/JournalStatsCards";
import JournalCharts from "@/features/journal/components/JournalCharts";
import JournalFilterBar from "@/features/journal/components/JournalFilterBar";
import JournalTradeTable from "@/features/journal/components/JournalTradeTable";
import type { JournalEntry, JournalStats } from "@/features/journal/lib/types";
import {
  fmtPnl as fmtPnlHelper,
  fmtExpectancy,
} from "@/features/journal/lib/helpers";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Filler,
  Tooltip,
);

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types imported from @/features/journal/lib/types ──────────

// ── Helpers ───────────────────────────────────────────────────
function fmtPnl(v: number) {
  return fmtPnlHelper(v);
}

const LIMIT = 50;

function pnlColor(v: number) {
  return v > 0 ? "#4ade80" : v < 0 ? "#f87171" : "#94a3b8";
}

function setupBadge(setup: string, direction: string) {
  const isBull = direction.toUpperCase() === "BULL";
  return {
    bg: isBull ? "#0f2d1a" : "#3d0f0f",
    color: isBull ? "#4ade80" : "#f87171",
    border: isBull ? "1px solid #14532d" : "1px solid #7f1d1d",
  };
}

function gradeBadge(grade: string) {
  if (grade === "A+")
    return { bg: "#1e3a5f", color: "#60a5fa", border: "1px solid #2d5a8e" };
  if (grade === "B")
    return { bg: "#1e1a0f", color: "#fbbf24", border: "1px solid #78350f" };
  return { bg: "transparent", color: "#64748b", border: "1px solid #334155" };
}

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
  scales: {
    x: {
      ticks: { color: "#475569", font: { size: 10 } },
      grid: { color: "rgba(30,58,95,0.4)" },
    },
    y: {
      ticks: { color: "#475569", font: { size: 10 } },
      grid: { color: "rgba(30,58,95,0.4)" },
    },
  },
} as const;

type FilterKey = "all" | "bull" | "bear" | "winners" | "losers" | "aplus";

// ── Page ──────────────────────────────────────────────────────
export default function JournalPage() {
  const { getToken } = useAuth();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [stats, setStats] = useState<JournalStats | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sideFilter, setSideFilter] = useState<string>("all");
  const [chatInput, setChatInput] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    exit_price: string;
    pnl: string;
    grade: string;
    notes: string;
  }>({ exit_price: "", pnl: "", grade: "", notes: "" });
  const [editSaving, setEditSaving] = useState(false);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [closeForm, setCloseForm] = useState({ exit_premium: "", grade: "A" });
  const [closeSaving, setCloseSaving] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [tagParam, setTagParam] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusParam, setStatusParam] = useState("");
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [directionFilter, setDirectionFilter] = useState("");
  const [instrumentFilter, setInstrumentFilter] = useState("");
  const [statsView, setStatsView] = useState<"day" | "trade">("day");
  const [allEntryInstruments, setAllEntryInstruments] = useState<string[]>([]);
  const [challenge, setChallenge] = useState<{
    active: boolean;
    day_number?: number;
    id?: string;
    stats?: { wins: number; losses: number; current_balance: number };
  } | null>(null);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);

  const fetchChallenge = async (token: string | null) => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/challenge/stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setChallenge(await res.json());
    } catch {}
  };

  const buildEntriesUrl = (
    off: number,
    q: string,
    setupF: string,
    dir: string,
    instrument: string,
    tag: string,
    dfrom: string,
    dto: string,
    status: string,
  ) => {
    const params = new URLSearchParams({
      limit: String(LIMIT),
      offset: String(off),
    });
    if (q) params.set("filter", q);
    else if (instrument) params.set("filter", instrument);
    const isSetupFilter = !["all", "winners", "losers"].includes(setupF);
    if (isSetupFilter) params.set("setup", setupF);
    if (dir) params.set("direction", dir);
    if (tag) params.set("tag", tag);
    if (dfrom) params.set("date_from", dfrom);
    if (dto) params.set("date_to", dto);
    if (status) params.set("status", status);
    return `${API}/journal/entries?${params}`;
  };

  const [mounted, setMounted] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setMounted(true);

    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const url = buildEntriesUrl(
        offset,
        search,
        sideFilter,
        directionFilter,
        instrumentFilter,
        tagParam,
        dateFrom,
        dateTo,
        statusParam,
      );
      fetch(url, { headers })
        .then((r) => r.json())
        .then((d) => {
          const fetched: JournalEntry[] = d.entries ?? [];
          setEntries(fetched);
          setHasMore((d.count ?? 0) === LIMIT);
          if (fetched.length > 0) {
            setAllEntryInstruments((prev) => {
              const merged = [
                ...new Set([...prev, ...fetched.map((e) => e.ticker)]),
              ].sort();
              return merged;
            });
          }
        })
        .catch(() => {});
      fetch(`${API}/journal/stats`, { headers })
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
      fetchChallenge(token);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    offset,
    search,
    sideFilter,
    directionFilter,
    instrumentFilter,
    tagParam,
    dateFrom,
    dateTo,
    statusParam,
    refreshKey,
  ]);

  const refetch = () => {
    if (offset !== 0) {
      setOffset(0); // offset change alone re-triggers the effect
    } else {
      setRefreshKey((k) => k + 1); // force re-run when already on page 1
    }
  };

  const handleExport = async () => {
    const token = await getToken();
    const params = new URLSearchParams({ format: "csv" });
    if (search) params.set("filter", search);
    else if (instrumentFilter) params.set("filter", instrumentFilter);
    const isSetupFilter = !["all", "winners", "losers"].includes(sideFilter);
    if (isSetupFilter) params.set("setup", sideFilter);
    if (directionFilter) params.set("direction", directionFilter);
    if (tagParam) params.set("tag", tagParam);
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (statusParam) params.set("status", statusParam);
    const res = await fetch(`${API}/journal/export?${params}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      alert("Export failed");
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "journal_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Delete this trade entry? This cannot be undone.")) return;
    const token = await getToken();
    try {
      const res = await fetch(`${API}/journal/entry/${entryId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      // optimistic remove then full refetch for accurate stats + pagination
      setEntries((prev) => prev.filter((e) => e.id !== entryId));
      refetch();
    } catch {
      alert("Delete failed — try again");
    }
  };

  const handleDuplicate = async (entryId: string) => {
    const token = await getToken();
    try {
      const res = await fetch(`${API}/journal/entry/${entryId}/duplicate`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      // refetch so the new open trade appears with correct server state + updated stats
      refetch();
    } catch {
      alert("Duplicate failed — try again");
    }
  };

  const handleRowAction = (action: string, entry: JournalEntry) => {
    switch (action) {
      case "edit_trade":
      case "edit_notes":
        handleEdit(entry);
        break;
      case "close_trade":
        setClosingId(entry.id);
        break;
      case "view_review":
        setExpandedId(expandedId === entry.id ? null : entry.id);
        break;
      case "rerun_review":
        handleReview(entry);
        break;
      case "duplicate_trade":
        handleDuplicate(entry.id);
        break;
      case "delete_trade":
        handleDelete(entry.id);
        break;
    }
  };

  // ── Derived ─────────────────────────────────────────────────
  const filteredByBar: JournalEntry[] = entries.filter((e) => {
    if (filter === "winners") return (e.pnl ?? 0) > 0;
    if (filter === "losers") return (e.pnl ?? 0) <= 0;
    if (filter === "aplus") return e.grade === "A+";
    return true;
  });

  const displayed: JournalEntry[] = filteredByBar.filter((e) => {
    if (sideFilter === "winners") return (e.pnl ?? 0) > 0;
    if (sideFilter === "losers") return (e.pnl ?? 0) <= 0;
    // setup filtering is done server-side; client-side pass-through
    return true;
  });

  const wins = stats?.wins ?? 0;
  const losses = stats?.losses ?? 0;
  const setupCounts: Record<string, number> = {};
  Object.entries(stats?.pnl_by_setup ?? {}).forEach(([setup, data]) => {
    setupCounts[setup] = data.wins + data.losses;
  });

  // ── Chart data ───────────────────────────────────────────────
  const equityData = {
    labels: (stats?.equity_dates ?? []).length
      ? stats!.equity_dates.map((d) => d.slice(5))
      : (stats?.equity_curve ?? []).map((_, i) => `${i + 1}`),
    datasets: [
      {
        data: stats?.equity_curve ?? [],
        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.08)",
        borderWidth: 2,
        fill: true,
        pointRadius: 3,
        pointBackgroundColor: "#22c55e",
      },
    ],
  };

  const setupLabels = Object.keys(stats?.pnl_by_setup ?? {});
  const setupData = {
    labels: setupLabels,
    datasets: [
      {
        label: "Wins",
        data: setupLabels.map((s) => stats?.pnl_by_setup[s]?.wins ?? 0),
        backgroundColor: "rgba(34,197,94,0.7)",
      },
      {
        label: "Losses",
        data: setupLabels.map((s) => stats?.pnl_by_setup[s]?.losses ?? 0),
        backgroundColor: "rgba(239,68,68,0.7)",
      },
    ],
  };

  const hourLabels = Object.keys(stats?.pnl_by_hour ?? {}).sort(
    (a, b) => Number(a) - Number(b),
  );
  const hourData = {
    labels: hourLabels.map((h) => `${h}:00`),
    datasets: [
      {
        data: hourLabels.map((h) => {
          const d = stats?.pnl_by_hour[h];
          if (!d) return 0;
          const total = d.wins + d.losses;
          return total > 0 ? Math.round((d.wins / total) * 100) : 0;
        }),
        backgroundColor: hourLabels.map((h) => {
          const d = stats?.pnl_by_hour[h];
          if (!d) return "rgba(100,116,139,0.4)";
          const total = d.wins + d.losses;
          if (total === 0) return "rgba(100,116,139,0.4)";
          const wr = (d.wins / total) * 100;
          if (wr >= 70) return "rgba(34,197,94,0.7)";
          if (wr >= 55) return "rgba(251,191,36,0.7)";
          return "rgba(239,68,68,0.7)";
        }),
      },
    ],
  };

  const barOpts = {
    ...CHART_OPTS,
    scales: { ...CHART_OPTS.scales, y: { ...CHART_OPTS.scales.y, max: 100 } },
  };

  const handleEdit = (entry: JournalEntry) => {
    setEditingId(entry.id);
    setEditForm({
      exit_price: entry.exit_price != null ? entry.exit_price.toFixed(2) : "",
      pnl: entry.pnl != null ? entry.pnl.toFixed(0) : "",
      grade: entry.grade,
      notes: entry.notes ?? "",
    });
  };

  const handleSave = async (entryId: string, direction: string) => {
    setEditSaving(true);
    const token = await getToken();
    const exit = parseFloat(editForm.exit_price);
    const entryRow = entries.find((e) => e.id === entryId);
    const isBull = direction.toUpperCase() === "BULL";
    // Premium-based trades: use premiums for P&L, not SPX price difference
    const computedPnl =
      entryRow?.entry_premium != null && entryRow?.exit_premium != null
        ? Math.round(
            (entryRow.exit_premium - entryRow.entry_premium) *
              entryRow.contracts *
              100 *
              100,
          ) / 100
        : entryRow
          ? (isBull
              ? exit - entryRow.entry_price
              : entryRow.entry_price - exit) * 100
          : parseFloat(editForm.pnl);
    const rounded = Math.round(computedPnl * 100) / 100;
    try {
      const res = await fetch(`${API}/journal/entry/${entryId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exit_price: exit,
          pnl: rounded,
          grade: editForm.grade,
          process_grade: editForm.grade,
          notes: editForm.notes || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                exit_price: exit,
                pnl: rounded,
                grade: editForm.grade,
                process_grade: editForm.grade,
                notes: editForm.notes,
              }
            : e,
        ),
      );
      setEditingId(null);
    } catch (err) {
      console.error("Save error:", err);
      alert("Save failed — try again");
    } finally {
      setEditSaving(false);
    }
  };

  const handleClose = async (entry: JournalEntry) => {
    setCloseSaving(true);
    const token = await getToken();
    const exitPremium = parseFloat(closeForm.exit_premium);
    if (!exitPremium || exitPremium <= 0) {
      setCloseSaving(false);
      return;
    }
    const entryPremium = entry.entry_premium ?? 0;
    const pnl =
      Math.round((exitPremium - entryPremium) * entry.contracts * 100 * 100) /
      100;
    try {
      const res = await fetch(`${API}/journal/entry/${entry.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          exit_premium: exitPremium,
          pnl,
          grade: closeForm.grade,
          process_grade: closeForm.grade,
          status: "closed",
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const review = data.review as
        | { grade: string; verdict: string }
        | undefined;
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? {
                ...e,
                exit_premium: exitPremium,
                pnl,
                grade: closeForm.grade,
                process_grade: review?.grade || closeForm.grade,
                process_review: review?.verdict ?? null,
                status: "closed",
              }
            : e,
        ),
      );
      setClosingId(null);
      setCloseForm({ exit_premium: "", grade: "A" });
    } catch {
      alert("Close failed — try again");
    } finally {
      setCloseSaving(false);
    }
  };

  const handleReview = async (entry: JournalEntry) => {
    setReviewingId(entry.id);
    try {
      const token = await getToken();
      const res = await fetch(`${API}/journal/review/${entry.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entry.id
            ? { ...e, process_grade: data.grade, process_review: data.verdict }
            : e,
        ),
      );
    } catch {
      alert("Review failed — try again");
    } finally {
      setReviewingId(null);
    }
  };

  return (
    <div className={styles.page}>
      <Header
        deskOpen={false}
        refreshing={false}
        onRefresh={() => {}}
        onClearSession={() => {}}
        marketData={null}
        activePage="journal"
      />

      <div className={styles.shell}>
        <AppIconRail activePage="journal" />

        <div className={styles.content}>
          {/* ── Sidebar ─────────────────────────────────────────── */}
          <JournalSidebar
            entriesCount={stats?.total_trades ?? entries.length}
            wins={wins}
            losses={losses}
            setupCounts={setupCounts}
            sideFilter={sideFilter}
            onSideFilterChange={setSideFilter}
            instruments={allEntryInstruments}
            instrumentFilter={instrumentFilter}
            onInstrumentFilterChange={(v) => {
              setInstrumentFilter(v);
              setOffset(0);
            }}
            directionFilter={directionFilter}
            onDirectionFilterChange={(d) => {
              setDirectionFilter(d);
              setOffset(0);
            }}
            tagFilter={tagParam}
            onTagFilterChange={(t) => {
              setTagParam(t);
              setOffset(0);
            }}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={(d) => {
              setDateFrom(d);
              setOffset(0);
            }}
            onDateToChange={(d) => {
              setDateTo(d);
              setOffset(0);
            }}
            statsView={statsView}
            onStatsViewChange={setStatsView}
          />

          {/* ── Main content ────────────────────────────────────── */}
          <main className={styles.main}>
            <div ref={scrollBodyRef} className={styles.scrollBody}>
              {/* Stats bar */}
              <JournalStatsCards
                totalPnl={stats ? fmtPnl(stats.total_pnl) : "—"}
                winRate={stats ? `${stats.win_rate}%` : "—"}
                avgWinner={stats ? fmtPnl(stats.avg_winner) : "—"}
                avgLoser={stats ? fmtPnl(stats.avg_loser) : "—"}
                bestSetup={stats?.best_setup ?? "—"}
                wins={stats?.wins ?? 0}
                losses={stats?.losses ?? 0}
                bestSetupPnl={
                  stats?.best_setup_pnl != null
                    ? fmtPnl(stats.best_setup_pnl)
                    : null
                }
              />

              {/* Challenge banner */}
              <div className={styles.challengeStrip}>
                {challenge?.active ? (
                  <>
                    <span>
                      Challenge: Day {challenge.day_number}/90
                      {challenge.stats && (
                        <>
                          {" · "}
                          <strong>
                            ${challenge.stats.current_balance.toLocaleString()}
                          </strong>
                          {" · "}
                          <em>
                            {challenge.stats.wins}W-{challenge.stats.losses}L
                          </em>
                        </>
                      )}
                    </span>

                    <Link href="/challenge">View →</Link>
                  </>
                ) : (
                  <Link href="/challenge">Start a 90-Day Challenge →</Link>
                )}
              </div>

              {/* Desktop charts only. Hidden on mobile. */}
              {mounted && !isMobile && (
                <div className={styles.desktopChartsOnly}>
                  <JournalCharts
                    stats={stats}
                    equityData={equityData}
                    setupData={setupData}
                    hourData={hourData}
                    chartOptions={CHART_OPTS}
                    barOptions={barOpts}
                    setupLabels={setupLabels}
                  />
                </div>
              )}

              {/* Filter toolbar */}
              <JournalFilterBar
                activeFilter={filter}
                onFilterChange={(f) => {
                  setFilter(f);
                  setOffset(0);

                  if (f === "bull") setDirectionFilter("CALL");
                  else if (f === "bear") setDirectionFilter("PUT");
                  else setDirectionFilter("");
                }}
                search={search}
                onSearchChange={(v) => {
                  setSearch(v);
                  setOffset(0);
                }}
                onClear={() => {
                  setFilter("all");
                  setSearch("");
                  setOffset(0);
                  setSideFilter("all");
                  setTagParam("");
                  setDateFrom("");
                  setDateTo("");
                  setStatusParam("");
                  setDirectionFilter("");
                  setInstrumentFilter("");
                }}
              />

              {/* Trade table / mobile cards */}
              <JournalTradeTable
                entries={displayed}
                totalPnl={stats ? fmtPnl(stats.total_pnl) : "—"}
                avgWinner={stats ? fmtPnl(stats.avg_winner) : "—"}
                avgLoser={stats ? fmtPnl(stats.avg_loser) : "—"}
                winRate={stats ? `${stats.win_rate}%` : "—"}
                profitFactor={stats ? String(stats.profit_factor ?? 0) : "—"}
                expectancy={stats ? fmtExpectancy(stats.expectancy ?? 0) : "—"}
                onExport={handleExport}
                onAction={handleRowAction}
                offset={offset}
                limit={LIMIT}
                hasMore={hasMore}
                onPageChange={(newOffset) => setOffset(newOffset)}
              />

              {/* Keep your existing Review / Close / Edit modals below this line */}
              {expandedId &&
                (() => {
                  const entry = entries.find((e) => e.id === expandedId);
                  if (!entry?.process_review) return null;

                  return (
                    <div
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 200,
                        background: "rgba(0,0,0,0.6)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onClick={() => setExpandedId(null)}
                    >
                      <div
                        style={{
                          background: "#0d1828",
                          border: "1px solid rgba(59,130,246,0.25)",
                          borderRadius: 12,
                          padding: 24,
                          maxWidth: 520,
                          width: "90%",
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div
                          style={{
                            fontSize: 11,
                            color: "#60a5fa",
                            fontWeight: 700,
                            marginBottom: 10,
                          }}
                        >
                          PROCESS REVIEW — {entry.date} {entry.setup}
                        </div>

                        <p
                          style={{
                            color: "#cbd5e1",
                            fontSize: 13,
                            lineHeight: 1.6,
                            margin: 0,
                          }}
                        >
                          {entry.process_review}
                        </p>

                        <button
                          onClick={() => setExpandedId(null)}
                          style={{
                            marginTop: 16,
                            padding: "6px 14px",
                            borderRadius: 6,
                            border: "1px solid rgba(59,130,246,0.2)",
                            background: "transparent",
                            color: "#94a3b8",
                            fontSize: 12,
                            cursor: "pointer",
                          }}
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  );
                })()}

              {/* Keep your existing closingId and editingId modal blocks here unchanged */}
            </div>

            {/* Chat entry bar */}
            <div className={styles.chatBar}>
              {/* existing input and button stay same */}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
