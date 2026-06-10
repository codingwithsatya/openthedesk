"use client";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { TVAlert } from "./AlertPanel";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const GRADES = ["A+", "A", "B", "C"] as const;
type Grade = (typeof GRADES)[number];
type CardState = "idle" | "form" | "submitting" | "logged" | "skipped";

interface SignalStreamProps {
  alerts: TVAlert[];
  isUnread: (a: TVAlert) => boolean;
  markRead: (id: string) => void;
}

function formatRelative(ts: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function SignalCard({
  alert,
  isLogged,
  isSkipped,
  getToken,
  onLogged,
  onSkipped,
}: {
  alert: TVAlert;
  isLogged: boolean;
  isSkipped: boolean;
  getToken: () => Promise<string | null>;
  onLogged: (id: string, pnl: number) => void;
  onSkipped: (id: string) => void;
}) {
  const [cardState, setCardState] = useState<CardState>(
    isLogged ? "logged" : isSkipped ? "skipped" : "idle",
  );
  const [entryPremium, setEntryPremium] = useState("");
  const [submitError, setSubmitError] = useState("");

  const dir = (alert.direction ?? "").toUpperCase();
  const sig = (alert.signal ?? "").toUpperCase();
  const setup = (alert.setup ?? "").toUpperCase();
  const isEntry = sig === "ENTRY";
  const tp = alert.trade_plan;
  const internals = alert.internals;

  const cardClass = dir === "BEAR" || setup === "STOP"
    ? "sc sc-bear"
    : dir === "BULL"
    ? "sc sc-bull"
    : sig === "EXIT" || sig === "TRAIL"
    ? "sc sc-update"
    : sig === "STOP"
    ? "sc sc-stop"
    : "sc sc-update";

  const setupClass = dir === "BEAR"
    ? "sc-setup sc-setup-bear"
    : dir === "BULL"
    ? "sc-setup sc-setup-bull"
    : sig === "EXIT" || sig === "TRAIL" || sig === "TARGET"
    ? "sc-setup sc-setup-update"
    : "sc-setup sc-setup-neutral";

  const handleSubmit = async () => {
    if (cardState === "submitting" || cardState === "logged") return;
    setCardState("submitting");
    setSubmitError("");
    try {
      const token = await getToken();
      const premium = parseFloat(entryPremium);
      if (!premium || premium <= 0) {
        setSubmitError("Enter premium paid");
        setCardState("form");
        return;
      }

      const res = await fetch(`${API}/journal/entry`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          date: new Date().toISOString().split("T")[0],
          ticker: alert.ticker || "SPX",
          setup: alert.setup || "GG",
          direction: (alert.direction ?? "").toUpperCase() || "BULL",
          entry_price: tp?.entry ?? parseFloat(alert.price),
          entry_premium: premium,
          contracts: 1,
          status: "open",
          notes: `Signal: ${alert.signal || ""} · ATR Level: ${alert.atr_level || ""} · T1: ${tp?.t1 ?? ""} · T2: ${tp?.t2 ?? ""} · SL: ${tp?.sl ?? ""}`.trim(),
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      setCardState("logged");
      onLogged(alert.id || `${alert.ts}-${alert.price}-${alert.signal}`, 0);
    } catch {
      setSubmitError("Failed — try chat journal");
      setCardState("form");
    }
  };

  if (cardState === "logged") return (
    <div style={{ color: "#00c896", fontSize: 12, padding: "6px 0", fontFamily: "var(--mono)" }}>
      ✓ Open Trade
    </div>
  );

  if (cardState === "skipped") {
    return (
      <div className={cardClass} style={{ opacity: 0.3 }}>
        <div className="sc-top">
          <div className="sc-pills">
            <span className={setupClass}>{setup || sig} {dir}</span>
            {alert.grade && <span className="sc-grade">{alert.grade}</span>}
          </div>
          <span className="sc-time">{formatRelative(alert.ts)}</span>
        </div>
        <div className="sc-skipped">— Skipped</div>
      </div>
    );
  }

  return (
    <div className={cardClass}>
      {/* Top row */}
      <div className="sc-top">
        <div className="sc-pills">
          <span className={setupClass}>{setup || sig} {dir}</span>
          {alert.grade && <span className="sc-grade">{alert.grade}</span>}
          {sig && sig !== "ENTRY" && (
            <span className="sc-grade" style={{ color: "var(--cyan)" }}>{sig}</span>
          )}
        </div>
        <span className="sc-time">{formatRelative(alert.ts)}</span>
      </div>

      {/* Price */}
      <div className="sc-price-row">
        <span className="sc-price">
          {Number(alert.price).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </span>
        <span className="sc-ticker">{alert.ticker}</span>
      </div>

      {/* Trade plan levels */}
      {tp && (
        <div className="sc-levels">
          <div className="sc-lv">
            <span className="sc-lk">T1</span>
            <span className="sc-lv-bull">{tp.t1?.toFixed(1) ?? "—"}</span>
          </div>
          <div className="sc-lv">
            <span className="sc-lk">T2</span>
            <span className="sc-lv-bull">{tp.t2?.toFixed(1) ?? "—"}</span>
          </div>
          <div className="sc-lv">
            <span className="sc-lk">T3</span>
            <span className="sc-lv-orange">{tp.t3?.toFixed(1) ?? "—"}</span>
          </div>
          <div className="sc-lv">
            <span className="sc-lk">SL</span>
            <span className="sc-lv-bear">{tp.sl?.toFixed(1) ?? "—"}</span>
          </div>
        </div>
      )}

      {/* Internals */}
      {(internals?.trin != null || internals?.add != null) && (
        <div className="sc-ints">
          {internals.trin != null && (
            <span className={`sc-int ${internals.trin < 0.8 ? "sc-int-bull" : internals.trin > 1.2 ? "sc-int-bear" : "sc-int-neutral"}`}>
              TRIN {internals.trin.toFixed(2)}
            </span>
          )}
          {internals.add != null && (
            <span className={`sc-int ${internals.add > 200 ? "sc-int-bull" : internals.add < -200 ? "sc-int-bear" : "sc-int-neutral"}`}>
              ADD {internals.add > 0 ? "+" : ""}{Math.round(internals.add)}
            </span>
          )}
        </div>
      )}

      {/* Action area — only on ENTRY signals */}
      {isEntry && cardState === "idle" && (
        <div className="sc-actions">
          <button className="sc-took" onClick={() => setCardState("form")}>
            ✓ Took
          </button>
          <button className="sc-skip" onClick={() => { setCardState("skipped"); onSkipped(alert.id); }}>
            ✗ Skip
          </button>
        </div>
      )}

      {isEntry && (cardState === "form" || cardState === "submitting") && (
        <div className="sc-exit-form">
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>
            Premium paid ($)
          </div>
          <input
            className="sc-exit-input"
            type="number"
            step="0.01"
            placeholder="e.g. 2.50"
            value={entryPremium}
            onChange={(e) => setEntryPremium(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
            autoFocus
            disabled={cardState === "submitting"}
          />
          <div className="sc-exit-row">
            <button
              className="sc-exit-confirm"
              onClick={handleSubmit}
              disabled={cardState === "submitting"}
            >
              {cardState === "submitting" ? "Saving..." : "Log Entry"}
            </button>
            <button
              className="sc-exit-cancel"
              onClick={() => { setCardState("idle"); setEntryPremium(""); setSubmitError(""); }}
              disabled={cardState === "submitting"}
            >
              ✕
            </button>
          </div>
          {submitError && (
            <div style={{ fontSize: 9, color: "var(--bear)", marginTop: 4 }}>{submitError}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SignalStream({ alerts, isUnread, markRead }: SignalStreamProps) {
  const { getToken } = useAuth();
  const [loggedIds, setLoggedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("otd_logged_ids");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("otd_skipped_ids");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [sessionPnl, setSessionPnl] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);

  const unreadCount = alerts.filter((a) => isUnread(a)).length;

  const handleLogged = (id: string, pnl: number) => {
    setLoggedIds((prev) => {
      const next = new Set(prev).add(id);
      try { localStorage.setItem("otd_logged_ids", JSON.stringify([...next])); } catch {}
      return next;
    });
    setSessionPnl((prev) => prev + pnl);
    setTradeCount((prev) => prev + 1);
    markRead(id);
  };

  const handleSkipped = (id: string) => {
    setSkippedIds((prev) => {
      const next = new Set(prev).add(id);
      try { localStorage.setItem("otd_skipped_ids", JSON.stringify([...next])); } catch {}
      return next;
    });
    markRead(id);
  };

  return (
    <div className="signal-stream">
      <div className="ss-header">
        <span className="ss-title">Signals</span>
        {unreadCount > 0 && (
          <span className="ss-badge">{unreadCount} new</span>
        )}
      </div>

      <div className="ss-body">
        {alerts.length === 0 ? (
          <div className="ss-empty">Waiting for signals...</div>
        ) : (
          alerts.slice(0, 8).map((alert) => {
            const alertKey = alert.id || `${alert.ts}-${alert.price}-${alert.signal}`;
            return (
              <SignalCard
                key={alertKey}
                alert={alert}
                isLogged={loggedIds.has(alertKey)}
                isSkipped={skippedIds.has(alertKey)}
                getToken={getToken}
                onLogged={(_, pnl) => handleLogged(alertKey, pnl)}
                onSkipped={() => handleSkipped(alertKey)}
              />
            );
          })
        )}
      </div>

      <div className="ss-footer">
        <div className="ss-footer-label">Today&apos;s Session</div>
        <div className="ss-stats">
          <div className="ss-stat">
            <div className="ss-stat-label">P&amp;L</div>
            <div className={`ss-stat-val ${sessionPnl >= 0 ? "ss-green" : "ss-red"}`}>
              {sessionPnl >= 0 ? "+" : ""}{sessionPnl >= 0 ? "$" : "-$"}{Math.abs(sessionPnl).toLocaleString()}
            </div>
          </div>
          <div className="ss-stat">
            <div className="ss-stat-label">Trades</div>
            <div className="ss-stat-val">{tradeCount}/3</div>
          </div>
        </div>
      </div>
    </div>
  );
}
