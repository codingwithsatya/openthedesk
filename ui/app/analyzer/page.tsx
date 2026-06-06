"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
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

interface WatchlistTicker {
  ticker: string;
  price: number | null;
  change_pct: number | null;
  ribbon_state: "BULLISH" | "BEARISH" | "MIXED";
  atr_14: number | null;
  call_trigger: number | null;
  put_trigger: number | null;
  gg_open_call: number | null;
  gg_open_put: number | null;
  compression: boolean;
  po_value: number | null;
  volume_ratio: number | null;
  zero_dte_eligible: boolean;
  error: string | null;
}

interface WatchlistData {
  mag7: WatchlistTicker[];
  context: WatchlistTicker[];
  generated_at: string;
}

interface QuickReadResult {
  ticker: string;
  quick_read: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined, dec = 2): string {
  return v != null ? v.toFixed(dec) : "—";
}

function fmtChange(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function inlineHighlight(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\$[\d,]+\.?\d*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (p.startsWith("**") && p.endsWith("**"))
          return <strong key={i} style={{ color: "#e2e8f0", fontWeight: 600 }}>{p.slice(2, -2)}</strong>;
        if (/^\$[\d,]+\.?\d*$/.test(p))
          return <span key={i} style={{ color: "#22d3ee", fontWeight: 600 }}>{p}</span>;
        return <span key={i}>{p}</span>;
      })}
    </>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function MarkdownText({ content }: { content: string }) {
  return (
    <div style={{
      fontFamily: "var(--font-jetbrains-mono), monospace",
      fontSize: 12,
      lineHeight: 1.9,
      color: "#8892a4",
      whiteSpace: "pre-wrap" as const,
    }}>
      {content.split("\n").map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} style={{ height: 5 }} />;
        if (trimmed === "---") return (
          <div key={i} style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "10px 0" }} />
        );
        if (trimmed.startsWith("##")) return (
          <div key={i} style={{
            fontSize: 10, fontWeight: 700, color: "#475569",
            textTransform: "uppercase" as const, letterSpacing: "0.1em",
            marginTop: 18, marginBottom: 4, paddingBottom: 6,
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            {trimmed.replace(/^#+\s*/, "")}
          </div>
        );
        if (trimmed.startsWith("#")) return <div key={i} style={{ height: 4 }} />;
        const labelMatch = trimmed.match(/^([A-Z][A-Z /\-_]{1,24}):\s*(.*)/);
        if (labelMatch) {
          const [, label, rest] = labelMatch;
          const upper = rest.toUpperCase();
          const valColor =
            upper.startsWith("BULL") || upper.startsWith("BUY") || upper.startsWith("STRONG BUY")
              ? "#4ade80"
              : upper.startsWith("BEAR") || upper.startsWith("SELL") || upper.startsWith("AVOID")
              ? "#f87171"
              : "#cbd5e1";
          return (
            <div key={i} style={{ marginBottom: 5, display: "flex", gap: 6, flexWrap: "wrap" as const }}>
              <span style={{ color: "#4a5568", flexShrink: 0, fontWeight: 600 }}>{label}:</span>
              <span style={{ color: valColor }}>{inlineHighlight(rest)}</span>
            </div>
          );
        }
        return (
          <div key={i} style={{ color: "#596172", paddingLeft: 12 }}>
            {inlineHighlight(trimmed)}
          </div>
        );
      })}
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

function TickerCard({
  t, expanded, quickRead, loadingQuick, onToggle, onFullAnalysis,
}: {
  t: WatchlistTicker;
  expanded: boolean;
  quickRead: string | null;
  loadingQuick: boolean;
  onToggle: () => void;
  onFullAnalysis: () => void;
}) {
  const glowClass = t.ribbon_state === "BULLISH" ? "glow-bull" : t.ribbon_state === "BEARISH" ? "glow-bear" : "glow-mixed";
  const rColor    = t.ribbon_state === "BULLISH" ? "#4ade80" : t.ribbon_state === "BEARISH" ? "#f87171" : "#64748b";
  const rBg       = t.ribbon_state === "BULLISH" ? "#052e16" : t.ribbon_state === "BEARISH" ? "#450a0a" : "#1e293b";
  const rBdr      = t.ribbon_state === "BULLISH" ? "#14532d" : t.ribbon_state === "BEARISH" ? "#7f1d1d" : "#334155";
  const poCapped  = Math.max(-100, Math.min(100, t.po_value ?? 0));
  const poFill    = (Math.abs(poCapped) / 100) * 50;
  const poClass   = poCapped >= 0 ? "po-bar-fill-bull" : "po-bar-fill-bear";
  const mono      = "var(--font-jetbrains-mono), monospace";

  function renderPrices(line: string): (string | React.JSX.Element)[] {
    return line.split(/(\$[\d,]+\.?\d*)/g).map((p, i) =>
      /^\$[\d,]+\.?\d*$/.test(p)
        ? <span key={i} style={{ color: "#22d3ee", fontFamily: mono }}>{p}</span>
        : p
    );
  }

  return (
    <div className={`glass-card ${glowClass}`} style={{ alignSelf: "start" }}>
      {/* ── Collapsed — always visible ── */}
      <div style={{ padding: "12px 14px", cursor: "pointer" }} onClick={onToggle}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 5 }}>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: "white", flex: 1 }}>
            {t.ticker}
          </span>
          <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: rBg, color: rColor, border: `1px solid ${rBdr}` }}>
            {t.ribbon_state}
          </span>
          {t.zero_dte_eligible && (
            <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: 9, fontWeight: 700, background: "#0c2231", color: "#22d3ee", border: "1px solid #164e63" }}>
              0DTE
            </span>
          )}
          {t.compression && <span className="compression-ring" />}
        </div>

        <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginBottom: 7 }}>
          <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>
            ${t.price?.toFixed(2) ?? "—"}
          </span>
          <span style={{ fontFamily: mono, fontSize: 11, color: (t.change_pct ?? 0) >= 0 ? "#4ade80" : "#f87171" }}>
            {t.change_pct != null ? `${t.change_pct >= 0 ? "+" : ""}${t.change_pct.toFixed(2)}%` : "—"}
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, marginBottom: 7 }}>
          <div>
            <div style={{ fontSize: 8, color: "#475569", marginBottom: 1 }}>BULL ABOVE</div>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: "#4ade80" }}>
              ${t.call_trigger?.toFixed(2) ?? "—"}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 8, color: "#475569", marginBottom: 1 }}>BEAR BELOW</div>
            <div style={{ fontFamily: mono, fontSize: 11, fontWeight: 600, color: "#f87171" }}>
              ${t.put_trigger?.toFixed(2) ?? "—"}
            </div>
          </div>
        </div>

        <div style={{ height: 3, background: "#1e293b", borderRadius: 2, position: "relative", overflow: "hidden", marginBottom: 6 }}>
          <div className={poClass} style={{
            position: "absolute", top: 0, height: "100%", borderRadius: 2,
            width: `${poFill}%`, left: poCapped >= 0 ? "50%" : `${50 - poFill}%`,
          }} />
        </div>

        <div style={{ fontSize: 10, color: "#334155", textAlign: "center" as const }}>
          {expanded ? "▲ collapse" : "⚡ Quick Read"}
        </div>
      </div>

      {/* ── Expanded panel ── */}
      <div className={`card-expand${expanded ? " open" : ""}`} onClick={(e) => e.stopPropagation()}>
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: "12px 14px" }}>
          {loadingQuick ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="shimmer-line" style={{ height: 12, width: "60%" }} />
              <div className="shimmer-line" style={{ height: 10, width: "80%" }} />
              <div className="shimmer-line" style={{ height: 10, width: "45%" }} />
              <div className="shimmer-line" style={{ height: 10, width: "70%" }} />
            </div>
          ) : quickRead ? (
            <>
              <div style={{ fontFamily: mono }}>
                {quickRead.split("\n").map((line, i) => {
                  if (!line.trim()) return <div key={i} style={{ height: 6 }} />;
                  let color = "#cbd5e1", fontSize = 12, fontWeight = 400, fontStyle = "normal", marginBottom = 1, paddingLeft = 0, marginTop = 0;
                  if (line.startsWith("BIAS:"))
                    { color = "#e2e8f0"; fontSize = 13; fontWeight = 600; marginBottom = 10; }
                  else if (line.startsWith("BULL ABOVE"))
                    { color = "#4ade80"; fontWeight = 600; }
                  else if (line.startsWith("BEAR BELOW"))
                    { color = "#f87171"; fontWeight = 600; }
                  else if (/^\s+(Entry:|T1:|T2:|Stop:)/.test(line))
                    { color = "#94a3b8"; fontSize = 11; paddingLeft = 12; }
                  else if (line.startsWith("IV NOTE:") || line.startsWith("PREMIUM:"))
                    { color = "#64748b"; fontStyle = "italic"; marginTop = 10; }
                  return (
                    <div key={i} style={{ color, fontSize, fontWeight, fontStyle, marginBottom, paddingLeft, marginTop, lineHeight: 1.8 }}>
                      {renderPrices(line)}
                    </div>
                  );
                })}
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onFullAnalysis(); }}
                style={{
                  marginTop: 12, width: "100%", padding: "8px 16px",
                  borderRadius: 8, border: "none",
                  background: "linear-gradient(135deg, #1d4ed8, #7e22ce)",
                  color: "white", fontSize: 12, fontWeight: 600,
                  cursor: "pointer", fontFamily: "var(--font-inter), sans-serif",
                }}
              >
                Full Analysis →
              </button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function WatchlistPanel({ onAnalyze }: { onAnalyze: (t: string) => void }) {
  const { getToken } = useAuth();
  const [data, setData]           = useState<WatchlistData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [err, setErr]             = useState<string | null>(null);
  const [expandedTicker, setExpandedTicker] = useState<string | null>(null);
  const [quickReads, setQuickReads]         = useState<Record<string, string>>({});
  const [loadingQuick, setLoadingQuick]     = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const r = await fetch(`${API}/watchlist`, { headers });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        setData(await r.json());
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load watchlist");
      } finally {
        setLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (t: WatchlistTicker) => {
    if (expandedTicker === t.ticker) { setExpandedTicker(null); return; }
    setExpandedTicker(t.ticker);
    if (quickReads[t.ticker]) return;
    setLoadingQuick(prev => ({ ...prev, [t.ticker]: true }));
    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const body: QuickReadResult & Record<string, unknown> = {
        ticker: t.ticker, quick_read: "",
        price: t.price ?? 0, ribbon_state: t.ribbon_state,
        compression: t.compression, po_value: t.po_value ?? 0,
        call_trigger: t.call_trigger ?? 0, put_trigger: t.put_trigger ?? 0,
        gg_open_call: t.gg_open_call ?? 0, gg_open_put: t.gg_open_put ?? 0,
        atr_14: t.atr_14 ?? 0, change_pct: t.change_pct ?? 0,
      };
      const r = await fetch(`${API}/quick-analyze`, { method: "POST", headers, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: QuickReadResult = await r.json();
      setQuickReads(prev => ({ ...prev, [t.ticker]: d.quick_read }));
    } catch (e) {
      setQuickReads(prev => ({ ...prev, [t.ticker]: "Failed to load quick read. Try again." }));
    } finally {
      setLoadingQuick(prev => ({ ...prev, [t.ticker]: false }));
    }
  };

  if (loading) {
    return (
      <div style={{ marginBottom: 32 }}>
        <div className="watchlist-grid">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="glass-card glow-mixed" style={{ padding: "12px 14px", height: 110 }}>
              <div className="skel" style={{ width: "40%", height: 12, marginBottom: 8 }} />
              <div className="skel" style={{ width: "55%", height: 10, marginBottom: 8 }} />
              <div className="skel" style={{ width: "75%", height: 8 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (err) {
    return (
      <div style={{ padding: "10px 14px", borderRadius: 8, marginBottom: 24, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 12 }}>
        Watchlist: {err}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ marginBottom: 32 }}>
      {([{ label: "Mag 7", items: data.mag7 }, { label: "Market Context", items: data.context }] as const).map(({ label, items }) => (
        <div key={label} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#64748b", textTransform: "uppercase" as const, letterSpacing: "0.08em", marginBottom: 10 }}>
            {label}
          </div>
          <div className="watchlist-grid">
            {items.map((t) => (
              <TickerCard
                key={t.ticker}
                t={t}
                expanded={expandedTicker === t.ticker}
                quickRead={quickReads[t.ticker] ?? null}
                loadingQuick={loadingQuick[t.ticker] ?? false}
                onToggle={() => handleToggle(t)}
                onFullAnalysis={() => onAnalyze(t.ticker)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
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
    <div style={{ background: "#0d1117", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden" }}>
      <div style={{
        padding: "10px 14px", background: "#080b12", borderBottom: "1px solid rgba(255,255,255,0.05)",
        fontSize: 11, fontWeight: 600, color: "#475569",
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
        background: hovered ? "rgba(255,255,255,0.04)" : "transparent",
        border: "none", borderBottom: "1px solid rgba(255,255,255,0.04)",
        cursor: "pointer", textAlign: "left" as const, gap: 8, transition: "background 0.1s",
      }}
    >
      <span style={{
        fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 13, fontWeight: 700,
        color: "#e2e8f0", minWidth: 100,
      }}>
        {row.ticker}
      </span>
      <RibbonBadge state={row.ribbon_state} />
      <span style={{ fontFamily: "var(--font-jetbrains-mono), monospace", fontSize: 12, color: "#94a3b8" }}>
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
  const { getToken } = useAuth();
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
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${API}/screener`, { headers });
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
      const token = await getToken();
      const authHeader: Record<string, string> = { "Content-Type": "application/json" };
      if (token) authHeader["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: authHeader,
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

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => { e.preventDefault(); analyze(tickerInput); };

  const md      = result?.market_data;
  const levels  = md?.atr_levels;
  const ccy     = md?.market === "IN" ? "₹" : "$";

  return (
    <div
      style={{
        height: "100dvh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#080b12",
      }}
    >
      <Header
        deskOpen={false}
        refreshing={false}
        onRefresh={() => {}}
        onClearSession={() => {}}
        marketData={null}
        activePage="analyzer"
      />

      <main
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "28px 24px 48px",
        }}
      >
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          {/* ── Search bar ── */}
          <form
            onSubmit={handleSubmit}
            style={{ display: "flex", gap: 10, marginBottom: 28 }}
          >
            <input
              value={tickerInput}
              onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
              placeholder="Enter ticker (AAPL, RELIANCE.NS...)"
              disabled={isAnalyzing}
              style={{
                flex: 1,
                padding: "12px 18px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "#0d1117",
                fontFamily: "var(--font-jetbrains-mono), monospace",
                fontSize: 15,
                color: "#e2e8f0",
                outline: "none",
              }}
            />
            <button
              type="submit"
              disabled={isAnalyzing || !tickerInput.trim()}
              style={{
                padding: "12px 28px",
                borderRadius: 10,
                whiteSpace: "nowrap",
                background: isAnalyzing ? "#94a3b8" : "#1d4ed8",
                color: "white",
                border: "none",
                cursor:
                  isAnalyzing || !tickerInput.trim()
                    ? "not-allowed"
                    : "pointer",
                fontFamily: "var(--font-inter), sans-serif",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {isAnalyzing ? "Analyzing..." : "Search"}
            </button>
          </form>

          {/* ── Error ── */}
          {error && (
            <div
              style={{
                padding: "12px 16px",
                borderRadius: 8,
                marginBottom: 20,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#dc2626",
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          {/* ── Loading skeleton ── */}
          {isAnalyzing && (
            <div
              style={{
                background: "#0d1117",
                borderRadius: 12,
                border: "1px solid rgba(255,255,255,0.06)",
                padding: "32px 24px",
                marginBottom: 32,
                textAlign: "center" as const,
              }}
            >
              <div style={{ color: "#64748b", fontSize: 14, marginBottom: 16 }}>
                Fetching data and running analysis...
              </div>
              <div
                style={{ display: "flex", gap: 8, justifyContent: "center" }}
              >
                {[0, 0.2, 0.4].map((delay, i) => (
                  <div
                    key={i}
                    className="skel"
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      animationDelay: `${delay}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* ── Analysis result card ── */}
          {result && md && (
            <div className="result-card" style={{
              borderTop: md.ribbon_state === "BULLISH"
                ? "2px solid rgba(74, 222, 128, 0.4)"
                : md.ribbon_state === "BEARISH"
                ? "2px solid rgba(248, 113, 113, 0.4)"
                : "2px solid rgba(100, 116, 139, 0.2)",
            }}>
              {/* Header */}
              <div className="result-header" style={{ padding: "24px 28px 20px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap" as const,
                  }}
                >
                  <span
                    style={{
                      fontSize: 22,
                      fontWeight: 700,
                      color: "white",
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                    }}
                  >
                    {md.ticker}
                  </span>
                  <span
                    style={{
                      fontSize: 20,
                      fontWeight: 600,
                      color: "#e2e8f0",
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                    }}
                  >
                    {ccy}
                    {fmt(md.price)}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontFamily: "var(--font-jetbrains-mono), monospace",
                      color: (md.change_pct ?? 0) >= 0 ? "#4ade80" : "#f87171",
                    }}
                  >
                    {fmtChange(md.change_pct)}
                  </span>
                  {(() => {
                    const rb = md.ribbon_state || "MIXED";
                    const rbMap: Record<string, { bg: string; color: string; border: string }> = {
                      BULLISH: { bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
                      BEARISH: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
                      MIXED:   { bg: "rgba(100,116,139,0.1)", color: "#64748b", border: "#e2e8f0" },
                    };
                    const c = rbMap[rb] ?? rbMap.MIXED;
                    return (
                      <span style={{
                        padding: "5px 14px", borderRadius: 99, fontSize: 12, fontWeight: 600,
                        letterSpacing: "0.04em", textTransform: "uppercase" as const,
                        background: c.bg, color: c.color, border: `1px solid ${c.border}`,
                        boxShadow: rb === "BULLISH"
                          ? "0 0 16px rgba(74,222,128,0.2), 0 0 4px rgba(74,222,128,0.1)"
                          : rb === "BEARISH"
                          ? "0 0 16px rgba(248,113,113,0.2), 0 0 4px rgba(248,113,113,0.1)"
                          : "none",
                      }}>
                        {rb}
                      </span>
                    );
                  })()}
                  <span
                    style={{
                      padding: "3px 10px",
                      borderRadius: 99,
                      fontSize: 11,
                      fontWeight: 600,
                      letterSpacing: "0.04em",
                      background: "rgba(29,78,216,0.15)",
                      color: "#60a5fa",
                      border: "1px solid rgba(96,165,250,0.25)",
                    }}
                  >
                    {md.market}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    flexWrap: "wrap" as const,
                  }}
                >
                  {md.price_vs_52w_high_pct != null &&
                    (() => {
                      const pct = md.price_vs_52w_high_pct!;
                      const isNearATH = pct >= -5;
                      const isValueZone = pct <= -15;
                      const bg = isNearATH
                        ? "rgba(220,38,38,0.12)"
                        : isValueZone
                          ? "rgba(21,128,61,0.12)"
                          : "rgba(255,255,255,0.05)";
                      const color = isNearATH
                        ? "#f87171"
                        : isValueZone
                          ? "#4ade80"
                          : "#64748b";
                      const border = isNearATH
                        ? "rgba(248,113,113,0.3)"
                        : isValueZone
                          ? "rgba(74,222,128,0.3)"
                          : "rgba(255,255,255,0.1)";
                      return (
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                            background: bg,
                            color,
                            border: `1px solid ${border}`,
                          }}
                        >
                          {isNearATH
                            ? `${Math.abs(pct).toFixed(1)}% from ATH ⚠`
                            : `${Math.abs(pct).toFixed(1)}% from ATH`}
                        </span>
                      );
                    })()}
                  {md.relative_volume != null &&
                    (() => {
                      const rv = md.relative_volume!;
                      const highVol = rv >= 1.5;
                      return (
                        <span
                          style={{
                            padding: "3px 10px",
                            borderRadius: 99,
                            fontSize: 11,
                            fontWeight: 600,
                            letterSpacing: "0.04em",
                            background: highVol
                              ? "rgba(21,128,61,0.12)"
                              : "rgba(255,255,255,0.05)",
                            color: highVol ? "#4ade80" : "#64748b",
                            border: `1px solid ${highVol ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`,
                          }}
                        >
                          Vol {rv.toFixed(1)}x
                        </span>
                      );
                    })()}
                </div>
              </div>

              {/* ATR levels */}
              {levels && (
                <div style={{
                  background: "#0d1117",
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  padding: "10px 24px",
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap" as const,
                  alignItems: "center",
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700, color: "#334155",
                    textTransform: "uppercase" as const, letterSpacing: "0.1em", marginRight: 4,
                  }}>
                    Levels
                  </span>
                  {([
                    { label: "GG Cmplt ▲", val: levels.gg_complete_up,  color: "#4ade80" },
                    { label: "Trigger ▲",  val: levels.trigger_up,       color: "#86efac" },
                    { label: "Trigger ▼",  val: levels.trigger_down,     color: "#fca5a5" },
                    { label: "GG Cmplt ▼", val: levels.gg_complete_down, color: "#f87171" },
                  ] as { label: string; val: number; color: string }[]).map(({ label, val, color }) => {
                    const near = md.price != null && md.atr_14 != null &&
                                 Math.abs(md.price - val) < md.atr_14 * 0.12;
                    return (
                      <div key={label} style={{
                        display: "flex", alignItems: "center", gap: 6,
                        padding: "4px 10px", borderRadius: 7,
                        background: near ? "rgba(253,224,71,0.06)" : "rgba(255,255,255,0.03)",
                        border: `1px solid ${near ? "rgba(253,224,71,0.25)" : "rgba(255,255,255,0.07)"}`,
                      }}>
                        <span style={{ fontSize: 9, color: "#475569" }}>{label}</span>
                        <span style={{
                          fontSize: 12, fontWeight: 700, color,
                          fontFamily: "var(--font-jetbrains-mono), monospace",
                        }}>
                          {ccy}{val.toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                  {md.price != null && (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "4px 10px", borderRadius: 7,
                      background: "rgba(34,211,238,0.06)",
                      border: "1px solid rgba(34,211,238,0.2)",
                    }}>
                      <span style={{ fontSize: 9, color: "#475569" }}>Now</span>
                      <span style={{
                        fontSize: 12, fontWeight: 700, color: "#22d3ee",
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                      }}>
                        {ccy}{md.price.toFixed(2)}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Analysis panels */}
              <div className="result-panels">
                <div className="result-panel" style={{ background: "#0a0e17", borderRight: "1px solid rgba(255,255,255,0.05)" }}>
                  <div className="result-panel-label">
                    <div style={{ width: 4, height: 32, borderRadius: 2, background: "#3b82f6", flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#60a5fa",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.08em",
                      }}
                    >
                      0DTE · Options Trade Plan
                    </span>
                    <span
                      className="result-panel-badge"
                      style={{
                        background: "rgba(29,78,216,0.2)",
                        color: "#60a5fa",
                        border: "1px solid rgba(96,165,250,0.2)",
                      }}
                    >
                      HAIKU
                    </span>
                  </div>
                  <MarkdownText content={result.short_term} />
                </div>
                <div className="result-panel" style={{ background: "#0b0a17" }}>
                  <div className="result-panel-label">
                    <div style={{ width: 4, height: 32, borderRadius: 2, background: "#a855f7", flexShrink: 0 }} />
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#c084fc",
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.08em",
                      }}
                    >
                      Stock Analysis · Long-Term
                    </span>
                    <span
                      className="result-panel-badge"
                      style={{
                        background: "rgba(126,34,206,0.2)",
                        color: "#c084fc",
                        border: "1px solid rgba(192,132,252,0.2)",
                      }}
                    >
                      SONNET
                    </span>
                  </div>
                  <MarkdownText content={result.long_term} />
                </div>
              </div>

              {/* Fundamentals strip */}
              <div className="result-fundamentals" style={{ padding: "16px 28px" }}>
                {([
                  { label: "PE Ratio",   value: md.pe_ratio != null ? md.pe_ratio.toFixed(1) : "—" },
                  { label: "EPS Growth", value: md.eps_growth_yoy != null ? `${md.eps_growth_yoy >= 0 ? "+" : ""}${md.eps_growth_yoy.toFixed(1)}%` : "—" },
                  { label: "Mkt Cap",    value: md.market_cap != null ? `${md.market_cap}B` : "—" },
                  { label: "Sector",     value: md.sector || "—" },
                  ...(md.market === "US" && md.iv_rank != null
                    ? [{ label: "IV Rank", value: md.iv_rank.toFixed(0) }]
                    : []),
                ] as { label: string; value: string }[]).map(({ label, value }) => (
                  <div key={label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#334155", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>{label}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#cbd5e1", fontFamily: "var(--font-jetbrains-mono), monospace" }}>{value}</span>
                  </div>
                ))}
                {md.earnings_date && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "#334155", textTransform: "uppercase" as const, letterSpacing: "0.08em" }}>Earnings</span>
                    <span style={{
                      fontSize: 12, fontWeight: 600, fontFamily: "var(--font-jetbrains-mono), monospace",
                      color: md.days_to_earnings != null && md.days_to_earnings <= 30 ? "#fbbf24" : "#cbd5e1",
                    }}>
                      {md.earnings_date}
                      {md.days_to_earnings != null && (
                        <span style={{ fontSize: 11, marginLeft: 5, color: md.days_to_earnings <= 7 ? "#f87171" : "#fbbf24" }}>
                          ({md.days_to_earnings}d)
                        </span>
                      )}
                    </span>
                  </div>
                )}
              </div>

              {/* EMA strip */}
              <div className="result-ema-strip" style={{ padding: "10px 28px" }}>
                {([
                  { label: "EMA 8",   val: md.ema_8 },
                  { label: "EMA 21",  val: md.ema_21 },
                  { label: "EMA 48",  val: md.ema_48 },
                  { label: "EMA 200", val: md.ema_200 },
                  { label: "ATR-14",  val: md.atr_14 },
                ] as { label: string; val: number | null }[]).map(({ label, val }) => (
                  <div
                    key={label}
                    style={{ display: "flex", gap: 5, alignItems: "baseline" }}
                  >
                    <span
                      style={{
                        fontSize: 10,
                        color: "#2d3748",
                        fontWeight: 600,
                        textTransform: "uppercase" as const,
                        letterSpacing: "0.06em",
                      }}
                    >
                      {label}
                    </span>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#64748b",
                        fontFamily: "var(--font-jetbrains-mono), monospace",
                      }}
                    >
                      {fmt(val)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Watchlist ── */}
          <WatchlistPanel onAnalyze={analyze} />

          {/* ── Screener section ── */}
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 14,
              }}
            >
              <h2 style={{ fontSize: 16, fontWeight: 700, color: "#e2e8f0" }}>
                {result ? "Other Setups" : "Today's Setups"}
              </h2>
              <button
                onClick={loadScreener}
                disabled={isLoadingScreener}
                style={{
                  padding: "6px 14px",
                  borderRadius: 7,
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: "var(--font-inter), sans-serif",
                  border: "1px solid #1e3a5f",
                  background: "transparent",
                  color: "#94a3b8",
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
                  <div
                    key={i}
                    style={{
                      background: "white",
                      borderRadius: 10,
                      border: "1px solid #e2e8f0",
                      padding: 16,
                    }}
                  >
                    <div
                      className="skel"
                      style={{ width: 80, height: 13, marginBottom: 14 }}
                    />
                    {[0, 1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="skel"
                        style={{ height: 36, marginBottom: 8, borderRadius: 6 }}
                      />
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
