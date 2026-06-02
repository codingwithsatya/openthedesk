"use client";
import { useState, useEffect, useCallback } from "react";

export interface TVAlert {
  id: string;
  ts: string;
  ticker: string;
  timeframe: string;
  condition: string;
  price: string;
  atr_level: string;
  setup?: string;
  grade?: string;
  direction?: string;
  trin?: number | null;
  add?: number | null;
  vold?: number | null;
  signal?: string;
  type?: string;
  trail_sl?: number | null;
  internals?: {
    trin: number | null;
    add: number | null;
    vold: number | null;
    pcc: number | null;
    received_at: string;
  } | null;
  internals_age_seconds?: number | null;
  trade_plan?: {
    entry: number;
    direction: string;
    t1: number | null;
    t1_pts: number | null;
    t1_label: string;
    t2: number | null;
    t2_pts: number | null;
    t2_label: string;
    t3: number | null;
    t3_pts: number | null;
    t3_label: string;
    sl: number;
    sl_pts: number;
  };
}

const LS_KEY = "tv_alerts_read";
const MAX_STORED = 100;

function formatRelative(ts: string): string {
  const diffSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(ts).getTime()) / 1000),
  );
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ── Visual config per setup/direction ────────────────────────
function getCardStyle(alert: TVAlert) {
  const dir = alert.direction?.toUpperCase();
  const setup = alert.setup?.toUpperCase();

  if (setup === "STOP") {
    return {
      badgeBg: "#1e293b",
      badgeColor: "#94a3b8",
      badgeBorder: "1px solid #334155",
    };
  }
  if (setup === "TARGET") {
    return {
      badgeBg: "#1e293b",
      badgeColor: "#94a3b8",
      badgeBorder: "1px solid #334155",
    };
  }
  if (setup === "DIV") {
    return {
      badgeBg: "#1e293b",
      badgeColor: "#94a3b8",
      badgeBorder: "1px solid #334155",
    };
  }
  if (dir === "BULL") {
    return {
      badgeBg: "#0d3320",
      badgeColor: "#22ff7a",
      badgeBorder: "1px solid #166534",
    };
  }
  if (dir === "BEAR") {
    return {
      badgeBg: "#5c1a1a",
      badgeColor: "#ff6b6b",
      badgeBorder: "1px solid #991b1b",
    };
  }
  return {
    badgeBg: "#1e293b",
    badgeColor: "#94a3b8",
    badgeBorder: "1px solid #334155",
  };
}

function formatAtrLevel(raw: string): string {
  return raw.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function loadReadIds(): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function saveReadIds(ids: Set<string>) {
  const arr = Array.from(ids).slice(0, MAX_STORED);
  localStorage.setItem(LS_KEY, JSON.stringify(arr));
}

// ── useAlerts hook ────────────────────────────────────────────
export function useAlerts() {
  const [alerts, setAlerts] = useState<TVAlert[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    setReadIds(loadReadIds());
  }, []);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    const run = async () => {
      try {
        const res = await fetch(`${base}/alerts?limit=50`);
        if (!res.ok) return;
        const data = await res.json();
        const fetched: TVAlert[] = data.alerts ?? [];
        setAlerts(fetched);
      } catch {}
    };
    run();
  }, []);

  useEffect(() => {
    const base = process.env.NEXT_PUBLIC_API_URL ?? "";
    const es = new EventSource(`${base}/alerts/stream`);
    es.onmessage = (e) => {
      if (e.data === "ping") return;
      try {
        const alert: TVAlert = JSON.parse(e.data);
        if (alert.type === "internal") return; // skip internal-only alerts
        setAlerts((prev) => {
          if (prev.some((a) => a.id === alert.id)) return prev;
          return [alert, ...prev];
        });
      } catch {}
    };
    return () => es.close();
  }, []);

  const markRead = useCallback((id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveReadIds(next);
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setReadIds((prev) => {
      const next = new Set(prev);
      alerts.forEach((a) => next.add(a.id));
      saveReadIds(next);
      return next;
    });
  }, [alerts]);

  const alertCount = alerts.filter((a) => !readIds.has(a.id)).length;
  const isUnread = useCallback(
    (alert: TVAlert) => !readIds.has(alert.id),
    [readIds],
  );

  return { alerts, alertCount, markAllRead, markRead, isUnread };
}

