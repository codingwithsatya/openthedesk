import type {
  ScreenerData,
  WatchlistData,
  WatchlistTicker,
} from "@/features/analyzer/lib/types";
import { fmt, fmtChange } from "@/features/analyzer/lib/helpers";
import styles from "@/features/analyzer/styles/AnalyzerDashboard.module.css";

function marketLabel(ticker: string) {
  const map: Record<string, string> = {
    SPY: "SPY",
    QQQ: "QQQ",
    SMH: "SMH",
    XLK: "XLK",
    XLF: "XLF",
  };

  return map[ticker] || ticker;
}

function SnapshotRow({ item }: { item: WatchlistTicker }) {
  const positive = (item.change_pct ?? 0) >= 0;

  return (
    <div className={styles.railRow}>
      <div className={styles.railSymbol}>{marketLabel(item.ticker)}</div>
      <div className={styles.railPrice}>${fmt(item.price)}</div>
      <div className={positive ? styles.positive : styles.negative}>
        {fmtChange(item.change_pct)}
      </div>
    </div>
  );
}

export function AnalyzerRightRail({
  watchlist,
  screener,
}: {
  watchlist: WatchlistData | null;
  screener: ScreenerData | null;
}) {
  const context = watchlist?.context ?? [];

  const bullish =
    (screener?.us_setups ?? []).filter((s) => s.ribbon_state === "BULLISH")
      .length +
    (screener?.india_setups ?? []).filter((s) => s.ribbon_state === "BULLISH")
      .length;

  const bearish =
    (screener?.us_setups ?? []).filter((s) => s.ribbon_state === "BEARISH")
      .length +
    (screener?.india_setups ?? []).filter((s) => s.ribbon_state === "BEARISH")
      .length;

  const total =
    (screener?.us_setups?.length ?? 0) + (screener?.india_setups?.length ?? 0);

  const mixed = Math.max(total - bullish - bearish, 0);

  const sectorRows = [
    {
      label: "Technology",
      value: bullish >= bearish ? 72 : 42,
      change: "+1.24%",
    },
    { label: "Comm. Services", value: 62, change: "+0.87%" },
    { label: "Financials", value: 48, change: "+0.32%" },
    { label: "Consumer Cyclical", value: 34, change: "-0.11%" },
    { label: "Energy", value: 28, change: "-0.53%" },
    { label: "Healthcare", value: 25, change: "-0.61%" },
  ];

  return (
    <aside className={styles.rightRail}>
      <section className={styles.railCard}>
        <div className={styles.railTitle}>Market Snapshot</div>

        <div className={styles.railList}>
          {context.slice(0, 6).map((item) => (
            <SnapshotRow key={item.ticker} item={item} />
          ))}
        </div>

        <div className={styles.railFooter}>
          <span>Live watchlist context</span>
          <span className={styles.marketOpenDot}>● Market Open</span>
        </div>
      </section>

      <section className={styles.railCard}>
        <div className={styles.railTitle}>Sector Momentum</div>

        <div className={styles.sectorList}>
          {sectorRows.map((row) => {
            const positive = row.change.startsWith("+");

            return (
              <div key={row.label} className={styles.sectorRow}>
                <div className={styles.sectorTop}>
                  <span>{row.label}</span>
                  <span
                    className={positive ? styles.positive : styles.negative}
                  >
                    {row.change}
                  </span>
                </div>

                <div className={styles.sectorBarTrack}>
                  <div
                    className={
                      positive
                        ? styles.sectorBarPositive
                        : styles.sectorBarNegative
                    }
                    style={{ width: `${row.value}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className={styles.railCard}>
        <div className={styles.railTitle}>Scanner Summary</div>

        <div className={styles.summaryRows}>
          <div className={styles.summaryRow}>
            <span className={styles.positive}>Bullish</span>
            <strong>{bullish}</strong>
          </div>

          <div className={styles.summaryRow}>
            <span className={styles.mixedText}>Mixed</span>
            <strong>{mixed}</strong>
          </div>

          <div className={styles.summaryRow}>
            <span className={styles.negative}>Bearish</span>
            <strong>{bearish}</strong>
          </div>

          <div className={styles.summaryTotal}>
            <span>Total</span>
            <strong>{total}</strong>
          </div>
        </div>
      </section>
    </aside>
  );
}
