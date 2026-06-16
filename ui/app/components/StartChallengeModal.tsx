"use client";
import { useState } from "react";
import { useAuth } from "@clerk/nextjs";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StartChallengeModalProps {
  onStarted: () => void;
  onClose: () => void;
}

export default function StartChallengeModal({ onStarted, onClose }: StartChallengeModalProps) {
  const { getToken } = useAuth();
  const [name, setName] = useState("90-Day Challenge");
  const [startBalance, setStartBalance] = useState("500");
  const [monthlyTarget, setMonthlyTarget] = useState("1000");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    setSaving(true);
    setError("");
    try {
      const token = await getToken();
      const res = await fetch(`${API}/challenge/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          name: name.trim() || "90-Day Challenge",
          start_balance: parseFloat(startBalance) || 500,
          monthly_target: parseFloat(monthlyTarget) || 1000,
        }),
      });
      if (res.status === 409) {
        setError("An active challenge already exists.");
        return;
      }
      if (!res.ok) throw new Error(await res.text());
      onStarted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        style={{
          background: "#0d1320",
          border: "1px solid #1e3a5f",
          borderRadius: 12,
          padding: "28px 32px",
          width: 420,
          maxWidth: "90vw",
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>
          Start 90-Day Challenge
        </div>
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 24 }}>
          Phase 2 · $500 account · 90 trading days
        </div>

        {/* Rules reminder */}
        <div
          style={{
            background: "#090e1a",
            border: "1px solid #1e3a5f",
            borderRadius: 8,
            padding: "12px 14px",
            marginBottom: 24,
            fontSize: 11,
            color: "#64748b",
            lineHeight: 1.6,
          }}
        >
          <div style={{ fontWeight: 700, color: "#475569", marginBottom: 6, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em" }}>
            Phase 2 Rules
          </div>
          Max 1 contract · Premium $3–4 range · A/A+ setups only<br />
          Max loss −$150/session · Max 3 trades/day<br />
          Dollar stop = premium paid − $1.00 (always honored)
        </div>

        {/* Fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5 }}>
              Challenge name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: "100%",
                background: "#0a0e1a",
                border: "1px solid #1e3a5f",
                borderRadius: 6,
                color: "#f1f5f9",
                fontSize: 13,
                padding: "8px 10px",
                boxSizing: "border-box",
                fontFamily: "var(--font-inter), sans-serif",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5 }}>
                Starting balance ($)
              </label>
              <input
                type="number"
                value={startBalance}
                onChange={(e) => setStartBalance(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0a0e1a",
                  border: "1px solid #1e3a5f",
                  borderRadius: 6,
                  color: "#f1f5f9",
                  fontSize: 13,
                  padding: "8px 10px",
                  boxSizing: "border-box",
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: "block", fontSize: 11, color: "#64748b", marginBottom: 5 }}>
                Monthly target ($)
              </label>
              <input
                type="number"
                value={monthlyTarget}
                onChange={(e) => setMonthlyTarget(e.target.value)}
                style={{
                  width: "100%",
                  background: "#0a0e1a",
                  border: "1px solid #1e3a5f",
                  borderRadius: 6,
                  color: "#f1f5f9",
                  fontSize: 13,
                  padding: "8px 10px",
                  boxSizing: "border-box",
                  fontFamily: "var(--font-jetbrains-mono), monospace",
                }}
              />
            </div>
          </div>
        </div>

        {error && (
          <div style={{ fontSize: 11, color: "#f87171", marginTop: 12 }}>{error}</div>
        )}

        <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: 7,
              background: saving ? "#1e3a5f" : "#1e40af",
              color: saving ? "#64748b" : "#fff",
              border: "none",
              cursor: saving ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "var(--font-inter), sans-serif",
            }}
          >
            {saving ? "Starting..." : "Start Challenge"}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: "10px 18px",
              borderRadius: 7,
              background: "transparent",
              color: "#64748b",
              border: "1px solid #1e3a5f",
              cursor: "pointer",
              fontSize: 13,
              fontFamily: "var(--font-inter), sans-serif",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
