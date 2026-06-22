"use client";
import s from "@/features/challenge/styles/challengeLanding.module.css";

const CoinsIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="8" cy="8" r="6" />
    <path d="M18.09 10.37A6 6 0 1110.34 18" />
    <path d="M7 6h1v4" />
    <path d="M16.71 13.88l.7.71-2.82 2.82" />
  </svg>
);
const CandleIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 5v4m6-4v4M9 15v4m6-4v4M5 9h4v6H5zM15 9h4v6h-4z" />
  </svg>
);
const ShieldIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z" />
  </svg>
);
const StarIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 24 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
const ProcessIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);
const TradesIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const RULES = [
  { Icon: CoinsIcon, label: "Starting balance", value: "$500", tint: null },
  { Icon: CandleIcon, label: "Premium range", value: "$3 – $4", tint: null },
  {
    Icon: ShieldIcon,
    label: "Max loss / session",
    value: "–$150",
    tint: "loss" as const,
  },
  {
    Icon: StarIcon,
    label: "Setups only",
    value: "A / A+",
    tint: "green" as const,
  },
  {
    Icon: TradesIcon,
    label: "Max trades / day",
    value: "3 trades",
    tint: null,
  },
  { Icon: ProcessIcon, label: "Focus", value: "Process > P&L", tint: null },
];

export default function ChallengeRuleCards() {
  return (
    <div className={s.rulesGrid}>
      {RULES.map(({ Icon, label, value, tint }) => (
        <div key={label} className={s.rulesCard}>
          <div className={`${s.rulesIconWrap}${tint ? ` ${s[tint]}` : ""}`}>
            <Icon />
          </div>

          <div className={s.rulesText}>
            <div className={s.rulesLabel}>{label}</div>
            <div className={`${s.rulesValue}${tint ? ` ${s[tint]}` : ""}`}>
              {value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
