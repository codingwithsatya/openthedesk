"use client";

interface QuickActionsProps {
  onSend: (msg: string) => void;
  loading: boolean;
  onOpenPalette: () => void;
}

const PILLS = [
  { label: "Open the Desk", cmd: "Open the Desk", bg: "#16a34a", color: "white",   border: "#15803d"  },
  { label: "PTR-FAST",      cmd: "PTR-FAST",      bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe"  },
  { label: "PREMARKET",     cmd: "PREMARKET",      bg: "#faf5ff", color: "#7e22ce", border: "#e9d5ff"  },
] as const;

export default function QuickActions({ onSend, loading, onOpenPalette }: QuickActionsProps) {
  return (
    <div className="quick-actions">
      {PILLS.map((p) => (
        <button
          key={p.cmd}
          className="qa-pill"
          disabled={loading}
          onClick={() => onSend(p.cmd)}
          style={{ background: p.bg, color: p.color, borderColor: p.border }}
        >
          {p.label}
        </button>
      ))}
      <button
        className="qa-pill"
        onClick={onOpenPalette}
        style={{ background: "#f8fafc", color: "#475569", borderColor: "#e2e8f0" }}
      >
        / Commands
      </button>
    </div>
  );
}
