"use client";
import { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import { TVAlert } from "./AlertPanel";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

type CardState = "idle" | "form" | "submitting" | "logged" | "skipped";

interface MobileSignalStreamProps {
  open: boolean;
  onClose: () => void;
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
  return `${Math.floor(m / 60)}h`;
}

function MobileSignalCard({
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
  const alertKey = alert.id || `${alert.ts}-${alert.price}-${alert.signal}`;

  const dirColor =
    dir === "BEAR" ? "#ef4444" : dir === "BULL" ? "#22c55e" : "#94a3b8";
  const cardBg =
    dir === "BEAR" ? "#1a0a0a" : dir === "BULL" ? "#0a1a0f" : "#0a0e1a";
  const cardBorder =
    dir === "BEAR"
      ? "rgba(239,68,68,0.25)"
      : dir === "BULL"
        ? "rgba(34,197,94,0.25)"
        : "rgba(255,255,255,0.08)";

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
      onLogged(alertKey, 0);
    } catch {
      setSubmitError("Failed — try chat journal");
      setCardState("form");
    }
  };

  if (cardState === "logged")
    return (
      <div
        style={{
          padding: "10px 12px",
          background: "#0a1a0f",
          borderRadius: 8,
          border: "1px solid rgba(34,197,94,0.2)",
          color: "#22c55e",
          fontSize: 12,
          fontFamily: "var(--mono)",
        }}
      >
        ✓ Open Trade
      </div>
    );

  if (cardState === "skipped")
    return (
      <div
        style={{
          padding: "10px 12px",
          background: "#0a0e1a",
          borderRadius: 8,
          border: "1px solid rgba(255,255,255,0.05)",
          opacity: 0.4,
        }}
      >
        <div style={{ fontSize: 11, color: "#475569" }}>
          {setup || sig} {dir} — Skipped
        </div>
      </div>
    );

  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 8,
        padding: "10px 12px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 5,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: dirColor,
              background: `${dirColor}18`,
              padding: "2px 6px",
              borderRadius: 4,
              letterSpacing: "0.06em",
            }}
          >
            {setup || sig} {dir}
          </span>
          {alert.grade && (
            <span
              style={{
                fontSize: 9,
                fontWeight: 700,
                color: "#22d3ee",
                background: "rgba(34,211,238,0.08)",
                padding: "2px 5px",
                borderRadius: 4,
                border: "1px solid rgba(34,211,238,0.2)",
              }}
            >
              {alert.grade}
            </span>
          )}
          {sig && sig !== "ENTRY" && (
            <span
              style={{
                fontSize: 9,
                color: "#22d3ee",
                fontFamily: "var(--mono)",
              }}
            >
              {sig}
            </span>
          )}
        </div>
        <span
          style={{
            fontSize: 9,
            color: "#475569",
            fontFamily: "var(--mono)",
            flexShrink: 0,
          }}
        >
          {formatRelative(alert.ts)}
        </span>
      </div>

      {/* Price */}
      <div style={{ marginBottom: 6 }}>
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: "#f1f5f9",
            fontFamily: "var(--mono)",
          }}
        >
          {Number(alert.price).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span style={{ fontSize: 10, color: "#475569", marginLeft: 6 }}>
          {alert.ticker}
        </span>
      </div>

      {/* Trade plan levels — only on ENTRY */}
      {tp && isEntry && (
        <div style={{ display: "flex", gap: 10, marginBottom: 6 }}>
          {(
            [
              ["T1", tp.t1, "#22c55e"],
              ["T2", tp.t2, "#22c55e"],
              ["T3", tp.t3, "#f97316"],
              ["SL", tp.sl, "#ef4444"],
            ] as [string, number | undefined, string][]
          ).map(([k, v, c]) =>
            v != null ? (
              <div
                key={k}
                style={{ display: "flex", gap: 3, alignItems: "baseline" }}
              >
                <span style={{ fontSize: 9, color: "#475569" }}>{k}</span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    color: c,
                    fontFamily: "var(--mono)",
                  }}
                >
                  {v.toFixed(0)}
                </span>
              </div>
            ) : null,
          )}
        </div>
      )}

      {/* Internals chips */}
      {(alert.internals?.trin != null || alert.internals?.add != null) && (
        <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
          {alert.internals?.trin != null && (
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.05)",
                color:
                  alert.internals.trin < 0.8
                    ? "#22c55e"
                    : alert.internals.trin > 1.2
                      ? "#ef4444"
                      : "#94a3b8",
              }}
            >
              TRIN {alert.internals.trin.toFixed(2)}
            </span>
          )}
          {alert.internals?.add != null && (
            <span
              style={{
                fontSize: 9,
                padding: "2px 6px",
                borderRadius: 4,
                background: "rgba(255,255,255,0.05)",
                color:
                  alert.internals.add > 200
                    ? "#22c55e"
                    : alert.internals.add < -200
                      ? "#ef4444"
                      : "#94a3b8",
              }}
            >
              ADD {alert.internals.add > 0 ? "+" : ""}
              {Math.round(alert.internals.add)}
            </span>
          )}
        </div>
      )}

      {/* Took / Skip */}
      {isEntry && cardState === "idle" && (
        <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
          <button
            onClick={() => setCardState("form")}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: "rgba(34,197,94,0.12)",
              color: "#22c55e",
              border: "1px solid rgba(34,197,94,0.3)",
            }}
          >
            ✓ Took
          </button>
          <button
            onClick={() => {
              setCardState("skipped");
              onSkipped(alertKey);
            }}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 6,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              background: "rgba(239,68,68,0.08)",
              color: "#ef4444",
              border: "1px solid rgba(239,68,68,0.2)",
            }}
          >
            ✗ Skip
          </button>
        </div>
      )}

      {/* Entry premium form */}
      {isEntry && (cardState === "form" || cardState === "submitting") && (
        <div
          style={{
            marginTop: 6,
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div style={{ fontSize: 10, color: "#64748b" }}>Premium paid ($)</div>
          <input
            type="number"
            step="0.01"
            autoFocus
            placeholder="e.g. 2.50"
            value={entryPremium}
            onChange={(e) => setEntryPremium(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            disabled={cardState === "submitting"}
            style={{
              padding: "9px 12px",
              borderRadius: 6,
              background: "#05080f",
              border: "1px solid #1e3a5f",
              color: "#f1f5f9",
              fontSize: 15,
              fontFamily: "var(--mono)",
              width: "100%",
              boxSizing: "border-box" as const,
            }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={handleSubmit}
              disabled={cardState === "submitting"}
              style={{
                flex: 1,
                padding: "10px 0",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: "rgba(34,197,94,0.15)",
                color: "#22c55e",
                border: "1px solid rgba(34,197,94,0.3)",
              }}
            >
              {cardState === "submitting" ? "Saving..." : "Log Entry"}
            </button>
            <button
              onClick={() => {
                setCardState("idle");
                setEntryPremium("");
                setSubmitError("");
              }}
              disabled={cardState === "submitting"}
              style={{
                padding: "10px 16px",
                borderRadius: 6,
                fontSize: 13,
                cursor: "pointer",
                background: "transparent",
                color: "#64748b",
                border: "1px solid #1e3a5f",
              }}
            >
              ✕
            </button>
          </div>
          {submitError && (
            <div style={{ fontSize: 10, color: "#ef4444" }}>{submitError}</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function MobileSignalStream({
  open,
  onClose,
  alerts,
  isUnread,
  markRead,
}: MobileSignalStreamProps) {
  const { getToken } = useAuth();

  const [loggedIds, setLoggedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("otd_logged_ids");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [skippedIds, setSkippedIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("otd_skipped_ids");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleLogged = (id: string, _pnl: number) => {
    setLoggedIds((prev) => {
      const next = new Set(prev).add(id);
      try {
        localStorage.setItem("otd_logged_ids", JSON.stringify([...next]));
      } catch {}
      return next;
    });
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

  const keyOf = (a: TVAlert) => a.id || `${a.ts}-${a.price}-${a.signal}`;

  // Prioritize: any active (unlogged, unskipped) ENTRY alert is always
  // shown, even if newer non-ENTRY alerts (TRAIL/TARGET/STOP for other
  // tickers) would otherwise push it out of a plain slice(0, 5).
  const activeEntries = alerts.filter((a) => {
    const sig = (a.signal ?? "").toUpperCase();
    const key = keyOf(a);
    return sig === "ENTRY" && !loggedIds.has(key) && !skippedIds.has(key);
  });
  const rest = alerts.filter((a) => !activeEntries.includes(a));
  const visibleAlerts = [...activeEntries, ...rest].slice(0, 5);

  if (!open) return null;

  const unreadCount = alerts.filter((a) => isUnread(a)).length;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          zIndex: 90,
        }}
      />

      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          left: 0,
          right: 0,
          bottom: 0,
          height: "76dvh",
          background: "#0a0e1a",
          borderRadius: "16px 16px 0 0",
          border: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          zIndex: 91,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        {/* Drag handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 4px",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "rgba(255,255,255,0.15)",
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            padding: "6px 16px 10px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: "#64748b",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
              }}
            >
              Signals
            </span>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 99,
                  background: "rgba(239,68,68,0.15)",
                  border: "1px solid rgba(239,68,68,0.3)",
                  color: "#ef4444",
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#475569",
              fontSize: 18,
              cursor: "pointer",
              padding: "4px 8px",
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>

        {/* Signal cards — capped at 5 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "10px 12px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {visibleAlerts.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                color: "#475569",
                fontSize: 12,
                paddingTop: 48,
              }}
            >
              Waiting for signals...
            </div>
          ) : (
            visibleAlerts.map((alert) => {
              const alertKey = keyOf(alert);
              return (
                <MobileSignalCard
                  key={alertKey}
                  alert={alert}
                  isLogged={loggedIds.has(alertKey)}
                  isSkipped={skippedIds.has(alertKey)}
                  getToken={getToken}
                  onLogged={handleLogged}
                  onSkipped={handleSkipped}
                />
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
