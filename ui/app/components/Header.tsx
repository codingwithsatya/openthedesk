"use client";
import { UserButton } from "@clerk/nextjs";
import { MarketData } from "../types";

interface HeaderProps {
  deskOpen: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onClearSession: () => void;
  marketData: MarketData | null;
}

export default function Header({
  deskOpen,
  refreshing,
  onRefresh,
  onClearSession,
  marketData,
}: HeaderProps) {
  const spxPrice = marketData
    ? (marketData.spx.last ?? marketData.spx.close ?? 0).toFixed(2)
    : null;

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
        <div className={`status-badge ${deskOpen ? "open" : "closed"}`}>
          <div className={`status-dot ${deskOpen ? "pulse" : ""}`} />
          {deskOpen ? "Desk Open" : "Desk Closed"}
        </div>
      </div>

      {/*
       * Mobile: SPX ticker — always rendered so the right side of the header
       * is never blank. Shows a shimmer skeleton until marketData arrives.
       */}
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

      <div className="header-right">
        <button className="hbtn" onClick={onRefresh} disabled={refreshing}>
          {refreshing ? "Refreshing..." : "↻ Refresh Context"}
        </button>
        <button className="hbtn" onClick={onClearSession}>
          Clear Session
        </button>
        <UserButton
          appearance={{
            elements: { avatarBox: { width: 32, height: 32, borderRadius: 8 } },
          }}
        />
      </div>
    </header>
  );
}
