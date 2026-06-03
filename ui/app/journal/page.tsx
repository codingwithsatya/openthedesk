"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
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
import { Line, Bar } from "react-chartjs-2";
import Header from "../components/Header";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Filler, Tooltip);

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ─────────────────────────────────────────────────────
interface JournalEntry {
  id: string;
  created_at: string;
  date: string;
  ticker: string;
  setup: string;
  direction: string;
  entry_price: number;
  exit_price: number;
  contracts: number;
  pnl: number;
  grade: string;
  process_grade: string;
  notes?: string;
  internals?: { trin?: number | null; add?: number | null; vold?: number | null };
}

interface JournalStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  avg_winner: number;
  avg_loser: number;
  best_setup: string | null;
  pnl_by_setup: Record<string, { wins: number; losses: number; total_pnl: number }>;
  pnl_by_hour: Record<string, { wins: number; losses: number }>;
  equity_curve: number[];
}

// ── Helpers ───────────────────────────────────────────────────
function fmtPnl(v: number) {
  const abs = Math.abs(v).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  return `${v >= 0 ? "+" : "-"}$${abs}`;
}

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
  if (grade === "A+") return { bg: "#1e3a5f", color: "#60a5fa", border: "1px solid #2d5a8e" };
  if (grade === "B")  return { bg: "#1e1a0f", color: "#fbbf24", border: "1px solid #78350f" };
  return { bg: "transparent", color: "#64748b", border: "1px solid #334155" };
}

const CHART_OPTS = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false }, tooltip: { enabled: true } },
  scales: {
    x: { ticks: { color: "#475569", font: { size: 10 } }, grid: { color: "rgba(30,58,95,0.4)" } },
    y: { ticks: { color: "#475569", font: { size: 10 } }, grid: { color: "rgba(30,58,95,0.4)" } },
  },
} as const;

type FilterKey = "all" | "bull" | "bear" | "winners" | "losers" | "aplus";

