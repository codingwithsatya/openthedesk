"use client";

import { Line, Bar } from "react-chartjs-2";
import s from "@/features/journal/styles/journalCharts.module.css";

interface JournalChartsProps {
  stats: {
    equity_curve: number[];
  } | null;
  equityData: any;
  setupData: any;
  hourData: any;
  chartOptions: any;
  barOptions: any;
  setupLabels: string[];
}

function ChartCard({
  title,
  wide,
  children,
}: {
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`${s.card} ${wide ? s.cardWide : ""}`}>
      <div className={s.title}>{title}</div>
      <div className={s.chart}>{children}</div>
    </div>
  );
}

export default function JournalCharts({
  stats,
  equityData,
  setupData,
  hourData,
  chartOptions,
  barOptions,
  setupLabels,
}: JournalChartsProps) {
  return (
    <section className={s.grid}>
      <ChartCard title="Cumulative P&L" wide>
        {stats && stats.equity_curve.length > 0 ? (
          <Line data={equityData} options={chartOptions} />
        ) : (
          <div className={s.empty}>No data</div>
        )}
      </ChartCard>

      <ChartCard title="P&L by Setup">
        {setupLabels.length > 0 ? (
          <Bar data={setupData} options={chartOptions} />
        ) : (
          <div className={s.empty}>No data</div>
        )}
      </ChartCard>

      <ChartCard title="Win % by Hour">
        {stats ? (
          <Bar data={hourData} options={barOptions} />
        ) : (
          <div className={s.empty}>No data</div>
        )}
      </ChartCard>
    </section>
  );
}
