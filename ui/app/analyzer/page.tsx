"use client";
import { useState, useEffect } from "react";
import Header from "../components/Header";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Types ────────────────────────────────────────────────────────────────────

interface AtrLevels {
  trigger_up: number;
  gg_open_up: number;
  gg_complete_up: number;
  full_atr_up: number;
  trigger_down: number;
  gg_open_down: number;
  gg_complete_down: number;
  full_atr_down: number;
}

interface TickerData {
  ticker: string;
  market: "US" | "IN";
  price: number | null;
  prev_close: number | null;
  change_pct: number | null;
  ema_8: number | null;
  ema_21: number | null;
  ema_48: number | null;
  ema_200: number | null;
  ribbon_state: "BULLISH" | "BEARISH" | "MIXED" | null;
  atr_14: number | null;
  atr_levels: AtrLevels | null;
  week52_high: number | null;
  week52_low: number | null;
  price_vs_52w_high_pct: number | null;
  distance_from_52w_high_pct: number | null;
  avg_volume_10d: number | null;
  relative_volume: number | null;
  pe_ratio: number | null;
  eps_growth_yoy: number | null;
  revenue_growth_yoy: number | null;
  market_cap: number | null;
  sector: string | null;
  beta: number | null;
  debt_to_equity: number | null;
  short_interest_pct: number | null;
  earnings_date: string | null;
  days_to_earnings: number | null;
  iv_rank?: number | null;
  has_options?: boolean;
}

interface AnalysisResult {
  ticker: string;
  market_data: TickerData;
  short_term: string;
  long_term: string;
}

interface ScreenerRow {
  ticker: string;
  ribbon_state: "BULLISH" | "BEARISH";
  price: number | null;
  change_pct: number | null;
  atr_14: number | null;
  sector: string | null;
}

interface ScreenerData {
  us_setups: ScreenerRow[];
  india_setups: ScreenerRow[];
  generated_at: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, dec = 2): string {
  return v != null ? v.toFixed(dec) : "—";
}

