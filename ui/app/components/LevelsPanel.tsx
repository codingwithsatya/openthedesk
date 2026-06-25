"use client";
import { MarketData } from "../types";
import InternalsWidget from "./InternalsWidget";

interface LevelsPanelProps {
  marketData: MarketData | null;
  satyAtr: string;
  atrApplied: boolean;
  onAtrChange: (val: string) => void;
  onApply: (val: number) => void;
  onReset: () => void;
}

const ATR_LEVELS = (d: MarketData["atr_levels"]) => [
  {
    label: "Full ATR ↑",
    value: d.full_atr_call,
    textColor: "#22c55e",
    bg: "rgba(34,197,94,0.05)",
    bold: false,
  },
  {
    label: "GG Complete ↑",
    value: d.gg_complete_call,
    textColor: "#22c55e",
    bg: "rgba(34,197,94,0.05)",
    bold: false,
  },
  {
    label: "50% ↑",
    value: d.gg_50_call,
    textColor: "#22c55e",
    bg: "rgba(34,197,94,0.04)",
    bold: false,
  },
  {
    label: "GG Open ↑",
    value: d.gg_open_call,
    textColor: "#16a34a",
    bg: "rgba(34,197,94,0.04)",
    bold: false,
  },
  {
    label: "Call Trigger",
    value: d.call_trigger,
    textColor: "#4ade80",
    bg: "rgba(34,197,94,0.11)",
    bold: true,
  },
  {
    label: "── PDC ──",
    value: d.PDC,
    textColor: "#64748b",
    bg: "rgba(255,255,255,0.04)",
    bold: true,
  },
  {
    label: "Put Trigger",
    value: d.put_trigger,
    textColor: "#f87171",
    bg: "rgba(239,68,68,0.11)",
    bold: true,
  },
  {
    label: "GG Open ↓",
    value: d.gg_open_put,
    textColor: "#ef4444",
    bg: "rgba(239,68,68,0.04)",
    bold: false,
  },
  {
    label: "50% ↓",
    value: d.gg_50_put,
    textColor: "#ef4444",
    bg: "rgba(239,68,68,0.04)",
    bold: false,
  },
  {
    label: "GG Complete ↓",
    value: d.gg_complete_put,
    textColor: "#dc2626",
    bg: "rgba(239,68,68,0.04)",
    bold: false,
  },
  {
    label: "Full ATR ↓",
    value: d.full_atr_put,
    textColor: "#dc2626",
    bg: "rgba(239,68,68,0.05)",
    bold: false,
  },
];

