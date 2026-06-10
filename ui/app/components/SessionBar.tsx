"use client";

interface SessionBarProps {
  tdNumber: string | number;
  trades: number;
  pnl: number;
  wins: number;
  losses: number;
  budgetUsed: number;
  budgetLimit: number;
}

export default function SessionBar({
  tdNumber,
  trades,
  pnl,
  wins,
  losses,
  budgetUsed: _budgetUsed,
  budgetLimit,
}: SessionBarProps) {
  const lossAmount = pnl < 0 ? Math.abs(pnl) : 0;
  const lossPercent = budgetLimit > 0 ? Math.min(100, (lossAmount / budgetLimit) * 100) : 0;

  return (
    <div
      className="session-bar"
      style={{
        height: 32,
        padding: "0 14px",
        background: "#0a0e1a",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexShrink: 0,
        fontSize: 10,
        fontFamily: "var(--font-jetbrains-mono), monospace",
        color: "#cbd5e1",
      }}
    >
      <span style={{ fontSize: 9, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        TD{tdNumber}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: "#64748b" }}>Trades</span>
        <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{trades}/3</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: "#64748b" }}>P&amp;L</span>
        <span style={{ fontWeight: 700, color: pnl >= 0 ? "#22c55e" : "#ef4444" }}>
          {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString()}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <span style={{ color: "#64748b" }}>W/L</span>
        <span style={{ fontWeight: 700, color: "#e2e8f0" }}>{wins}W · {losses}L</span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ color: "#64748b" }}>Loss limit</span>
        <div style={{ width: 72, height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
          <div style={{ width: `${lossPercent}%`, height: "100%", background: "linear-gradient(90deg, #ef4444, rgba(239,68,68,0.4))", borderRadius: 2, transition: "width 0.3s ease" }} />
        </div>
        <span style={{ color: "#64748b" }}>${budgetLimit}</span>
      </div>
    </div>
  );
}
