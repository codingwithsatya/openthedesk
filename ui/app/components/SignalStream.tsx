"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { TVAlert } from "./AlertPanel";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type CardState = "idle" | "form" | "submitting" | "logged" | "skipped";

interface SignalStreamProps {
  alerts: TVAlert[];
  isUnread: (a: TVAlert) => boolean;
  markRead: (id: string) => void;
}

function formatRelative(ts: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(ts).getTime()) / 1000),
  );

  if (diffSec < 60) return `${diffSec}s`;
  const m = Math.floor(diffSec / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function getAlertKey(alert: TVAlert) {
  return alert.id || `${alert.ts}-${alert.price}-${alert.signal}`;
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
  const tp = alert.trade_plan;

  const isBear = dir === "BEAR" || setup === "STOP" || sig === "STOP";
  const isBull = dir === "BULL";
  const isUpdate = sig === "EXIT" || sig === "TRAIL" || sig === "TARGET";
  const isEntry = sig === "ENTRY";

  const alertDate = new Date(alert.ts);
  const today = new Date();
  const isToday =
    alertDate.getFullYear() === today.getFullYear() &&
    alertDate.getMonth() === today.getMonth() &&
    alertDate.getDate() === today.getDate();

  const isActionable = isEntry && isToday;

  const cardClass = [
    "sc",
    isBear ? "sc-bear" : isBull ? "sc-bull" : "sc-update",
    isSkipped || cardState === "skipped" ? "sc-muted" : "",
    cardState === "logged" ? "sc-logged-card" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const setupClass = [
    "sc-setup",
    isBear
      ? "sc-setup-bear"
      : isBull
        ? "sc-setup-bull"
        : isUpdate
          ? "sc-setup-update"
          : "sc-setup-neutral",
  ].join(" ");

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
          direction: dir || "BULL",
          entry_price: tp?.entry ?? parseFloat(alert.price),
          entry_premium: premium,
          contracts: 1,
          status: "open",
          notes:
            `Signal: ${alert.signal || ""} · ATR Level: ${alert.atr_level || ""} · T1: ${tp?.t1 ?? ""} · T2: ${tp?.t2 ?? ""} · SL: ${tp?.sl ?? ""}`.trim(),
        }),
      });

      if (!res.ok) throw new Error(await res.text());

      setCardState("logged");
      onLogged(getAlertKey(alert), 0);
    } catch {
      setSubmitError("Failed — try chat journal");
      setCardState("form");
    }
  };

  return (
    <div className={cardClass}>
      <div className="sc-top">
        <div className="sc-pills">
          <span className={setupClass}>
            {setup || sig || "SIGNAL"} {dir}
          </span>

          {alert.grade && <span className="sc-grade">{alert.grade}</span>}

          {sig && sig !== "ENTRY" && <span className="sc-status">{sig}</span>}

          {cardState === "logged" && <span className="sc-status">OPEN</span>}
          {cardState === "skipped" && (
            <span className="sc-status">SKIPPED</span>
          )}
        </div>

        <span className="sc-time">{formatRelative(alert.ts)}</span>
      </div>

      <div className="sc-price-row">
        <span className="sc-price">
          {Number(alert.price).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span className="sc-ticker">{alert.ticker || "SPX"}</span>
      </div>

      {tp && (
        <div className="sc-mini-plan">
          <span>T1 {tp.t1?.toFixed(1) ?? "—"}</span>
          <span>T2 {tp.t2?.toFixed(1) ?? "—"}</span>
          <span>SL {tp.sl?.toFixed(1) ?? "—"}</span>
        </div>
      )}

      {isActionable && cardState === "idle" && (
        <div className="sc-actions">
          <button className="sc-took" onClick={() => setCardState("form")}>
            Took
          </button>
          <button
            className="sc-skip"
            onClick={() => {
              setCardState("skipped");
              onSkipped(getAlertKey(alert));
            }}
          >
            Skip
          </button>
        </div>
      )}

      {isActionable && (cardState === "form" || cardState === "submitting") && (
        <div className="sc-exit-form">
          <input
            className="sc-exit-input"
            type="number"
            step="0.01"
            placeholder="Premium paid"
            value={entryPremium}
            onChange={(e) => setEntryPremium(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            autoFocus
            disabled={cardState === "submitting"}
          />

          <div className="sc-exit-row">
            <button
              className="sc-exit-confirm"
              onClick={handleSubmit}
              disabled={cardState === "submitting"}
            >
              {cardState === "submitting" ? "Saving..." : "Log"}
            </button>
            <button
              className="sc-exit-cancel"
              onClick={() => {
                setCardState("idle");
                setEntryPremium("");
                setSubmitError("");
              }}
              disabled={cardState === "submitting"}
            >
              ✕
            </button>
          </div>

          {submitError && <div className="sc-error">{submitError}</div>}
        </div>
      )}
    </div>
  );
}

export default function SignalStream({
  alerts,
  isUnread,
  markRead,
}: SignalStreamProps) {
  const { getToken } = useAuth();

  const [loggedIds, setLoggedIds] = useState<Set<string>>(new Set());
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const [sessionPnl, setSessionPnl] = useState(0);
  const [tradeCount, setTradeCount] = useState(0);

  useEffect(() => {
    try {
      const savedLogged = localStorage.getItem("otd_logged_ids");
      const savedSkipped = localStorage.getItem("otd_skipped_ids");

      if (savedLogged) setLoggedIds(new Set(JSON.parse(savedLogged)));
      if (savedSkipped) setSkippedIds(new Set(JSON.parse(savedSkipped)));
    } catch {
      setLoggedIds(new Set());
      setSkippedIds(new Set());
    }
  }, []);

  const unreadCount = alerts.filter((a) => isUnread(a)).length;

  const handleLogged = (id: string, pnl: number) => {
    setLoggedIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem("otd_logged_ids", JSON.stringify([...next]));
      } catch {}
      return next;
    });

    setSessionPnl((prev) => prev + pnl);
    setTradeCount((prev) => prev + 1);
    markRead(id);
  };

  const handleSkipped = (id: string) => {
    setSkippedIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem("otd_skipped_ids", JSON.stringify([...next]));
      } catch {}
      return next;
    });

    markRead(id);
  };

  return (
    <aside className="signal-stream">
      <div className="ss-header">
        <span className="ss-title">Signals</span>
        {unreadCount > 0 && <span className="ss-badge">{unreadCount}</span>}
      </div>

      <div className="ss-body">
        {alerts.length === 0 ? (
          <div className="ss-empty">
            <div className="ss-empty-icon">📡</div>
            <div className="ss-empty-title">Waiting for signals</div>
            <div className="ss-empty-sub">TradingView alerts appear here.</div>
          </div>
        ) : (
          alerts.slice(0, 12).map((alert) => {
            const alertKey = getAlertKey(alert);

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
            <div
              className={`ss-stat-val ${
                sessionPnl >= 0 ? "ss-green" : "ss-red"
              }`}
            >
              {sessionPnl >= 0 ? "+" : "-"}$
              {Math.abs(sessionPnl).toLocaleString()}
            </div>
          </div>

          <div className="ss-stat">
            <div className="ss-stat-label">Trades</div>
            <div className="ss-stat-val">{tradeCount}/3</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
