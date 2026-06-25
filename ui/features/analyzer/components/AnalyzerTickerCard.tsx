import type { WatchlistTicker } from "@/features/analyzer/lib/types";
import Image from "next/image";
import {
  cx,
  fmt,
  fmtChange,
  getLightRibbonTheme,
  getPoBarState,
  getRibbonTheme,
  getTickerLogo,
} from "@/features/analyzer/lib/helpers";
import styles from "@/features/analyzer/styles/AnalyzerDashboard.module.css";

export function RibbonBadge({ state }: { state: string | null }) {
  const c = getLightRibbonTheme(state);

  return (
    <span
      style={{
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase" as const,
        background: c.bg,
        color: c.color,
        border: `1px solid ${c.border}`,
      }}
    >
      {state || "MIXED"}
    </span>
  );
}

export function TickerCard({
  t,
  selected,
  onQuickRead,
}: {
  t: WatchlistTicker;
  selected: boolean;
  onQuickRead: () => void;
}) {
  const ribbonTheme = getRibbonTheme(t.ribbon_state);
  const poBar = getPoBarState(t.po_value);
  const logoSrc = getTickerLogo(t.ticker);

  return (
    <div
      className={cx(styles.tickerCard, selected && styles.tickerCardSelected)}
    >
      <div className={styles.tickerCardInner} onClick={onQuickRead}>
        <div className={styles.tickerTop}>
          <div className={styles.tickerIdentity}>
            <div className={styles.tickerLogo}>
              {logoSrc ? (
                <Image
                  src={logoSrc}
                  alt={`${t.ticker} logo`}
                  width={26}
                  height={26}
                  className={styles.tickerLogoImg}
                />
              ) : (
                <span className={styles.tickerLogoFallback}>
                  {t.ticker.slice(0, 1)}
                </span>
              )}
            </div>

            <span className={styles.tickerSymbol}>{t.ticker}</span>
          </div>

          <span
            className={styles.ribbonMini}
            style={{
              background: ribbonTheme.bg,
              color: ribbonTheme.color,
              border: `1px solid ${ribbonTheme.border}`,
            }}
          >
            {t.ribbon_state}
          </span>

          {t.zero_dte_eligible && (
            <span className={styles.zeroDteBadge}>0DTE</span>
          )}

          {t.compression && <span className={styles.compressionRing} />}
        </div>

        <div className={styles.priceLine}>
          <span className={styles.cardPrice}>${fmt(t.price)}</span>
          <span
            className={cx(
              styles.cardChange,
              (t.change_pct ?? 0) >= 0 ? styles.positive : styles.negative,
            )}
          >
            {fmtChange(t.change_pct)}
          </span>
        </div>

        <div className={styles.triggerGrid}>
          <div className={styles.triggerBox}>
            <div className={styles.triggerLabel}>BULL ABOVE</div>
            <div className={cx(styles.triggerValue, styles.greenText)}>
              ${fmt(t.call_trigger)}
            </div>
          </div>

          <div className={styles.triggerBox}>
            <div className={styles.triggerLabel}>BEAR BELOW</div>
            <div className={cx(styles.triggerValue, styles.redText)}>
              ${fmt(t.put_trigger)}
            </div>
          </div>
        </div>

        <div className={styles.poBar}>
          <div
            className={cx(
              styles.poBarFill,
              poBar.className === "po-bar-fill-bull"
                ? styles.poBarBull
                : styles.poBarBear,
            )}
            style={{
              width: `${poBar.fill}%`,
              left: poBar.capped >= 0 ? "50%" : `${50 - poBar.fill}%`,
            }}
          />
        </div>

        <div
          className={cx(
            styles.quickReadText,
            selected && styles.quickReadTextSelected,
          )}
        >
          {selected ? "⚡ Quick Read Open" : "⚡ Quick Read"}
        </div>
      </div>
    </div>
  );
}