export default function LevelsPanel({
  marketData,
  satyAtr,
  atrApplied,
  onAtrChange,
  onApply,
  onReset,
}: LevelsPanelProps) {
  const opts = marketData?.options;
  const bestCall = opts?.best_call ?? null;
  const bestPut = opts?.best_put ?? null;
  const allCalls = opts?.chain?.calls ?? [];
  const allPuts = opts?.chain?.puts ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <InternalsWidget />
      {!marketData ? (
        /* ── Skeleton ── */
        <>
          <div className="skel-block" style={{ marginBottom: "4px" }}>
            <div
              className="skel"
              style={{ width: "28px", marginBottom: "6px" }}
            />
            <div
              className="skel"
              style={{ width: "80px", height: "18px", marginBottom: "6px" }}
            />
            <div className="skel" style={{ width: "110px" }} />
          </div>
          <div className="skel-block" style={{ marginBottom: "4px" }}>
            <div
              className="skel"
              style={{ width: "100px", marginBottom: "8px" }}
            />
            <div className="skel" style={{ width: "100%", height: "28px" }} />
          </div>
          {[80, 70, 60, 90, 75, 95, 72, 65, 55, 80, 68].map((w, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "6px 10px",
                borderRadius: "6px",
                background:
                  i < 5
                    ? "rgba(34,197,94,0.05)"
                    : i === 5
                      ? "rgba(255,255,255,0.03)"
                      : "rgba(239,68,68,0.05)",
              }}
            >
              <div className="skel" style={{ width: `${w * 0.45}%` }} />
              <div className="skel" style={{ width: "42px" }} />
            </div>
          ))}
        </>
      ) : (
        /* ── Real data ── */
        <>
          {/* SPX + VIX card */}
          <div
            style={{
              background: "#0d1220",
              borderRadius: "10px",
              padding: "11px 13px",
              marginBottom: "2px",
              border: "1px solid rgba(59,130,246,0.18)",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                color: "#475569",
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                marginBottom: "5px",
              }}
            >
              S&amp;P 500
            </div>
            <div
              style={{
                fontSize: "24px",
                fontWeight: 800,
                color: "#f1f5f9",
                letterSpacing: "-0.5px",
                fontFamily: "var(--font-jetbrains-mono), monospace",
                lineHeight: 1,
              }}
            >
              {(marketData.spx.last ?? marketData.spx.close ?? 0).toFixed(2)}
            </div>
            <div style={{ display: "flex", gap: "10px", marginTop: "7px" }}>
              <span style={{ fontSize: "12px", color: "#475569" }}>
                VIX&nbsp;
                <span
                  style={{
                    color: "#94a3b8",
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  {marketData.vix.vix}
                </span>
              </span>
              <span style={{ fontSize: "12px", color: "#334155" }}>·</span>
              <span style={{ fontSize: "12px", color: "#475569" }}>
                PDC&nbsp;
                <span
                  style={{
                    color: "#94a3b8",
                    fontFamily: "monospace",
                    fontWeight: 600,
                  }}
                >
                  {marketData.atr_levels.PDC.toFixed(0)}
                </span>
              </span>
            </div>
          </div>

          {/* Saty ATR input */}
          <div
            style={{
              background: "#0c1018",
              border: "1px solid rgba(217,119,6,0.28)",
              borderRadius: "9px",
              padding: "9px 11px",
              marginBottom: "2px",
            }}
          >
            <div
              style={{
                fontSize: "10px",
                color: "#d97706",
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                marginBottom: "7px",
              }}
            >
              Saty ATR&nbsp;
              {atrApplied ? (
                <span style={{ color: "#4ade80" }}>✓ applied</span>
              ) : (
                "(auto)"
              )}
            </div>
            <div style={{ display: "flex", gap: "5px" }}>
              <input
                type="number"
                value={satyAtr}
                onChange={(e) => onAtrChange(e.target.value)}
                placeholder={`auto: ${marketData.atr_levels.ATR.toFixed(2)}`}
                style={{
                  flex: 1,
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid rgba(217,119,6,0.25)",
                  fontSize: "13px",
                  fontFamily: "monospace",
                  background: "#070b12",
                  color: "#e2e8f0",
                  outline: "none",
                  width: "0",
                }}
              />
              <button
                onClick={() => {
                  const val = parseFloat(satyAtr);
                  if (!isNaN(val) && val > 0) onApply(val);
                }}
                style={{
                  padding: "6px 10px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#d97706",
                  color: "white",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Apply
              </button>
              {atrApplied && (
                <button
                  onClick={onReset}
                  title="Reset to auto-calculated ATR"
                  style={{
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid rgba(217,119,6,0.25)",
                    background: "transparent",
                    color: "#d97706",
                    fontSize: "13px",
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  ↺
                </button>
              )}
            </div>
          </div>

          {/* 11 ATR levels */}
          {ATR_LEVELS(marketData.atr_levels).map((level, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: level.bold ? "8px 10px" : "6px 10px",
                borderRadius: "7px",
                background: level.bg,
                borderLeft: level.bold
                  ? `2px solid ${level.textColor}`
                  : "2px solid transparent",
              }}
            >
              <span
                style={{
                  fontSize: "12px",
                  color: level.bold ? level.textColor : `${level.textColor}cc`,
                  fontWeight: level.bold ? 700 : 500,
                  fontFamily: "var(--font-inter), sans-serif",
                }}
              >
                {level.label}
              </span>
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 700,
                  color: level.textColor,
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                }}
              >
                {level.value.toFixed(2)}
              </span>
            </div>
          ))}

          {/* ATR value footer */}
          <div
            style={{
              padding: "5px 10px",
              background: "rgba(255,255,255,0.03)",
              borderRadius: "7px",
              marginTop: "1px",
              border: "1px solid rgba(255,255,255,0.04)",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                color: "#475569",
                fontFamily: "monospace",
              }}
            >
              ATR ~{marketData.atr_levels.ATR.toFixed(1)} pts
            </span>
          </div>

          {/* Live 0DTE Options */}
          {opts && (
            <>
              <div
                style={{
                  marginTop: "8px",
                  marginBottom: "4px",
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#475569",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  borderTop: "1px solid rgba(255,255,255,0.05)",
                  paddingTop: "10px",
                }}
              >
                0DTE Options · {opts.expiry}
              </div>

              {/* Best Call */}
              {bestCall ? (
                <div
                  style={{
                    background: "rgba(34,197,94,0.06)",
                    border: "1px solid rgba(34,197,94,0.2)",
                    borderRadius: "9px",
                    padding: "9px 11px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "5px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#4ade80",
                        fontFamily: "monospace",
                      }}
                    >
                      {bestCall.strike}C
                    </span>
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        color: "#4ade80",
                        fontFamily: "monospace",
                      }}
                    >
                      ${bestCall.mid?.toFixed(2)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginBottom: "3px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#22c55e",
                        fontFamily: "monospace",
                      }}
                    >
                      δ {bestCall.delta?.toFixed(2) ?? "—"}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#22c55e",
                        fontFamily: "monospace",
                      }}
                    >
                      IV{" "}
                      {bestCall.iv ? (bestCall.iv * 100).toFixed(1) + "%" : "—"}
                    </span>
                    <span style={{ fontSize: "10px", color: "#475569" }}>
                      v {(bestCall.volume ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#475569",
                      fontFamily: "monospace",
                    }}
                  >
                    {bestCall.bid} / {bestCall.ask}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "10px",
                    color: "#475569",
                    padding: "7px 10px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "7px",
                  }}
                >
                  No calls near target
                </div>
              )}

              {/* Best Put */}
              {bestPut ? (
                <div
                  style={{
                    background: "rgba(239,68,68,0.06)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: "9px",
                    padding: "9px 11px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "5px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        color: "#f87171",
                        fontFamily: "monospace",
                      }}
                    >
                      {bestPut.strike}P
                    </span>
                    <span
                      style={{
                        fontSize: "15px",
                        fontWeight: 800,
                        color: "#f87171",
                        fontFamily: "monospace",
                      }}
                    >
                      ${bestPut.mid?.toFixed(2)}
                    </span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginBottom: "3px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#ef4444",
                        fontFamily: "monospace",
                      }}
                    >
                      δ {bestPut.delta?.toFixed(2) ?? "—"}
                    </span>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "#ef4444",
                        fontFamily: "monospace",
                      }}
                    >
                      IV{" "}
                      {bestPut.iv ? (bestPut.iv * 100).toFixed(1) + "%" : "—"}
                    </span>
                    <span style={{ fontSize: "10px", color: "#475569" }}>
                      v {(bestPut.volume ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "#475569",
                      fontFamily: "monospace",
                    }}
                  >
                    {bestPut.bid} / {bestPut.ask}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "10px",
                    color: "#475569",
                    padding: "7px 10px",
                    background: "rgba(255,255,255,0.03)",
                    borderRadius: "7px",
                  }}
                >
                  No puts near target
                </div>
              )}

              <div
                style={{
                  fontSize: "10px",
                  color: "#334155",
                  textAlign: "center",
                  marginTop: "2px",
                }}
              >
                {allCalls.length}C · {allPuts.length}P in budget · refreshes 60s
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
