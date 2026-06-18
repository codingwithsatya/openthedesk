"use client";
import Link from "next/link";

const IC = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: "1.8",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  className: "ch-rail-icon",
};

export default function ChallengeIconRail() {
  return (
    <aside className="ch-icon-rail">
      <Link href="/" className="ch-rail-item">
        <svg {...IC}><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3" /></svg>
        <span className="ch-rail-label">Desk</span>
      </Link>
      <Link href="/analyzer" className="ch-rail-item">
        <svg {...IC}><path d="M3 3v18h18M7 14l4-4 3 3 5-6" /></svg>
        <span className="ch-rail-label">Analyzer</span>
      </Link>
      <Link href="/journal" className="ch-rail-item">
        <svg {...IC}><path d="M4 4h16v16H4zM4 9h16M9 4v16" /></svg>
        <span className="ch-rail-label">Journal</span>
      </Link>
      <Link href="/challenge" className="ch-rail-item active">
        <svg {...IC}><path d="M3 18l6-7 4 4 8-9M21 6h-4m4 0v4" /></svg>
        <span className="ch-rail-label">Challenge</span>
      </Link>
      <div className="ch-rail-item" style={{ cursor: "default", opacity: 0.4 }}>
        <svg {...IC}><path d="M4 19h16M4 19V9l5-3 5 3 5-3v10" /></svg>
        <span className="ch-rail-label">Playbook</span>
      </div>
      <div className="ch-rail-item" style={{ cursor: "default", opacity: 0.4 }}>
        <svg {...IC}><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" /></svg>
        <span className="ch-rail-label">Alerts</span>
      </div>
      <div className="ch-rail-item" style={{ cursor: "default", opacity: 0.4 }}>
        <svg {...IC}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 005 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
        </svg>
        <span className="ch-rail-label">Settings</span>
      </div>
      <div className="ch-rail-spacer" />
      <div className="ch-rail-collapse">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="17" height="17" strokeLinecap="round" strokeLinejoin="round">
          <path d="M11 19l-7-7 7-7M21 19l-7-7 7-7" />
        </svg>
        Collapse
      </div>
    </aside>
  );
}
