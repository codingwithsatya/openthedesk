import type { ScreenerRow } from "@/features/analyzer/lib/types";
import { cx, fmt, fmtChange } from "@/features/analyzer/lib/helpers";
import { RibbonBadge } from "@/features/analyzer/components/AnalyzerTickerCard";
import styles from "@/features/analyzer/styles/AnalyzerDashboard.module.css";

export function ScreenerColumn({
  title,
  setups,
  currency,
  onRowClick,
}: {
  title: string;
  setups: ScreenerRow[];
  currency: string;
  onRowClick: (t: string) => void;
}) {
  return (
    <div className={styles.screenerCard}>
      <div className={styles.screenerHeader}>
        {title}
        {setups.length > 0 && ` (${setups.length})`}
      </div>

      {setups.length === 0 ? (
        <div className={styles.emptySetups}>No clean setups</div>
      ) : (
        setups.map((s) => (
          <ScreenerRowButton
            key={s.ticker}
            row={s}
            currency={currency}
            onClick={onRowClick}
          />
        ))
      )}
    </div>
  );
}

function ScreenerRowButton({
  row,
  currency,
  onClick,
}: {
  row: ScreenerRow;
  currency: string;
  onClick: (t: string) => void;
}) {
  return (
    <button onClick={() => onClick(row.ticker)} className={styles.screenerRow}>
      <span className={styles.screenerTicker}>{row.ticker}</span>

      <RibbonBadge state={row.ribbon_state} />

      <span className={styles.screenerPrice}>
        {currency}
        {fmt(row.price)}
      </span>

      <span
        className={cx(
          styles.screenerChange,
          (row.change_pct ?? 0) >= 0 ? styles.positive : styles.negative,
        )}
      >
        {fmtChange(row.change_pct)}
      </span>

      <span className={styles.screenerSector}>{row.sector ?? ""}</span>
    </button>
  );
}
