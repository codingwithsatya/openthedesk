"use client";
import { MarketData } from "../types";

interface LevelsPanelProps {
  marketData: MarketData | null;
  satyAtr: string;
  atrApplied: boolean;
  onAtrChange: (val: string) => void;
  onApply: (val: number) => void;
  onReset: () => void;
}

const ATR_LEVELS = (d: MarketData["atr_levels"]) => [
  { label: "Full ATR ↑",    value: d.full_atr_call,    color: "#064e3b", bg: "#ecfdf5" },
  { label: "GG Complete ↑", value: d.gg_complete_call, color: "#15803d", bg: "#f0fdf4" },
  { label: "50% ↑",         value: d.gg_50_call,       color: "#16a34a", bg: "#f0fdf4" },
  { label: "GG Open ↑",     value: d.gg_open_call,     color: "#22c55e", bg: "#f0fdf4" },
  { label: "Call Trigger",  value: d.call_trigger,     color: "#4ade80", bg: "#f0fdf4" },
  { label: "── PDC ──",     value: d.PDC,              color: "#0f172a", bg: "#f1f5f9", bold: true },
  { label: "Put Trigger",   value: d.put_trigger,      color: "#f87171", bg: "#fef2f2" },
  { label: "GG Open ↓",     value: d.gg_open_put,      color: "#dc2626", bg: "#fef2f2" },
  { label: "50% ↓",         value: d.gg_50_put,        color: "#b91c1c", bg: "#fef2f2" },
  { label: "GG Complete ↓", value: d.gg_complete_put,  color: "#991b1b", bg: "#fef2f2" },
  { label: "Full ATR ↓",    value: d.full_atr_put,     color: "#7f1d1d", bg: "#fff1f2" },
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
  const bestPut  = opts?.best_put  ?? null;
  const allCalls = opts?.chain?.calls ?? [];
  const allPuts  = opts?.chain?.puts  ?? [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {!marketData ? (
        /* ── Skeleton ── */
        <>
          <div className="skel-block" style={{ marginBottom: "4px" }}>
            <div className="skel" style={{ width: "28px", marginBottom: "6px" }} />
            <div className="skel" style={{ width: "80px", height: "16px", marginBottom: "6px" }} />
            <div className="skel" style={{ width: "110px" }} />
          </div>
          <div className="skel-block" style={{ background: "#fffbeb", border: "1px solid #fde68a", marginBottom: "4px" }}>
            <div className="skel" style={{ width: "100px", marginBottom: "8px" }} />
            <div className="skel" style={{ width: "100%", height: "26px" }} />
          </div>
          {[80,70,60,90,75,95,72,65,55,80,68].map((w, i) => (
            <div
              key={i}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "5px 8px", borderRadius: "6px",
                background: i < 5 ? "#f0fdf4" : i === 5 ? "#f1f5f9" : "#fef2f2",
              }}
            >
              <div className="skel" style={{ width: `${w * 0.45}%` }} />
              <div className="skel" style={{ width: "38px" }} />
            </div>
          ))}
          <div className="skel" style={{ width: "70px", marginTop: "2px" }} />
        </>
      ) : (
        /* ── Real data ── */
        <>
          {/* SPX + VIX */}
          <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "8px 10px", marginBottom: "4px" }}>
            <div style={{ fontSize: "10px", color: "#64748b" }}>SPX</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              {(marketData.spx.last ?? marketData.spx.close ?? 0).toFixed(2)}
            </div>
            <div style={{ fontSize: "10px", color: "#64748b", marginTop: "2px" }}>
              VIX {marketData.vix.vix} &nbsp;·&nbsp; PDC {marketData.atr_levels.PDC.toFixed(0)}
            </div>
          </div>

          {/* Saty ATR input */}
          <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "8px 10px", marginBottom: "4px" }}>
            <div style={{ fontSize: "10px", color: "#92400e", fontWeight: 600, marginBottom: "5px" }}>
              Saty ATR {atrApplied ? "✓ override" : "(auto-calculated)"}
            </div>
            <div style={{ display: "flex", gap: "5px" }}>
              <input
                type="number"
                value={satyAtr}
                onChange={(e) => onAtrChange(e.target.value)}
                placeholder={`auto: ${marketData.atr_levels.ATR.toFixed(2)}`}
                style={{
                  flex: 1, padding: "5px 7px", borderRadius: "5px",
                  border: "1px solid #fcd34d", fontSize: "12px",
                  fontFamily: "monospace", background: "white", outline: "none", width: "0",
                }}
              />
              <button
                onClick={() => {
                  const val = parseFloat(satyAtr);
                  if (!isNaN(val) && val > 0) onApply(val);
                }}
                style={{
                  padding: "5px 8px", borderRadius: "5px", border: "none",
                  background: "#d97706", color: "white", fontSize: "11px",
                  fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap",
                }}
              >
                Apply
              </button>
              {atrApplied && (
                <button
                  onClick={onReset}
                  title="Reset to auto-calculated ATR"
                  style={{
                    padding: "5px 7px", borderRadius: "5px",
                    border: "1px solid #fcd34d", background: "white",
                    color: "#92400e", fontSize: "12px", cursor: "pointer", lineHeight: 1,
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
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "5px 8px", borderRadius: "6px", background: level.bg,
              }}
            >
              <span style={{ fontSize: "10px", color: level.color, fontWeight: level.bold ? 700 : 500 }}>
                {level.label}
              </span>
              <span style={{ fontSize: "11px", fontWeight: 700, color: level.color, fontFamily: "monospace" }}>
                {level.value.toFixed(2)}
              </span>
            </div>
          ))}

          {/* ATR value footer */}
          <div style={{ padding: "4px 8px", background: "#f8fafc", borderRadius: "6px", marginTop: "2px" }}>
            <span style={{ fontSize: "10px", color: "#94a3b8" }}>
              ATR ~{marketData.atr_levels.ATR.toFixed(1)} pts
            </span>
          </div>

          {/* Live 0DTE Options */}
          {opts && (
            <>
              <div style={{
                marginTop: "10px", marginBottom: "4px",
                fontSize: "10px", fontWeight: 600, color: "#94a3b8",
                textTransform: "uppercase", letterSpacing: "0.08em",
                borderTop: "1px solid #f1f5f9", paddingTop: "10px",
              }}>
                0DTE Options · {opts.expiry}
              </div>

              {/* Best Call */}
              {bestCall ? (
                <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "8px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#15803d", fontFamily: "monospace" }}>
                      {bestCall.strike}C
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#15803d" }}>
                      ${bestCall.mid?.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "10px", color: "#16a34a", fontFamily: "monospace" }}>
                      d={bestCall.delta?.toFixed(2) ?? "—"}
                    </span>
                    <span style={{ fontSize: "10px", color: "#16a34a", fontFamily: "monospace" }}>
                      IV {bestCall.iv ? (bestCall.iv * 100).toFixed(1) + "%" : "—"}
                    </span>
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                      v {(bestCall.volume ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "3px", fontFamily: "monospace" }}>
                    {bestCall.bid} / {bestCall.ask}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "10px", color: "#94a3b8", padding: "6px 8px", background: "#f8fafc", borderRadius: "6px" }}>
                  No calls near target
                </div>
              )}

              {/* Best Put */}
              {bestPut ? (
                <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "8px 10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "#b91c1c", fontFamily: "monospace" }}>
                      {bestPut.strike}P
                    </span>
                    <span style={{ fontSize: "13px", fontWeight: 700, color: "#b91c1c" }}>
                      ${bestPut.mid?.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "10px", color: "#b91c1c", fontFamily: "monospace" }}>
                      d={bestPut.delta?.toFixed(2) ?? "—"}
                    </span>
                    <span style={{ fontSize: "10px", color: "#b91c1c", fontFamily: "monospace" }}>
                      IV {bestPut.iv ? (bestPut.iv * 100).toFixed(1) + "%" : "—"}
                    </span>
                    <span style={{ fontSize: "10px", color: "#94a3b8" }}>
                      v {(bestPut.volume ?? 0).toLocaleString()}
                    </span>
                  </div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", marginTop: "3px", fontFamily: "monospace" }}>
                    {bestPut.bid} / {bestPut.ask}
                  </div>
                </div>
              ) : (
                <div style={{ fontSize: "10px", color: "#94a3b8", padding: "6px 8px", background: "#f8fafc", borderRadius: "6px" }}>
                  No puts near target
                </div>
              )}

              <div style={{ fontSize: "10px", color: "#94a3b8", textAlign: "center", marginTop: "2px" }}>
                {allCalls.length}C · {allPuts.length}P in budget · refreshes 60s
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
