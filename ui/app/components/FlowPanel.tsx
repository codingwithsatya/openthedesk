"use client";
import { MarketData, UnusualFlowItem } from "../types";

interface FlowPanelProps {
  marketData: MarketData | null;
}

// Cap display at 99x so it never breaks layout
function displayRatio(ratio: number): string {
  return ratio > 99 ? "99x+" : `${ratio}x`;
}

function RatioBadge({ ratio, isCall }: { ratio: number; isCall: boolean }) {
  const bright = ratio >= 5;
  const bg     = isCall
    ? (bright ? "#dcfce7" : "#f0fdf4")
    : (bright ? "#fee2e2" : "#fef2f2");
  const color  = isCall
    ? (bright ? "#15803d" : "#22c55e")
    : (bright ? "#b91c1c" : "#ef4444");
  const border = isCall
    ? (bright ? "#86efac" : "#bbf7d0")
    : (bright ? "#fca5a5" : "#fecaca");

  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 4px",
        borderRadius: "4px",
        fontSize: "9px",
        fontWeight: 700,
        fontFamily: "monospace",
        background: bg,
        color,
        border: `1px solid ${border}`,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {displayRatio(ratio)}
    </span>
  );
}

function FlowRow({ item }: { item: UnusualFlowItem }) {
  const isCall = item.type === "call";
  const color  = isCall ? "#15803d" : "#b91c1c";

  return (
    <div
      style={{
        padding: "5px 8px",
        borderRadius: "6px",
        background: isCall ? "#f0fdf4" : "#fef2f2",
      }}
    >
      {/* Line 1: strike | badge | mid */}
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            color,
            fontFamily: "monospace",
            flexShrink: 0,
          }}
        >
          {item.strike}{isCall ? "C" : "P"}
        </span>

        <RatioBadge ratio={item.vol_oi_ratio} isCall={isCall} />

        <span
          style={{
            fontSize: "10px",
            fontWeight: 600,
            color,
            fontFamily: "monospace",
            marginLeft: "auto",
            flexShrink: 0,
          }}
        >
          ${item.mid.toFixed(2)}
        </span>
      </div>

      {/* Line 2: volume */}
      <div style={{ fontSize: "9px", color: "#94a3b8", fontFamily: "monospace", marginTop: "1px" }}>
        vol {item.volume.toLocaleString()} · OI {item.open_interest.toLocaleString()}
      </div>
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
        /* Skeleton — matches two-line row layout */
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          {([["#f0fdf4", 1], ["#f0fdf4", 2], ["#f0fdf4", 3],
             ["#fef2f2", 4], ["#fef2f2", 5], ["#fef2f2", 6]] as [string, number][]).map(([bg, i]) => (
            <div key={i} style={{ padding: "5px 8px", borderRadius: "6px", background: bg }}>
              <div style={{ display: "flex", alignItems: "center", gap: "5px", marginBottom: "4px" }}>
                <div className="skel" style={{ width: "46px" }} />
                <div className="skel" style={{ width: "26px" }} />
                <div className="skel" style={{ width: "28px", marginLeft: "auto" }} />
              </div>
              <div className="skel" style={{ width: "80px", height: "8px" }} />
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
