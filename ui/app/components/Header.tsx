"use client";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { MarketData } from "../types";

interface HeaderProps {
  deskOpen: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onClearSession: () => void;
  marketData: MarketData | null;
  activePage?: "desk" | "analyzer";
}

export default function Header({
  deskOpen,
  refreshing,
  onRefresh,
  onClearSession,
  marketData,
  activePage = "desk",
}: HeaderProps) {
  const spxPrice = marketData
    ? (marketData.spx.last ?? marketData.spx.close ?? 0).toFixed(2)
    : null;

  const navLink = (href: string, label: string, active: boolean) => (
    <Link
      href={href}
      style={{
        padding: "5px 12px", borderRadius: 7, fontSize: 12, fontWeight: 600,
        fontFamily: "var(--font-inter), sans-serif", textDecoration: "none",
        background: active ? "#1e3a5f" : "transparent",
        color: active ? "white" : "#64748b",
        border: `1px solid ${active ? "#2d5a8e" : "transparent"}`,
        transition: "all 0.15s",
      }}
    >
      {label}
    </Link>
  );

  return (
    <header className="header">
      <div className="header-left">
        <div className="logo-wrap">
          <img
            src="/logo.png"
            alt="OpenTheDesk"
            style={{ height: "52px", width: "auto", objectFit: "contain" }}
          />
        </div>
        <div className="divider-v" />
        {activePage === "desk" && (
          <div className={`status-badge ${deskOpen ? "open" : "closed"}`}>
            <div className={`status-dot ${deskOpen ? "pulse" : ""}`} />
            {deskOpen ? "Desk Open" : "Desk Closed"}
          </div>
        )}
        <div style={{ display: "flex", gap: 2, marginLeft: activePage === "desk" ? 8 : 0 }}>
          {navLink("/", "Desk", activePage === "desk")}
          {navLink("/analyzer", "Analyzer", activePage === "analyzer")}
        </div>
      </div>

      {/*
       * Mobile SPX ticker — desk page only. Hidden on analyzer page to avoid
       * showing stale/null data.
       */}
      {activePage === "desk" && (
        <div className="header-spx">
          {spxPrice ? (
            <>
              <div className="header-spx-price">{spxPrice}</div>
              <div className="header-spx-meta">
                VIX {marketData!.vix.vix} · PDC {marketData!.atr_levels.PDC.toFixed(0)} · ATR ~{marketData!.atr_levels.ATR.toFixed(1)}
              </div>
            </>
          ) : (
            <>
              <div className="skel" style={{ width: "72px", height: "18px", borderRadius: "6px" }} />
              <div className="skel" style={{ width: "120px", height: "10px", borderRadius: "4px", marginTop: "4px" }} />
            </>
          )}
        </div>
      )}

      <div className="header-right">
        {activePage === "desk" && (
          <>
            <button className="hbtn" onClick={onRefresh} disabled={refreshing}>
              {refreshing ? "Refreshing..." : "↻ Refresh Context"}
            </button>
            <button className="hbtn" onClick={onClearSession}>
              Clear Session
            </button>
          </>
        )}
        <UserButton
          appearance={{
            elements: { avatarBox: { width: 32, height: 32, borderRadius: 8 } },
          }}
        />
      </div>
    </header>
  );
}