// ── AlertCard ─────────────────────────────────────────────────
function AlertCard({
  alert,
  isUnread,
  onMarkRead,
}: {
  alert: TVAlert;
  isUnread: boolean;
  onMarkRead: () => void;
}) {
  const { badgeBg, badgeColor, badgeBorder } = getCardStyle(alert);
  const isAplus = alert.grade === "A+";
  const [hovered, setHovered] = useState(false);

  const dir = alert.direction?.toUpperCase();
  const setup = alert.setup?.toUpperCase();

  const borderLeft = (() => {
    if (dir === "BEAR" || setup === "STOP") return "3px solid #ef4444";
    if (dir === "BULL") return "3px solid #22c55e";
    if (setup === "TARGET") return "3px solid #475569";
    return "3px solid #334155";
  })();

  const unreadBg = (() => {
    if (dir === "BEAR" || setup === "STOP") return "rgba(239,68,68,0.05)";
    if (dir === "BULL") return "rgba(34,197,94,0.05)";
    return "rgba(255,255,255,0.03)";
  })();

  const baseBg = isUnread ? unreadBg : "transparent";
  const bg = hovered ? "rgba(255,255,255,0.03)" : baseBg;

  return (
    <div
      onClick={onMarkRead}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "stretch",
        borderBottom: "0.5px solid #1a2744",
        cursor: "pointer",
        background: bg,
        transition: "background 0.15s",
        width: "100%",
      }}
    >
      {/* Accent bar */}
      <div
        style={{
          width: 4,
          flexShrink: 0,
          alignSelf: "stretch",
          marginLeft: "-1px",
          background:
            dir === "BEAR" || setup === "STOP"
              ? "#ef4444"
              : dir === "BULL"
                ? "#22c55e"
                : setup === "TARGET"
                  ? "#475569"
                  : "#334155",
        }}
      />

      {/* Card body */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          padding: isUnread ? "10px 14px" : "8px 14px",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {/* Top row: ticker + timeframe + setup badge + grade badge + time */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            marginBottom: 4,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              minWidth: 0,
              flex: 1,
              overflow: "hidden",
            }}
          >
            <span
              style={{
                fontSize: 13,
                fontWeight: 600,
                color: isUnread ? "#f1f5f9" : "#64748b",
                flexShrink: 0,
              }}
            >
              {alert.ticker}
            </span>

            {/* Timeframe pill */}
            {alert.timeframe && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: "#1e293b",
                  color: "#94a3b8",
                  border: "1px solid #334155",
                  flexShrink: 0,
                }}
              >
                {alert.timeframe}
              </span>
            )}

            {/* Setup + direction badge */}
            <span
              title={
                alert.setup && alert.direction
                  ? `${alert.setup} ${alert.direction}`
                  : alert.condition
              }
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: 3,
                background: badgeBg,
                color: badgeColor,
                border: badgeBorder,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: 130,
                flexShrink: 1,
              }}
            >
              {alert.setup && alert.direction
                ? `${alert.setup} ${alert.direction}`
                : alert.condition}
            </span>

            {/* Grade badge */}
            {alert.grade && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "1px 5px",
                  borderRadius: 3,
                  background: isAplus ? "#1e3a5f" : "#1e293b",
                  color: isAplus ? "#60a5fa" : "#64748b",
                  border: isAplus ? "1px solid #2d5a8e" : "1px solid #334155",
                  flexShrink: 0,
                }}
              >
                {alert.grade}
              </span>
            )}

            {/* Signal badge */}
            {alert.signal && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: 3,
                  background:
                    alert.signal === "ENTRY"
                      ? "#14532d"
                      : alert.signal === "EXIT"
                        ? "#7f1d1d"
                        : alert.signal === "SCALE"
                          ? "#1e3a5f"
                          : "#1e293b",
                  color:
                    alert.signal === "ENTRY"
                      ? "#4ade80"
                      : alert.signal === "EXIT"
                        ? "#f87171"
                        : alert.signal === "SCALE"
                          ? "#60a5fa"
                          : "#94a3b8",
                  border: `1px solid ${
                    alert.signal === "ENTRY"
                      ? "#166534"
                      : alert.signal === "EXIT"
                        ? "#991b1b"
                        : alert.signal === "SCALE"
                          ? "#2d5a8e"
                          : "#334155"
                  }`,
                }}
              >
                {alert.signal}
              </span>
            )}
          </div>

          <span
            style={{
              fontSize: 11,
              color: "#64748b",
              whiteSpace: "nowrap",
              flexShrink: 0,
              marginLeft: 4,
            }}
          >
            {formatRelative(alert.ts)}
          </span>
        </div>

        {/* Price row — hidden for read alerts */}
        {isUnread && (
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "#f1f5f9",
                fontFamily: "var(--font-mono, monospace)",
                letterSpacing: "-0.3px",
                flexShrink: 0,
              }}
            >
              {Number(alert.price).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </span>
            {alert.atr_level && !alert.atr_level.includes("%") && (
              <span
                style={{
                  fontSize: 11,
                  color: "#60a5fa",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                → {formatAtrLevel(alert.atr_level)}
              </span>
            )}
          </div>
        )}

        {/* Market internals row — unread only, when data present */}
        {isUnread &&
          (alert.trin != null || alert.add != null || alert.vold != null) && (
            <div
              style={{
                display: "flex",
                gap: 8,
                marginTop: 4,
                alignItems: "center",
              }}
            >
              {alert.trin != null && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono, monospace)",
                    color:
                      alert.trin > 1.2
                        ? "#f87171"
                        : alert.trin < 0.8
                          ? "#4ade80"
                          : "#94a3b8",
                  }}
                >
                  TRIN {alert.trin.toFixed(2)}
                </span>
              )}
              {alert.add != null && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono, monospace)",
                    color:
                      alert.add > 200
                        ? "#4ade80"
                        : alert.add < -200
                          ? "#f87171"
                          : "#94a3b8",
                  }}
                >
                  ADD {alert.add > 0 ? "+" : ""}
                  {alert.add}
                </span>
              )}
              {alert.vold != null && (
                <span
                  style={{
                    fontSize: 10,
                    fontFamily: "var(--font-mono, monospace)",
                    color: "#94a3b8",
                  }}
                >
                  VOLD {alert.vold.toFixed(2)}
                </span>
              )}
            </div>
          )}

        {/* Trade plan — unread ENTRY alerts only */}
        {isUnread && alert.trade_plan && (
          <div
            style={{
              marginTop: 8,
              padding: "8px 10px",
              background: "#0f172a",
              borderRadius: 6,
              border: "1px solid #1e293b",
              fontSize: 11,
              fontFamily: "monospace",
            }}
          >
            <div
              style={{
                color: "#64748b",
                marginBottom: 6,
                fontSize: 10,
                letterSpacing: 1,
              }}
            >
              TRADE PLAN
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "44px 1fr 52px",
                rowGap: 4,
              }}
            >
              <span style={{ color: "#64748b" }}>ENTRY</span>
              <span style={{ color: "#f1f5f9", fontWeight: 600 }}>
                {alert.trade_plan.entry.toFixed(2)}
              </span>
              <span />

              <span style={{ color: "#22c55e" }}>T1</span>
              <span style={{ color: "#f1f5f9" }}>
                {alert.trade_plan.t1?.toFixed(2)}
                <span style={{ color: "#475569", marginLeft: 6, fontSize: 10 }}>
                  {alert.trade_plan.t1_label}
                </span>
              </span>
              <span style={{ color: "#22c55e" }}>
                +{alert.trade_plan.t1_pts}
              </span>

              <span style={{ color: "#22c55e" }}>T2</span>
              <span style={{ color: "#f1f5f9" }}>
                {alert.trade_plan.t2?.toFixed(2)}
                <span style={{ color: "#475569", marginLeft: 6, fontSize: 10 }}>
                  {alert.trade_plan.t2_label}
                </span>
              </span>
              <span style={{ color: "#22c55e" }}>
                +{alert.trade_plan.t2_pts}
              </span>

              <span style={{ color: "#fbbf24" }}>T3</span>
              <span style={{ color: "#f1f5f9" }}>
                {alert.trade_plan.t3?.toFixed(2)}
                <span style={{ color: "#475569", marginLeft: 6, fontSize: 10 }}>
                  {alert.trade_plan.t3_label}
                </span>
              </span>
              <span style={{ color: "#fbbf24" }}>
                +{alert.trade_plan.t3_pts}
              </span>

              <span style={{ color: "#ef4444" }}>SL</span>
              <span style={{ color: "#f1f5f9" }}>
                {alert.trade_plan.sl.toFixed(2)}
              </span>
              <span style={{ color: "#ef4444" }}>
                -{alert.trade_plan.sl_pts}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── AlertDrawer ───────────────────────────────────────────────
interface AlertDrawerProps {
  alerts: TVAlert[];
  alertCount: number;
  markAllRead: () => void;
  markRead: (id: string) => void;
  isUnread: (alert: TVAlert) => boolean;
  onClose: () => void;
}

export function AlertDrawer({
  alerts,
  alertCount,
  markAllRead,
  markRead,
  isUnread,
}: AlertDrawerProps) {
  return (
    <div className="alert-drawer">
      <div className="alert-hdr">
        <span>TV Alerts</span>
        <button
          className="alert-mark-read"
          onClick={markAllRead}
          disabled={alertCount === 0}
        >
          Mark all read
        </button>
      </div>

      <div className="alert-list">
        {alerts.length === 0 ? (
          <div className="alert-empty">No alerts yet</div>
        ) : (
          alerts.map((a) => (
            <AlertCard
              key={a.id}
              alert={a}
              isUnread={isUnread(a)}
              onMarkRead={() => markRead(a.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}
