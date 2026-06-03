"use client";
import { useState, useEffect } from "react";

interface InternalsData {
  trin: number | null;
  add: number | null;
  vold: number | null;
  pcc: number | null;
  bias: string | null;
  received_at: string | null;
}

function getAgeSeconds(received_at: string | null): number | null {
  if (!received_at) return null;
  try {
    return Math.round((Date.now() - new Date(received_at).getTime()) / 1000);
  } catch {
    return null;
  }
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

export default function InternalsWidget() {
  const [data, setData] = useState<InternalsData | null>(null);
  const [age, setAge] = useState<number | null>(null);

  const fetchInternals = async () => {
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? "";
      const res = await fetch(`${base}/internals`);
      if (!res.ok) return;
      const json = await res.json();
      if (!json.received_at) {
        setData(null);
        return;
      }
      setData(json);
      setAge(getAgeSeconds(json.received_at));
    } catch {
      // network error — keep last known state
    }
  };

  useEffect(() => {
    fetchInternals();
    const poll = setInterval(fetchInternals, 30_000);
    return () => clearInterval(poll);
  }, []);

  // Tick the age display every 10s without re-fetching
  useEffect(() => {
    if (!data?.received_at) return;
    const received_at = data.received_at;
    const tick = setInterval(() => setAge(getAgeSeconds(received_at)), 10_000);
    return () => clearInterval(tick);
  }, [data?.received_at]);

  const isStale = age !== null && age > 300;    // >5 min — offline
  const isWarning = age !== null && age > 180 && age <= 300; // 3–5 min — missed heartbeat

  // ── Offline / no data state ──────────────────────────────────
  if (!data || isStale) {
    return (
      <div style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "7px 10px", borderRadius: 7,
        background: "#f8fafc", border: "1px solid #e2e8f0",
        marginBottom: 6, fontSize: 10, color: "#94a3b8",
        fontFamily: "var(--font-inter, sans-serif)",
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "#cbd5e1", flexShrink: 0,
        }} />
        <span>Internals Offline</span>
        {isStale && age !== null && (
          <span style={{ marginLeft: "auto", color: "#cbd5e1" }}>
            {formatAge(age)}
          </span>
        )}
      </div>
    );
  }

  // ── Color helpers ────────────────────────────────────────────
  const trinColor =
    data.trin === null ? "#94a3b8"
    : data.trin < 1.0  ? "#4ade80"
    : data.trin > 1.2  ? "#f87171"
    : "#94a3b8";

  const addColor =
    data.add === null  ? "#94a3b8"
    : data.add > 200   ? "#4ade80"
    : data.add < -200  ? "#f87171"
    : "#94a3b8";

  const voldColor =
    data.vold === null ? "#94a3b8"
    : data.vold > 0    ? "#4ade80"
    : data.vold < 0    ? "#f87171"
    : "#94a3b8";

  const pccColor =
    data.pcc === null  ? "#94a3b8"
    : data.pcc < 0.80  ? "#4ade80"
    : data.pcc > 1.20  ? "#f87171"
    : "#94a3b8";

  const biasColor =
    data.bias === "BULLISH" ? "#4ade80"
    : data.bias === "BEARISH" ? "#f87171"
    : data.bias === "MIXED"   ? "#fbbf24"
    : "#64748b";

  const biasBg =
    data.bias === "BULLISH" ? "#052e16"
    : data.bias === "BEARISH" ? "#450a0a"
    : data.bias === "MIXED"   ? "#451a03"
    : "#1e293b";

  const biasBorder =
    data.bias === "BULLISH" ? "#14532d"
    : data.bias === "BEARISH" ? "#7f1d1d"
    : data.bias === "MIXED"   ? "#92400e"
    : "#334155";

  return (
    <div style={{
      padding: "8px 10px", borderRadius: 7, marginBottom: 6,
      background: "#0d1117",
      border: isWarning ? "1px solid #92400e" : "1px solid #1e293b",
      fontFamily: "var(--font-mono, monospace)",
    }}>
      {/* Header: label + bias badge + age */}
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 6 }}>
        <span style={{
          fontSize: 9, fontWeight: 600, color: "#475569",
          letterSpacing: "0.08em", textTransform: "uppercase",
          fontFamily: "var(--font-inter, sans-serif)",
        }}>
          Internals
        </span>

        {data.bias && (
          <span style={{
            fontSize: 9, fontWeight: 700, padding: "1px 5px",
            borderRadius: 3, background: biasBg, color: biasColor,
            border: `1px solid ${biasBorder}`, letterSpacing: "0.04em",
            fontFamily: "var(--font-inter, sans-serif)",
          }}>
            {data.bias}
          </span>
        )}

        {age !== null && (
          <span style={{
            marginLeft: "auto", fontSize: 9, fontFamily: "var(--font-inter, sans-serif)",
            color: isWarning ? "#f59e0b" : "#334155",
          }}>
            {formatAge(age)}
          </span>
        )}
      </div>

      {/* Values row */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        {data.trin !== null && (
          <div>
            <span style={{ fontSize: 9, color: "#334155" }}>TRIN </span>
            <span style={{ fontSize: 11, color: trinColor }}>
              {data.trin.toFixed(2)}
            </span>
          </div>
        )}
        {data.add !== null && (
          <div>
            <span style={{ fontSize: 9, color: "#334155" }}>ADD </span>
            <span style={{ fontSize: 11, color: addColor }}>
              {data.add > 0 ? "+" : ""}{Math.round(data.add)}
            </span>
          </div>
        )}
        {data.vold !== null && (
          <div>
            <span style={{ fontSize: 9, color: "#334155" }}>VOLD </span>
            <span style={{ fontSize: 11, color: voldColor }}>
              {data.vold > 0 ? "+" : ""}{(data.vold / 1e9).toFixed(2)}B
            </span>
          </div>
        )}
        {data.pcc !== null && (
          <div>
            <span style={{ fontSize: 9, color: "#334155" }}>PCC </span>
            <span style={{ fontSize: 11, color: pccColor }}>
              {data.pcc.toFixed(2)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
