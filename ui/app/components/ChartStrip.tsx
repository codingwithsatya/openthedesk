"use client";

const TIMEFRAMES = ["1", "3", "5", "15", "60"] as const;
type TF = (typeof TIMEFRAMES)[number];

const TF_TO_TV: Record<TF, string> = {
  "1": "1",
  "3": "3",
  "5": "5",
  "15": "15",
  "60": "60",
};

function tfLabel(tf: TF) {
  return tf === "60" ? "1H" : `${tf}m`;
}

interface ChartStripProps {
  interval?: string;
  onIntervalChange?: (tf: string) => void;
}

export default function ChartStrip({ interval = "3", onIntervalChange }: ChartStripProps) {
  const timeframe = (TIMEFRAMES.includes(interval as TF) ? interval : "3") as TF;

  const openChart = () => {
    window.open(
      `https://www.tradingview.com/chart/4sntynIK/?interval=${TF_TO_TV[timeframe]}`,
      "_blank",
    );
  };

  return (
    <div className="chart-strip">
      <span className="chart-strip-icon">📈</span>
      <span className="chart-strip-label">SPX Chart</span>

      <div className="tf-pills">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            className={`tf-pill ${timeframe === tf ? "active" : ""}`}
            onClick={() => onIntervalChange?.(tf)}
          >
            {tfLabel(tf)}
          </button>
        ))}
      </div>

      <button
        onClick={openChart}
        style={{
          marginLeft: "auto",
          padding: "4px 14px",
          borderRadius: 6,
          background: "rgba(34,211,238,0.08)",
          border: "1px solid rgba(34,211,238,0.2)",
          color: "#22d3ee",
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          fontFamily: "var(--font-jetbrains-mono), monospace",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap" as const,
        }}
      >
        Open {timeframe === "60" ? "1H" : `${timeframe}m`} Chart ↗
      </button>
    </div>
  );
}
