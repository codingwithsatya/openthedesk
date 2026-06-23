"use client";
import { useState, useEffect } from "react";

interface QuickActionsProps {
  onSend: (msg: string) => void;
  loading: boolean;
  onOpenPalette: () => void;
  deskOpen?: boolean;
  canOpenDesk?: boolean;
  briefLoading?: boolean;
}

const CLOSED_PILLS = [
  { label: "☀ Morning Brief", cmd: "MORNING BRIEF", bg: "#1e3a5f", color: "#93c5fd", border: "#2d5a8e" },
  { label: "Open the Desk",   cmd: "Open the Desk", bg: "#16a34a", color: "white",   border: "#15803d" },
] as const;

const OPEN_PILLS = [
  { label: "PTR-FAST",  cmd: "PTR-FAST",  bg: "rgba(29,78,216,0.14)",   color: "#93c5fd", border: "rgba(59,130,246,0.3)"   },
  { label: "PREMARKET", cmd: "PREMARKET", bg: "rgba(126,34,206,0.12)", color: "#d8b4fe", border: "rgba(147,51,234,0.32)" },
] as const;

export default function QuickActions({ onSend, loading, onOpenPalette, deskOpen = false, canOpenDesk = true, briefLoading = false }: QuickActionsProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const pills = (mounted && deskOpen) ? OPEN_PILLS : CLOSED_PILLS;
  return (
    <div className="quick-actions" suppressHydrationWarning>
      {pills.map((p) => {
        const isOpenDesk = p.cmd === "Open the Desk";
        const isMorningBrief = p.cmd === "MORNING BRIEF";
        const locked = isOpenDesk && !canOpenDesk;
        const briefBusy = isMorningBrief && briefLoading;
        return (
          <button
            key={p.cmd}
            className="qa-pill"
            disabled={loading || locked || briefBusy}
            title={locked ? "Market is closed" : undefined}
            onClick={() => onSend(p.cmd)}
            style={{
              background: p.bg,
              color: p.color,
              borderColor: p.border,
              opacity: (locked || briefBusy) ? 0.4 : 1,
              cursor: (loading || locked || briefBusy) ? "not-allowed" : "pointer",
            }}
          >
            {briefBusy ? "⏳ Loading..." : p.label}
          </button>
        );
      })}
      <button
        className="qa-pill"
        onClick={onOpenPalette}
        style={{ background: "rgba(255,255,255,0.05)", color: "#94a3b8", borderColor: "rgba(255,255,255,0.1)" }}
      >
        / Commands
      </button>
    </div>
  );
}
