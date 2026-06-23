"use client";

import s from "@/features/journal/styles/journalStats.module.css";

interface JournalStatsCardsProps {
  totalPnl: string;
  totalPnlColor?: string;
  winRate: string;
  winRateColor?: string;
  avgWinner: string;
  avgLoser: string;
  bestSetup: string;
  wins: number;
  losses: number;
  bestSetupPnl: string | null;
}

function Card({
  label,
  value,
  sub,
  tone = "blue",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "green" | "red" | "blue";
}) {
  return (
    <div className={s.card}>
      <div className={`${s.icon} ${s[tone]}`}>
        {tone === "red" ? "↘" : tone === "green" ? "↗" : "☆"}
      </div>
      <div>
        <div className={s.label}>{label}</div>
        <div className={`${s.value} ${s[tone]}`}>{value}</div>
        {sub && <div className={s.sub}>{sub}</div>}
      </div>
    </div>
  );
}

export default function JournalStatsCards({
  totalPnl,
  winRate,
  avgWinner,
  avgLoser,
  bestSetup,
  wins,
  losses,
  bestSetupPnl,
}: JournalStatsCardsProps) {
  return (
    <section className={s.grid}>
      <Card label="Total P&L" value={totalPnl} tone="green" />
      <Card
        label="Win Rate"
        value={winRate}
        sub={wins + losses > 0 ? `${wins}W / ${losses}L` : undefined}
        tone="green"
      />
      <Card label="Avg Winner" value={avgWinner} tone="green" />
      <Card label="Avg Loser" value={avgLoser} tone="red" />
      <Card
        label="Best Setup"
        value={bestSetup === "—" ? "No setup" : bestSetup}
        sub={bestSetupPnl ?? (bestSetup === "—" ? "Log trades to rank setups" : undefined)}
        tone="blue"
      />
    </section>
  );
}
