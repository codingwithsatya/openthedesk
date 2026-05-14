"use client";
import { useEffect } from "react";
import LevelsPanel from "./LevelsPanel";
import { MarketData } from "../types";

interface MobileSheetProps {
  open: boolean;
  onClose: () => void;
  marketData: MarketData | null;
  satyAtr: string;
  atrApplied: boolean;
  onAtrChange: (val: string) => void;
  onApply: (val: number) => void;
  onReset: () => void;
}

export default function MobileSheet({
  open,
  onClose,
  marketData,
  satyAtr,
  atrApplied,
  onAtrChange,
  onApply,
  onReset,
}: MobileSheetProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <div className={`sheet-overlay ${open ? "open" : ""}`} onClick={onClose} />
      <div className={`sheet-panel ${open ? "open" : ""}`}>
        <div className="sheet-handle" />
        <div className="sheet-title">Today&apos;s Levels</div>
        <div className="sheet-body">
          <LevelsPanel
            marketData={marketData}
            satyAtr={satyAtr}
            atrApplied={atrApplied}
            onAtrChange={onAtrChange}
            onApply={onApply}
            onReset={onReset}
          />
        </div>
      </div>
    </>
  );
}
