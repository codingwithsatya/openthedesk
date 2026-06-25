"use client";

import { useState } from "react";
import { useAuth } from "@clerk/nextjs";
import s from "@/features/challenge/styles/StartChallengeModal.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface StartChallengeModalProps {
  onStarted: () => void;
  onClose: () => void;
}

export default function StartChallengeModal({
  onStarted,
  onClose,
}: StartChallengeModalProps) {
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

      if (!res.ok) {
        throw new Error(await res.text());
      }

      onStarted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to start — try again");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={s.backdrop}
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) {
          onClose();
        }
      }}
    >
      <div className={s.dialog} role="dialog" aria-modal="true">
        <button
          type="button"
          className={s.closeButton}
          onClick={onClose}
          disabled={saving}
          aria-label="Close start challenge modal"
        >
          ×
        </button>

        <div className={s.header}>
          <div className={s.iconBox} aria-hidden="true">
            <svg
              width="30"
              height="30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M8 21h8m-4-4v4M7 3H5a2 2 0 00-2 2v3c0 2.76 2.24 5 5 5h.1M17 3h2a2 2 0 012 2v3c0 2.76-2.24 5-5 5h-.1M7 3h10v5a5 5 0 01-10 0V3z" />
            </svg>
          </div>

          <div>
            <h2 className={s.heading}>Start 90-Day Challenge</h2>
            <p className={s.subheading}>
              $500 account · 90 trading days · Process first
            </p>
          </div>
        </div>

        <div className={s.rulesBox}>
          <div className={s.rulesIcon} aria-hidden="true">
            <svg
              width="34"
              height="34"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6l7-3z" />
              <path d="M9 12l2 2 4-5" />
            </svg>
          </div>

          <div>
            <div className={s.rulesLabel}>Challenge Rules</div>
            <ul className={s.rulesList}>
              <li>Max 1 contract · A/A+ setups only</li>
              <li>Max loss −$150 per session · Max 3 trades/day</li>
              <li>Dollar stop = premium paid − $1.00</li>
            </ul>
          </div>
        </div>

        <div className={s.fields}>
          <label className={s.fieldGroup}>
            <span className={s.fieldLabel}>Challenge name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={s.input}
            />
          </label>

          <div className={s.fieldRow}>
            <label className={s.fieldGroup}>
              <span className={s.fieldLabel}>Starting balance ($)</span>
              <input
                type="number"
                value={startBalance}
                onChange={(e) => setStartBalance(e.target.value)}
                className={`${s.input} ${s.numberInput}`}
              />
            </label>

            <label className={s.fieldGroup}>
              <span className={s.fieldLabel}>Monthly target ($)</span>
              <input
                type="number"
                value={monthlyTarget}
                onChange={(e) => setMonthlyTarget(e.target.value)}
                className={`${s.input} ${s.numberInput}`}
              />
            </label>
          </div>
        </div>

        <div className={s.commitBox}>
          <div>
            <strong>You are committing to 90 trading days.</strong>
            <span>Follow the rules. Let process lead P&amp;L.</span>
          </div>
        </div>

        {error && <div className={s.errorText}>{error}</div>}

        <div className={s.btnRow}>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className={s.primaryButton}
          >
            {saving ? (
              "Starting..."
            ) : (
              <>
                <span className={s.rocketIcon} aria-hidden="true">
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4.5 16.5c-1 1.8-1.2 3.4-.7 3.9.5.5 2.1.3 3.9-.7" />
                    <path d="M9 15l-3-3 5.5-5.5c2.4-2.4 5.4-3.6 8.8-3.5.1 3.4-1.1 6.4-3.5 8.8L12 18l-3-3Z" />
                    <path d="M14.5 6.5l3 3" />
                    <path d="M8 16l-2 2" />
                  </svg>
                </span>
                Start Challenge
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={s.secondaryButton}
          >
            Cancel
          </button>
        </div>

        <div className={s.footerNotes}>
          <div>
            <strong>90 Days</strong>
            <span>Build consistency</span>
          </div>
          <div>
            <strong>Process First</strong>
            <span>P&amp;L follows</span>
          </div>
          <div>
            <strong>Earn the Right</strong>
            <span>Scale with proof</span>
          </div>
        </div>
      </div>
    </div>
  );
}
