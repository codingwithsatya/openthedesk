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
}

const LS_KEY = "tv_alerts_last_seen";

function formatRelative(ts: string): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - new Date(ts).getTime()) / 1000));
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

export function useAlerts() {
  const [alerts, setAlerts] = useState<TVAlert[]>([]);
  const [lastSeenId, setLastSeenId] = useState<string | null>(null);

  // Read persisted baseline on mount (localStorage is browser-only)
  useEffect(() => {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) setLastSeenId(stored);
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
        // First visit with no baseline: start caught up so there's no false unread storm
        if (!localStorage.getItem(LS_KEY) && fetched.length > 0) {
          localStorage.setItem(LS_KEY, fetched[0].id);
          setLastSeenId(fetched[0].id);
        }
      } catch {
        // swallow network errors silently
      }
    };

    run();
    const id = setInterval(run, 30_000);
    return () => clearInterval(id);
  }, []);

  const markAllRead = useCallback(() => {
    if (!alerts.length) return;
    localStorage.setItem(LS_KEY, alerts[0].id);
    setLastSeenId(alerts[0].id);
  }, [alerts]);

  // alerts are newest-first; index of lastSeenId = number of unread alerts before it
  const alertCount = (() => {
    if (!lastSeenId) return 0;
    const idx = alerts.findIndex((a) => a.id === lastSeenId);
    return idx === -1 ? alerts.length : idx;
  })();

  return { alerts, alertCount, markAllRead };
}

interface AlertDrawerProps {
  alerts: TVAlert[];
  alertCount: number;
  markAllRead: () => void;
  onClose: () => void;
}

export function AlertDrawer({ alerts, alertCount, markAllRead }: AlertDrawerProps) {
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
            <div key={a.id} className="alert-row">
              <div className="alert-row-top">
                <span className="alert-ticker">{a.ticker}</span>
                <span className="alert-sep">·</span>
                <span className="alert-tf">{a.timeframe}</span>
                <span className="alert-sep">·</span>
                <span className="alert-cond">{a.condition}</span>
                <span className="alert-row-time">{formatRelative(a.ts)}</span>
              </div>
              <div className="alert-row-meta">
                {a.price} · {a.atr_level}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
