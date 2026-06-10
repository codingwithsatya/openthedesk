"use client";

interface MorningBriefBannerProps {
  visible: boolean;
  bias: string;
  mag7Bull: number;
  mag7Bear: number;
  mag7Mixed: number;
  warning: string;
  bullLevel: number | null;
  bearLevel: number | null;
  onExpand: () => void;
}

export default function MorningBriefBanner({
  visible,
  bias,
  mag7Bull,
  mag7Bear,
  mag7Mixed,
  warning,
  bullLevel,
  bearLevel,
  onExpand,
}: MorningBriefBannerProps) {
  if (!visible) return null;

  const biasUpper = bias.toUpperCase();
  const isBull = biasUpper.includes("BULL") && !biasUpper.includes("BEAR");
  const isBear = biasUpper.includes("BEAR");

  return (
    <div className="brief-banner">
      <div className="brief-tag">📊 Morning Brief</div>

      <div
        className="brief-bias-badge"
        style={
          isBull
            ? { background: "var(--bull-dim)", borderColor: "rgba(34,197,94,0.25)", color: "var(--bull)" }
            : isBear
            ? { background: "var(--bear-dim)", borderColor: "rgba(239,68,68,0.25)", color: "var(--bear)" }
            : { background: "rgba(255,255,255,0.05)", borderColor: "var(--border-mid)", color: "var(--text-mid)" }
        }
      >
        {bias || "—"}
      </div>

      <div className="brief-mag7">
        <span className="mag7-bull">{mag7Bull} BULL</span>
        <span className="mag7-sep">·</span>
        <span className="mag7-bear">{mag7Bear} BEAR</span>
        <span className="mag7-sep">·</span>
        <span className="mag7-mixed">{mag7Mixed} MIXED</span>
      </div>

      {warning && <div className="brief-warning-pill">⚠ {warning}</div>}

      <div className="brief-levels-strip">
        {bullLevel != null && <span>Bull ▲ <strong>{bullLevel.toFixed(0)}</strong></span>}
        {bearLevel != null && <span>Bear ▼ <strong>{bearLevel.toFixed(0)}</strong></span>}
      </div>

      <button className="brief-expand-btn" onClick={onExpand}>
        Full Brief ↗
      </button>
    </div>
  );
}