// ── Page ──────────────────────────────────────────────────────
export default function JournalPage() {
  const { getToken } = useAuth();
  const [entries, setEntries]     = useState<JournalEntry[]>([]);
  const [stats, setStats]         = useState<JournalStats | null>(null);
  const [filter, setFilter]       = useState<FilterKey>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sideFilter, setSideFilter] = useState<string>("all");
  const [chatInput, setChatInput] = useState("");

  useEffect(() => {
    (async () => {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      fetch(`${API}/journal/entries?limit=50`, { headers })
        .then((r) => r.json())
        .then((d) => setEntries(d.entries ?? []))
        .catch(() => {});
      fetch(`${API}/journal/stats`, { headers })
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Derived ─────────────────────────────────────────────────
  const filteredByBar: JournalEntry[] = entries.filter((e) => {
    if (filter === "bull")    return e.direction.toUpperCase() === "BULL";
    if (filter === "bear")    return e.direction.toUpperCase() === "BEAR";
    if (filter === "winners") return e.pnl > 0;
    if (filter === "losers")  return e.pnl <= 0;
    if (filter === "aplus")   return e.grade === "A+";
    return true;
  });

  const displayed: JournalEntry[] = filteredByBar.filter((e) => {
    if (sideFilter === "winners") return e.pnl > 0;
    if (sideFilter === "losers")  return e.pnl <= 0;
    if (["GG","FLAG","VOMY","DIV","TWEEZER"].includes(sideFilter))
      return e.setup.toUpperCase() === sideFilter;
    return true;
  });

  const wins    = entries.filter((e) => e.pnl > 0).length;
  const losses  = entries.filter((e) => e.pnl <= 0).length;
  const setupCounts: Record<string, number> = {};
  entries.forEach((e) => {
    const s = e.setup.toUpperCase();
    setupCounts[s] = (setupCounts[s] ?? 0) + 1;
  });

  // ── Chart data ───────────────────────────────────────────────
  const equityData = {
    labels: (stats?.equity_curve ?? []).map((_, i) => `${i + 1}`),
    datasets: [{
      data: stats?.equity_curve ?? [],
      borderColor: "#22c55e",
      backgroundColor: "rgba(34,197,94,0.08)",
      borderWidth: 2,
      fill: true,
      pointRadius: 3,
      pointBackgroundColor: "#22c55e",
    }],
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

  const hourLabels = ["9", "10", "11", "12", "13"];
  const hourData = {
    labels: hourLabels.map((h) => `${h}:00`),
    datasets: [{
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
    }],
  };

  const barOpts = { ...CHART_OPTS, scales: { ...CHART_OPTS.scales, y: { ...CHART_OPTS.scales.y, max: 100 } } };

  // ── Stat cell ────────────────────────────────────────────────
  const StatCell = ({ label, value, color }: { label: string; value: string; color?: string }) => (
    <div style={{
      flex: 1, padding: "12px 16px",
      borderRight: "1px solid #1e3a5f",
      display: "flex", flexDirection: "column", gap: 4,
    }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, fontFamily: "var(--font-jetbrains-mono), monospace", color: color ?? "#f1f5f9" }}>{value}</div>
    </div>
  );

  // ── Sidebar item ─────────────────────────────────────────────
  const SideItem = ({ label, count, value }: { label: string; count?: number; value: string }) => (
    <button
      onClick={() => setSideFilter(value)}
      style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        width: "100%", padding: "6px 12px", border: "none",
        background: sideFilter === value ? "#1e3a5f" : "transparent",
        color: sideFilter === value ? "#f1f5f9" : "#64748b",
        cursor: "pointer", fontSize: 12, borderRadius: 5,
        fontFamily: "var(--font-inter), sans-serif",
      }}
    >
      <span>{label}</span>
      {count !== undefined && (
        <span style={{ fontSize: 11, color: sideFilter === value ? "#94a3b8" : "#475569" }}>{count}</span>
      )}
    </button>
  );

  const FilterBtn = ({ label, value }: { label: string; value: FilterKey }) => (
    <button
      onClick={() => setFilter(value)}
      style={{
        padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 500,
        border: `1px solid ${filter === value ? "#2d5a8e" : "#1e3a5f"}`,
        background: filter === value ? "#1e3a5f" : "transparent",
        color: filter === value ? "#f1f5f9" : "#475569",
        cursor: "pointer", fontFamily: "var(--font-inter), sans-serif",
      }}
    >
      {label}
    </button>
  );

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#090e1a" }}>
      <Header
        deskOpen={false} refreshing={false}
        onRefresh={() => {}} onClearSession={() => {}}
        marketData={null} activePage="journal"
      />

      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
        {/* ── Sidebar ─────────────────────────────────────────── */}
        <aside style={{
          width: 200, flexShrink: 0,
          background: "#0d1320",
          borderRight: "1px solid #1e3a5f",
          display: "flex", flexDirection: "column",
          padding: "16px 8px", gap: 4, overflowY: "auto",
        }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 12px", marginBottom: 4 }}>
            This Month
          </div>
          <SideItem label="All trades" count={entries.length} value="all" />
          <SideItem label="Winners"    count={wins}           value="winners" />
          <SideItem label="Losers"     count={losses}         value="losers" />

          <div style={{ height: 1, background: "#1e3a5f", margin: "10px 4px" }} />
          <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", padding: "4px 12px", marginBottom: 4 }}>
            By Setup
          </div>
          {["GG", "FLAG", "VOMY", "DIV", "TWEEZER"].map((s) => (
            <SideItem key={s} label={s} count={setupCounts[s] ?? 0} value={s} />
          ))}

          <div style={{ flex: 1 }} />
          <button
            style={{
              margin: "8px 4px 0",
              padding: "9px 12px", borderRadius: 7,
              background: "#1e3a5f", color: "#f1f5f9",
              border: "1px solid #2d5a8e", cursor: "pointer",
              fontSize: 12, fontWeight: 600,
              fontFamily: "var(--font-inter), sans-serif",
            }}
            onClick={() => alert("Trade entry form coming soon")}
          >
            + Log a trade
          </button>
        </aside>

        {/* ── Main content ────────────────────────────────────── */}
        <main style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Stats bar */}
          <div style={{ display: "flex", background: "#0d1320", borderBottom: "1px solid #1e3a5f", flexShrink: 0 }}>
            <StatCell
              label="Total P&L"
              value={stats ? fmtPnl(stats.total_pnl) : "—"}
              color={stats ? pnlColor(stats.total_pnl) : undefined}
            />
            <StatCell
              label="Win Rate"
              value={stats ? `${stats.win_rate}%` : "—"}
              color={stats && stats.win_rate >= 60 ? "#4ade80" : stats && stats.win_rate >= 50 ? "#fbbf24" : "#f87171"}
            />
            <StatCell
              label="Avg Winner"
              value={stats ? fmtPnl(stats.avg_winner) : "—"}
              color="#4ade80"
            />
            <StatCell
              label="Avg Loser"
              value={stats ? fmtPnl(stats.avg_loser) : "—"}
              color="#f87171"
            />
            <StatCell
              label="Best Setup"
              value={stats?.best_setup ?? "—"}
            />
          </div>

          {/* Scrollable body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px 80px" }}>
            {/* Charts row */}
            <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
              {/* Equity curve */}
              <div style={{
                flex: 2, background: "#0d1320", borderRadius: 8,
                border: "1px solid #1e3a5f", padding: "12px 14px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Cumulative P&L
                </div>
                <div style={{ height: 120 }}>
                  {stats && stats.equity_curve.length > 0
                    ? <Line data={equityData} options={CHART_OPTS} />
                    : <div style={{ color: "#475569", fontSize: 12, paddingTop: 40, textAlign: "center" }}>No data</div>
                  }
                </div>
              </div>

              {/* P&L by setup */}
              <div style={{
                flex: 1, background: "#0d1320", borderRadius: 8,
                border: "1px solid #1e3a5f", padding: "12px 14px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  P&L by Setup
                </div>
                <div style={{ height: 120 }}>
                  {setupLabels.length > 0
                    ? <Bar data={setupData} options={CHART_OPTS} />
                    : <div style={{ color: "#475569", fontSize: 12, paddingTop: 40, textAlign: "center" }}>No data</div>
                  }
                </div>
              </div>

              {/* Win rate by hour */}
              <div style={{
                flex: 1, background: "#0d1320", borderRadius: 8,
                border: "1px solid #1e3a5f", padding: "12px 14px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 8 }}>
                  Win % by Hour
                </div>
                <div style={{ height: 120 }}>
                  {stats
                    ? <Bar data={hourData} options={barOpts} />
                    : <div style={{ color: "#475569", fontSize: 12, paddingTop: 40, textAlign: "center" }}>No data</div>
                  }
                </div>
              </div>
            </div>

            {/* Filter toolbar */}
            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              <FilterBtn label="All"      value="all" />
              <FilterBtn label="Bull"     value="bull" />
              <FilterBtn label="Bear"     value="bear" />
              <FilterBtn label="Winners"  value="winners" />
              <FilterBtn label="Losers"   value="losers" />
              <FilterBtn label="A+ only"  value="aplus" />
            </div>

            {/* Trade table */}
            <div style={{ background: "#0d1320", borderRadius: 8, border: "1px solid #1e3a5f", overflow: "hidden" }}>
              {/* Table header */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "90px 60px 90px 90px 90px 60px 70px 28px",
                padding: "8px 14px",
                background: "#0a1120",
                borderBottom: "1px solid #1e3a5f",
                fontSize: 10, fontWeight: 600, color: "#475569",
                textTransform: "uppercase", letterSpacing: "0.08em",
              }}>
                <span>Date</span>
                <span>Setup</span>
                <span>Entry</span>
                <span>Exit</span>
                <span>P&L</span>
                <span>Grade</span>
                <span>Process</span>
                <span />
              </div>

              {displayed.length === 0 ? (
                <div style={{ padding: "32px 14px", color: "#475569", fontSize: 13, textAlign: "center" }}>
                  No trades match this filter
                </div>
              ) : (
                displayed.map((e) => {
                  const badge  = setupBadge(e.setup, e.direction);
                  const gBadge = gradeBadge(e.grade);
                  const pBadge = gradeBadge(e.process_grade);
                  const isOpen = expandedId === e.id;

                  return (
                    <div key={e.id} style={{ borderBottom: "0.5px solid #1a2744" }}>
                      {/* Row */}
                      <div
                        onClick={() => setExpandedId(isOpen ? null : e.id)}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "90px 60px 90px 90px 90px 60px 70px 28px",
                          padding: "9px 14px",
                          cursor: "pointer",
                          alignItems: "center",
                          background: isOpen ? "rgba(30,58,95,0.25)" : "transparent",
                          transition: "background 0.12s",
                        }}
                      >
                        <span style={{ fontSize: 12, color: "#94a3b8", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                          {e.date.slice(5)}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          padding: "2px 7px", borderRadius: 4,
                          background: badge.bg, color: badge.color, border: badge.border,
                          justifySelf: "start",
                        }}>
                          {e.setup}
                        </span>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-jetbrains-mono), monospace", color: "#94a3b8" }}>
                          {e.entry_price.toFixed(2)}
                        </span>
                        <span style={{ fontSize: 12, fontFamily: "var(--font-jetbrains-mono), monospace", color: "#94a3b8" }}>
                          {e.exit_price.toFixed(2)}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, fontFamily: "var(--font-jetbrains-mono), monospace", color: pnlColor(e.pnl) }}>
                          {fmtPnl(e.pnl)}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: "1px 6px", borderRadius: 4,
                          background: gBadge.bg, color: gBadge.color, border: gBadge.border,
                          justifySelf: "start",
                        }}>
                          {e.grade}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 700,
                          padding: "1px 6px", borderRadius: 4,
                          background: pBadge.bg, color: pBadge.color, border: pBadge.border,
                          justifySelf: "start",
                        }}>
                          {e.process_grade}
                        </span>
                        <span style={{ color: "#475569", fontSize: 11, textAlign: "center" }}>
                          {isOpen ? "▲" : "▼"}
                        </span>
                      </div>

                      {/* Expanded detail */}
                      {isOpen && (
                        <div style={{
                          display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                          background: "rgba(13,19,32,0.8)",
                          borderTop: "0.5px solid #1e3a5f",
                        }}>
                          {/* Trade details */}
                          <div style={{ padding: "14px 16px", borderRight: "0.5px solid #1e3a5f" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                              Trade Details
                            </div>
                            {[
                              ["Ticker",    e.ticker],
                              ["Direction", e.direction],
                              ["Contracts", `${e.contracts}x`],
                              ["Entry",     `$${e.entry_price.toFixed(2)}`],
                              ["Exit",      `$${e.exit_price.toFixed(2)}`],
                            ].map(([label, val]) => (
                              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                                <span style={{ fontSize: 11, color: "#475569" }}>{label}</span>
                                <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "var(--font-jetbrains-mono), monospace" }}>{val}</span>
                              </div>
                            ))}
                            {e.internals && (
                              <>
                                <div style={{ height: 1, background: "#1e3a5f", margin: "8px 0" }} />
                                <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6 }}>At Entry</div>
                                {e.internals.trin != null && (
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, color: "#475569" }}>TRIN</span>
                                    <span style={{ fontSize: 11, fontFamily: "var(--font-jetbrains-mono), monospace", color: e.internals.trin > 1.2 ? "#f87171" : e.internals.trin < 0.8 ? "#4ade80" : "#94a3b8" }}>
                                      {e.internals.trin.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                {e.internals.add != null && (
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                                    <span style={{ fontSize: 11, color: "#475569" }}>ADD</span>
                                    <span style={{ fontSize: 11, fontFamily: "var(--font-jetbrains-mono), monospace", color: e.internals.add > 200 ? "#4ade80" : e.internals.add < -200 ? "#f87171" : "#94a3b8" }}>
                                      {e.internals.add > 0 ? "+" : ""}{e.internals.add}
                                    </span>
                                  </div>
                                )}
                                {e.internals.vold != null && (
                                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                                    <span style={{ fontSize: 11, color: "#475569" }}>VOLD</span>
                                    <span style={{ fontSize: 11, color: "#94a3b8", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                                      {e.internals.vold.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {/* Notes */}
                          <div style={{ padding: "14px 16px", borderRight: "0.5px solid #1e3a5f" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                              Notes
                            </div>
                            <p style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, margin: 0 }}>
                              {e.notes || "No notes"}
                            </p>
                          </div>

                          {/* AI placeholder */}
                          <div style={{ padding: "14px 16px" }}>
                            <div style={{ fontSize: 10, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10 }}>
                              Process Review
                            </div>
                            <div style={{
                              padding: "10px 12px", borderRadius: 6,
                              background: "#0a1120", border: "1px solid #1e3a5f",
                              fontSize: 12, color: "#334155", fontStyle: "italic",
                            }}>
                              Claude analysis will appear here
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Chat entry bar */}
          <div style={{
            position: "sticky", bottom: 0,
            borderTop: "1px solid #1e3a5f",
            background: "#0d1320",
            padding: "10px 16px",
            display: "flex", gap: 8, alignItems: "center",
          }}>
            <input
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder='Log a trade... e.g. "GG Bear at 7390, exit 7378, made $360"'
              style={{
                flex: 1, padding: "9px 14px", borderRadius: 7,
                background: "#0a1120", border: "1px solid #1e3a5f",
                color: "#f1f5f9", fontSize: 13,
                fontFamily: "var(--font-inter), sans-serif",
                outline: "none",
              }}
            />
            <button
              onClick={() => alert("Chat entry coming soon")}
              style={{
                padding: "9px 18px", borderRadius: 7,
                background: "#1e3a5f", color: "#f1f5f9",
                border: "1px solid #2d5a8e", cursor: "pointer",
                fontSize: 13, fontWeight: 600,
                fontFamily: "var(--font-inter), sans-serif",
                whiteSpace: "nowrap",
              }}
            >
              Log trade
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