function fmtChange(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function renderBold(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**")
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MarkdownText({ content }: { content: string }) {
  return (
    <div style={{ fontSize: 13, lineHeight: 1.75, fontFamily: "var(--font-jetbrains-mono), monospace" }}>
      {content.split("\n").map((line, i) => (
        <div key={i} style={{ minHeight: line.trim() ? undefined : "6px" }}>
          {renderBold(line)}
        </div>
      ))}
    </div>
  );
}

function RibbonBadge({ state }: { state: string | null }) {
  const map: Record<string, { bg: string; color: string; border: string }> = {
    BULLISH: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
    BEARISH: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
    MIXED:   { bg: "rgba(100,116,139,0.1)", color: "#64748b", border: "#e2e8f0" },
  };
  const s = state || "MIXED";
  const c = map[s] ?? map.MIXED;
  return (
    <span style={{
      padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
      letterSpacing: "0.04em", textTransform: "uppercase" as const,
      background: c.bg, color: c.color, border: `1px solid ${c.border}`,
    }}>
      {s}
    </span>
  );
}

function ScreenerColumn({
  title, setups, currency, onRowClick,
}: {
  title: string;
  setups: ScreenerRow[];
  currency: string;
  onRowClick: (t: string) => void;
}) {
  return (
    <div style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden" }}>
      <div style={{
        padding: "10px 14px", background: "#f8fafc", borderBottom: "1px solid #f1f5f9",
        fontSize: 11, fontWeight: 600, color: "#64748b",
        textTransform: "uppercase" as const, letterSpacing: "0.08em",
      }}>
        {title}{setups.length > 0 && ` (${setups.length})`}
      </div>
      {setups.length === 0 ? (
        <div style={{ padding: "24px 14px", color: "#94a3b8", fontSize: 13, textAlign: "center" as const }}>
          No clean setups
        </div>
      ) : (
        setups.map((s) => (
          <ScreenerRowButton key={s.ticker} row={s} currency={currency} onClick={onRowClick} />
        ))
      )}
    </div>
  );
}

function ScreenerRowButton({
  row, currency, onClick,
}: {
  row: ScreenerRow;
  currency: string;
  onClick: (t: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <button
      onClick={() => onClick(row.ticker)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", width: "100%", padding: "9px 14px",
        background: hovered ? "#f8fafc" : "white",
        border: "none", borderBottom: "1px solid #f8fafc",
        cursor: "pointer", textAlign: "left" as const, gap: 8, transition: "background 0.1s",
      }}
    >
      <span style={{
        fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 13, fontWeight: 700,
        color: "#0f172a", minWidth: 100,
      }}>
        {row.ticker}
      </span>
      <RibbonBadge state={row.ribbon_state} />
      <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 12, color: "#1e293b" }}>
        {currency}{fmt(row.price)}
      </span>
      <span style={{
        fontSize: 11, marginLeft: "auto",
        color: (row.change_pct ?? 0) >= 0 ? "#15803d" : "#dc2626",
        fontFamily: "var(--font-jetbrains-mono), monospace",
      }}>
        {fmtChange(row.change_pct)}
      </span>
      <span style={{
        fontSize: 10, color: "#94a3b8", maxWidth: 80,
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
      }}>
        {row.sector ?? ""}
      </span>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyzerPage() {
  const [tickerInput,      setTickerInput]      = useState("");
  const [isAnalyzing,      setIsAnalyzing]      = useState(false);
  const [isLoadingScreener,setIsLoadingScreener] = useState(true);
  const [result,           setResult]           = useState<AnalysisResult | null>(null);
  const [screener,         setScreener]         = useState<ScreenerData | null>(null);
  const [error,            setError]            = useState<string | null>(null);

  useEffect(() => { loadScreener(); }, []);

  const loadScreener = async () => {
    setIsLoadingScreener(true);
    try {
      const r = await fetch(`${API}/screener`);
      setScreener(await r.json());
    } catch { /* silently fail */ }
    finally { setIsLoadingScreener(false); }
  };

  const analyze = async (sym: string) => {
    const t = sym.trim().toUpperCase();
    if (!t) return;
    setTickerInput(t);
    setIsAnalyzing(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setResult(await r.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); analyze(tickerInput); };

  const md      = result?.market_data;
  const levels  = md?.atr_levels;
  const ccy     = md?.market === "IN" ? "₹" : "$";

  return (
    <div style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", background: "#f8fafc" }}>
      <Header
        deskOpen={false}
        refreshing={false}
        onRefresh={() => {}}
        onClearSession={() => {}}
        marketData={null}
        activePage="analyzer"
      />

      <main style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "28px 24px 48px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>

          {/* ── Search bar ── */}
          <form onSubmit={handleSubmit} style={{ display: "flex", gap: 10, marginBottom: 28 }}>
            <input
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              placeholder="Enter ticker (AAPL, RELIANCE.NS...)"
              disabled={isAnalyzing}
              style={{
                flex: 1, padding: "12px 18px", borderRadius: 10,
                border: "1px solid #e2e8f0", background: "white",
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: 15, color: "#1e293b", outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={isAnalyzing || !tickerInput.trim()}
              style={{
                padding: "12px 28px", borderRadius: 10, whiteSpace: "nowrap",
                background: isAnalyzing ? "#94a3b8" : "#1d4ed8",
                color: "white", border: "none",
                cursor: isAnalyzing || !tickerInput.trim() ? "not-allowed" : "pointer",
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 14, fontWeight: 600,
              }}
            >
              {isAnalyzing ? "Analyzing..." : "Search"}
            </button>
          </form>

          {/* ── Error ── */}
          {error && (
            <div style={{
              padding: "12px 16px", borderRadius: 8, marginBottom: 20,
              background: "#fef2f2", border: "1px solid #fecaca",
              color: "#dc2626", fontSize: 13,
            }}>
              {error}
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {isAnalyzing && (
            <div style={{
              background: "white", borderRadius: 12, border: "1px solid #e2e8f0",
              padding: "32px 24px", marginBottom: 32, textAlign: "center" as const,
            }}>
              <div style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
                Fetching data and running analysis...
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div key={i} className="skel" style={{ width: 8, height: 8, borderRadius: "50%", animationDelay: `${delay}s` }} />
                ))}
              </div>
            </div>
          )}

          {/* ── Analysis result card ── */}
          {result && md && (
            <div style={{ marginBottom: 36, borderRadius: 12, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>

              {/* Header bar */}
              <div style={{ background: "#0d1320", padding: "16px 20px" }}>
                {/* Row 1: ticker, price, change, ribbon, market */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 22, fontWeight: 700, color: "white", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                    {md.ticker}
                  </span>
                  <span style={{ fontSize: 20, fontWeight: 600, color: "#e2e8f0", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                    {ccy}{fmt(md.price)}
                  </span>
                  <span style={{
                    fontSize: 14, fontFamily: "var(--font-jetbrains-mono), monospace",
                    color: (md.change_pct ?? 0) >= 0 ? "#4ade80" : "#f87171",
                  }}>
                    {fmtChange(md.change_pct)}
                  </span>
                  <RibbonBadge state={md.ribbon_state} />
                  <span style={{
                    padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                    letterSpacing: "0.04em", background: "#eff6ff", color: "#1d4ed8", border: "1px solid #bfdbfe",
                  }}>
                    {md.market}
                  </span>
                </div>
                {/* Row 2: 52W position + volume badges */}
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" as const }}>
                  {md.price_vs_52w_high_pct != null && (() => {
                    const pct = md.price_vs_52w_high_pct!;
                    const isNearATH  = pct >= -5;
                    const isValueZone = pct <= -15;
                    const bg     = isNearATH ? "#fef2f2" : isValueZone ? "#f0fdf4" : "rgba(255,255,255,0.07)";
                    const color  = isNearATH ? "#dc2626" : isValueZone ? "#15803d" : "#94a3b8";
                    const border = isNearATH ? "#fecaca" : isValueZone ? "#bbf7d0" : "rgba(255,255,255,0.12)";
                    const label  = isNearATH
                      ? `${Math.abs(pct).toFixed(1)}% from ATH ⚠`
                      : `${Math.abs(pct).toFixed(1)}% from ATH`;
                    return (
                      <span style={{
                        padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                        letterSpacing: "0.04em", background: bg, color, border: `1px solid ${border}`,
                      }}>
                        {label}
                      </span>
                    );
                  })()}
                  {md.relative_volume != null && (() => {
                    const rv = md.relative_volume!;
                    const highVol = rv >= 1.5;
                    return (
                      <span style={{
                        padding: "3px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
                        letterSpacing: "0.04em",
                        background: highVol ? "#f0fdf4" : "rgba(255,255,255,0.07)",
                        color:  highVol ? "#15803d" : "#94a3b8",
                        border: `1px solid ${highVol ? "#bbf7d0" : "rgba(255,255,255,0.12)"}`,
                      }}>
                        Vol {rv.toFixed(1)}x
                      </span>
                    );
                  })()}
                </div>
              </div>

              {/* ATR levels row */}
              {levels && (
                <div style={{
                  padding: "12px 20px", background: "white", borderBottom: "1px solid #f1f5f9",
                  display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center",
                }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#94a3b8", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginRight: 4 }}>
                    Key Levels
                  </span>
                  {([
                    { label: "GG Cmplt ▲", val: levels.gg_complete_up,   color: "#15803d" },
                    { label: "Trigger ▲",  val: levels.trigger_up,        color: "#22c55e" },
                    { label: "Trigger ▼",  val: levels.trigger_down,      color: "#f87171" },
                    { label: "GG Cmplt ▼", val: levels.gg_complete_down,  color: "#dc2626" },
                  ] as { label: string; val: number; color: string }[]).map(({ label, val, color }) => {
                    const near = md.price != null && md.atr_14 != null && Math.abs(md.price - val) < md.atr_14 * 0.12;
                    return (
                      <div key={label} style={{
                        padding: "4px 10px", borderRadius: 6,
                        background: near ? "#fef9c3" : "#f8fafc",
                        border: `1px solid ${near ? "#fde047" : "#e2e8f0"}`,
                        display: "flex", alignItems: "center", gap: 5,
                      }}>
                        <span style={{ fontSize: 10, color: "#94a3b8", fontFamily: "var(--font-inter), sans-serif" }}>{label}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color, fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                          {ccy}{val.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                  {md.price != null && (
                    <div style={{
                      padding: "4px 10px", borderRadius: 6,
                      background: "#0d1320", border: "1px solid #1e3a5f",
                      display: "flex", alignItems: "center", gap: 5,
                    }}>
                      <span style={{ fontSize: 10, color: "#64748b" }}>Now</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "white", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                        {ccy}{md.price.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Analysis panels */}
              <div className="analyzer-panels">
                {/* Short-term */}
                <div style={{ background: "white", padding: "18px 20px" }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: "#1d4ed8",
                    textTransform: "uppercase" as const, letterSpacing: "0.08em",
                    marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
                  }}>
                    OPTIONS TRADE PLAN · 1–2 Month
                    <span style={{ padding: "1px 6px", borderRadius: 4, background: "#eff6ff", color: "#1d4ed8", fontSize: 9, fontWeight: 700 }}>
                      HAIKU
                    </span>
                  </div>
                  <MarkdownText content={result.short_term} />
                </div>
                {/* Long-term */}
                <div style={{ background: "white", padding: "18px 20px" }}>
                  <div style={{
                    fontSize: 11, fontWeight: 600, color: "#7e22ce",
                    textTransform: "uppercase" as const, letterSpacing: "0.08em",
                    marginBottom: 12, display: "flex", alignItems: "center", gap: 6,
                  }}>
                    STOCK ANALYSIS · Long-Term
                    <span style={{ padding: "1px 6px", borderRadius: 4, background: "#faf5ff", color: "#7e22ce", fontSize: 9, fontWeight: 700 }}>
                      SONNET
                    </span>
                  </div>
                  <MarkdownText content={result.long_term} />
                </div>
              </div>

              {/* Fundamentals strip */}
              <div style={{
                background: "white", padding: "12px 20px", borderTop: "1px solid #f1f5f9",
                display: "flex", flexWrap: "wrap" as const, gap: 20,
              }}>
                {([
                  { label: "PE Ratio",   value: md.pe_ratio != null ? md.pe_ratio.toFixed(1) : "—" },
                  { label: "EPS Growth", value: md.eps_growth_yoy != null ? `${md.eps_growth_yoy >= 0 ? "+" : ""}${md.eps_growth_yoy.toFixed(1)}%` : "—" },
                  { label: "Mkt Cap",    value: md.market_cap != null ? `${md.market_cap}B` : "—" },
                  { label: "Sector",     value: md.sector || "—" },
                  ...(md.market === "US" && md.iv_rank != null
                    ? [{ label: "IV Rank", value: md.iv_rank.toFixed(0) }]
                    : []),
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <div key={label}>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#0f172a", fontFamily: "var(--font-jetbrains-mono), monospace" }}>{value}</div>
                  </div>
                ))}
                {md.earnings_date && (
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>Earnings</div>
                    <div style={{
                      fontSize: 13, fontWeight: 600, fontFamily: "var(--font-jetbrains-mono), monospace",
                      color: md.days_to_earnings != null && md.days_to_earnings <= 30 ? "#d97706" : "#0f172a",
                    }}>
                      {md.earnings_date}
                      {md.days_to_earnings != null && (
                        <span style={{ fontSize: 11, marginLeft: 5, color: md.days_to_earnings <= 7 ? "#dc2626" : "#d97706" }}>
                          ({md.days_to_earnings}d)
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* EMA strip */}
              <div style={{
                background: "#f8fafc", borderTop: "1px solid #e2e8f0",
                padding: "10px 20px", display: "flex", gap: 18, flexWrap: "wrap" as const,
              }}>
                {([
                  { label: "EMA 8",   val: md.ema_8 },
                  { label: "EMA 21",  val: md.ema_21 },
                  { label: "EMA 48",  val: md.ema_48 },
                  { label: "EMA 200", val: md.ema_200 },
                  { label: "ATR-14",  val: md.atr_14 },
                ] as { label: string; val: number | null }[]).map(({ label, val }) => (
                  <div key={label} style={{ display: "flex", gap: 5, alignItems: "baseline" }}>
                    <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: "0.06em" }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", fontFamily: "var(--font-jetbrains-mono), monospace" }}>
                      {fmt(val)}
                    </span>
                  </div>
                ))}
              </div>

            </div>
          )}

          {/* ── Screener section ── */}
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                {result ? "Other Setups" : "Today's Setups"}
              </h2>
              <button
                onClick={loadScreener}
                disabled={isLoadingScreener}
                style={{
                  padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 500,
                  fontFamily: "var(--font-inter), sans-serif",
                  border: "1px solid #1e3a5f", background: "transparent", color: "#94a3b8",
                  cursor: isLoadingScreener ? "not-allowed" : "pointer",
                  opacity: isLoadingScreener ? 0.5 : 1,
                }}
              >
                {isLoadingScreener ? "Loading..." : "↻ Refresh Screener"}
              </button>
            </div>

            {isLoadingScreener && !screener ? (
              <div className="analyzer-grid-2">
                {[0, 1].map((i) => (
                  <div key={i} style={{ background: "white", borderRadius: 10, border: "1px solid #e2e8f0", padding: 16 }}>
                    <div className="skel" style={{ width: 80, height: 13, marginBottom: 14 }} />
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} className="skel" style={{ height: 36, marginBottom: 8, borderRadius: 6 }} />
                    ))}
                  </div>
                ))}
              </div>
            ) : screener ? (
              <div className="analyzer-grid-2">
                <ScreenerColumn
                  title="US Setups"
                  setups={screener.us_setups}
                  currency="$"
                  onRowClick={analyze}
                />
                <ScreenerColumn
                  title="India Setups"
                  setups={screener.india_setups}
                  currency="₹"
                  onRowClick={analyze}
                />
              </div>
            ) : null}
          </div>

        </div>
      </main>
    </div>
  );
}
