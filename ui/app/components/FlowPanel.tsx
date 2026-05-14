"use client";
import { MarketData, UnusualFlowItem } from "../types";

interface FlowPanelProps {
  marketData: MarketData | null;
}

function RatioBadge({ ratio }: { ratio: number }) {
  const bright = ratio >= 5;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 5px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 700,
        fontFamily: "monospace",
        background: bright ? "#dcfce7" : "#f0fdf4",
        color:      bright ? "#15803d" : "#22c55e",
        border:     `1px solid ${bright ? "#86efac" : "#bbf7d0"}`,
        minWidth:   "34px",
        textAlign:  "center",
      }}
    >
      {ratio}x
    </span>
  );
}

function RatioBadgePut({ ratio }: { ratio: number }) {
  const bright = ratio >= 5;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 5px",
        borderRadius: "4px",
        fontSize: "10px",
        fontWeight: 700,
        fontFamily: "monospace",
        background: bright ? "#fee2e2" : "#fef2f2",
        color:      bright ? "#b91c1c" : "#ef4444",
        border:     `1px solid ${bright ? "#fca5a5" : "#fecaca"}`,
        minWidth:   "34px",
        textAlign:  "center",
      }}
    >
      {ratio}x
    </span>
  );
}

function FlowRow({ item }: { item: UnusualFlowItem }) {
  const isCall = item.type === "call";
  const color = isCall ? "#15803d" : "#b91c1c";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "5px 8px",
        borderRadius: "6px",
        background: isCall ? "#f0fdf4" : "#fef2f2",
        gap: "4px",
      }}
    >
      {/* Strike + type */}
      <span
        style={{
          fontSize: "11px",
          fontWeight: 700,
          color,
          fontFamily: "monospace",
          minWidth: "52px",
        }}
      >
        {item.strike}{isCall ? "C" : "P"}
      </span>

      {/* Ratio badge */}
      {isCall
        ? <RatioBadge ratio={item.vol_oi_ratio} />
        : <RatioBadgePut ratio={item.vol_oi_ratio} />
      }

      {/* Mid */}
      <span
        style={{
          fontSize: "10px",
          fontWeight: 600,
          color,
          fontFamily: "monospace",
          minWidth: "32px",
          textAlign: "right",
        }}
      >
        ${item.mid.toFixed(2)}
      </span>

      {/* Volume */}
      <span style={{ fontSize: "10px", color: "#94a3b8", fontFamily: "monospace" }}>
        v {item.volume.toLocaleString()}
      </span>
    </div>
  );
}

export default function FlowPanel({ marketData }: FlowPanelProps) {
  const flow   = marketData?.unusual_flow;
  const calls  = flow?.calls?.slice(0, 3) ?? [];
  const puts   = flow?.puts?.slice(0, 3)  ?? [];
  const hasFlow = calls.length > 0 || puts.length > 0;

  return (
    <div style={{ marginTop: "12px" }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          marginBottom: "6px",
          paddingTop: "10px",
          borderTop: "1px solid #f1f5f9",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "#94a3b8",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Flow
        </span>
        <span
          style={{
            fontSize: "9px",
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: "4px",
            background: "#f1f5f9",
            color: "#64748b",
            letterSpacing: "0.04em",
          }}
        >
          vol/OI
        </span>
      </div>

      {/* Content */}
      {!marketData ? (
        /* Skeleton */
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "5px 8px", borderRadius: "6px", background: "#f0fdf4",
              }}
            >
              <div className="skel" style={{ width: "46px" }} />
              <div className="skel" style={{ width: "30px" }} />
              <div className="skel" style={{ width: "28px" }} />
              <div className="skel" style={{ width: "40px" }} />
            </div>
          ))}
          {[1, 2, 3].map((i) => (
            <div
              key={i + 10}
              style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "5px 8px", borderRadius: "6px", background: "#fef2f2",
              }}
            >
              <div className="skel" style={{ width: "46px" }} />
              <div className="skel" style={{ width: "30px" }} />
              <div className="skel" style={{ width: "28px" }} />
              <div className="skel" style={{ width: "40px" }} />
            </div>
          ))}
        </div>
      ) : !hasFlow ? (
        <div
          style={{
            padding: "10px 8px",
            fontSize: "10px",
            color: "#94a3b8",
            textAlign: "center",
            background: "#f8fafc",
            borderRadius: "6px",
          }}
        >
          No unusual flow detected
          <div style={{ marginTop: "2px", fontSize: "9px" }}>
            (vol/OI &gt;3x, vol &gt;500, mid &gt;$1)
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {/* Calls */}
          {calls.length > 0 && (
            <>
              <div
                style={{
                  fontSize: "9px", fontWeight: 600, color: "#16a34a",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  padding: "2px 4px",
                }}
              >
                Calls
              </div>
              {calls.map((item) => (
                <FlowRow key={`c-${item.strike}`} item={item} />
              ))}
            </>
          )}

          {/* Puts */}
          {puts.length > 0 && (
            <>
              <div
                style={{
                  fontSize: "9px", fontWeight: 600, color: "#dc2626",
                  textTransform: "uppercase", letterSpacing: "0.06em",
                  padding: "2px 4px",
                  marginTop: calls.length ? "4px" : 0,
                }}
              >
                Puts
              </div>
              {puts.map((item) => (
                <FlowRow key={`p-${item.strike}`} item={item} />
              ))}
            </>
          )}

          {/* Footer */}
          <div style={{ fontSize: "9px", color: "#94a3b8", padding: "3px 4px", marginTop: "1px" }}>
            ratio = vol ÷ OI · refreshes 60s
          </div>
        </div>
      )}
    </div>
  );
}
