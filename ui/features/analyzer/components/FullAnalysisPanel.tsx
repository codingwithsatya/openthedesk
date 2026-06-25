import React from "react";
import styles from "../styles/FullAnalysisPanel.module.css";
import {
  FullAnalysisLevelItem,
  AnalysisResult,
} from "@/features/analyzer/lib/types";
import {
  cx,
  fmt,
  fmtChange,
  iconForLine,
  isRenderableLevelItem,
} from "@/features/analyzer/lib/helpers";

function toneClass(value: string): string {
  const upper = value.toUpperCase();

  if (
    upper.includes("BULL") ||
    upper.includes("BUY") ||
    upper.includes("CALL") ||
    upper.includes("READY") ||
    upper.includes("FAVORABLE") ||
    upper.includes("TAKE")
  ) {
    return styles.toneGreen;
  }

  if (
    upper.includes("BEAR") ||
    upper.includes("SELL") ||
    upper.includes("PUT") ||
    upper.includes("AVOID") ||
    upper.includes("RISK") ||
    upper.includes("HARD STOP") ||
    upper.includes("SKIP")
  ) {
    return styles.toneRed;
  }

  if (
    upper.includes("WAIT") ||
    upper.includes("HOLD") ||
    upper.includes("NEUTRAL") ||
    upper.includes("MIXED") ||
    upper.includes("MEDIUM")
  ) {
    return styles.toneYellow;
  }

  return styles.toneDefault;
}

function inlineHighlight(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|\$[\d,]+\.?\d*|₹[\d,]+\.?\d*)/g);

  return (
    <>
      {parts.map((p, i) => {
        const cleanPart = p.replace(/\*\*/g, "");

        if (p.startsWith("**") && p.endsWith("**")) {
          return (
            <strong key={i} className={styles.strongText}>
              {cleanPart}
            </strong>
          );
        }

        if (/^[$₹][\d,]+\.?\d*$/.test(cleanPart)) {
          return (
            <span key={i} className={styles.priceText}>
              {cleanPart}
            </span>
          );
        }

        return <span key={i}>{cleanPart}</span>;
      })}
    </>
  );
}

function AnalysisText({
  content,
  accent,
}: {
  content: string;
  accent: "blue" | "purple";
}) {
  return (
    <div className={styles.analysisText}>
      {content.split("\n").map((line, i) => {
        const trimmed = line.trim();

        if (!trimmed) return null;

        // Skip decorative markdown separator lines
        if (
          /^[-_—–━─\s]{3,}$/.test(trimmed) ||
          /^\|?\s*[-:| ]{3,}\s*\|?$/.test(trimmed) ||
          /^\|\s*field\s*\|\s*value\s*\|?$/i.test(trimmed) ||
          /^\|+\s*$/.test(trimmed)
        ) {
          return null;
        }

        // Markdown section titles
        if (trimmed.startsWith("##")) {
          return (
            <div
              key={i}
              className={cx(
                styles.sectionTitle,
                accent === "blue"
                  ? styles.sectionTitleBlue
                  : styles.sectionTitlePurple,
              )}
            >
              {trimmed.replace(/^#+\s*/, "")}
            </div>
          );
        }

        if (trimmed.startsWith("#")) return null;

        // Remove bullets but keep the text
        const cleaned = trimmed.replace(/^[-*•]\s+/, "");

        const tableMatch = cleaned.match(/^\|\s*([^|]+?)\s*\|\s*(.*?)\s*\|?$/);

        const normalizedLine = tableMatch
          ? `${tableMatch[1].trim()}: ${tableMatch[2].trim()}`
          : cleaned;

        // Supports:
        // VERDICT: HOLD
        // **VERDICT:** HOLD
        // **VERDICT**: HOLD
        const labelMatch = normalizedLine.match(
          /^\**([A-Z][A-Z0-9 /\-_&]{1,34})\**:\s*(.*)/,
        );

        if (labelMatch) {
          const [, label, rest] = labelMatch;
          const icon = iconForLine(label, rest);

          return (
            <div key={i} className={styles.structuredRow}>
              <div className={styles.rowIcon}>{icon}</div>

              <div className={styles.rowLabel}>{label}</div>

              <div className={cx(styles.rowValue, toneClass(rest))}>
                {inlineHighlight(rest)}
              </div>
            </div>
          );
        }

        // Convert first summary line into cleaner intro block
        const isIntroLine =
          i <= 2 &&
          (normalizedLine.includes("DTE") ||
            cleaned.includes("IV Rank") ||
            cleaned.includes("Day Trading Mode"));

        return (
          <div
            key={i}
            className={cx(styles.bodyLine, isIntroLine && styles.introLine)}
          >
            {inlineHighlight(normalizedLine)}
          </div>
        );
      })}
    </div>
  );
}

function MetricPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "green" | "red" | "blue";
}) {
  return (
    <div className={styles.metricPill}>
      <div className={styles.metricLabel}>{label}</div>
      <div
        className={cx(
          styles.metricValue,
          tone === "green" && styles.toneGreen,
          tone === "red" && styles.toneRed,
          tone === "blue" && styles.toneBlue,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function LevelPill({
  label,
  value,
  tone,
  isNow,
  near,
  ccy,
}: {
  label: string;
  value: number;
  tone: "green" | "softGreen" | "red" | "softRed" | "blue";
  isNow?: boolean;
  near?: boolean;
  ccy: string;
}) {
  return (
    <div
      className={cx(
        styles.levelPill,
        isNow && styles.levelNow,
        near && styles.levelNear,
      )}
    >
      <span className={styles.levelLabel}>{label}</span>
      <span
        className={cx(
          styles.levelValue,
          tone === "green" && styles.toneGreen,
          tone === "softGreen" && styles.toneSoftGreen,
          tone === "red" && styles.toneRed,
          tone === "softRed" && styles.toneSoftRed,
          tone === "blue" && styles.toneBlue,
        )}
      >
        {ccy}
        {value.toFixed(2)}
      </span>
    </div>
  );
}

export default function FullAnalysisPanel({
  result,
  onBack,
}: {
  result: AnalysisResult;
  onBack: () => void;
}) {
  const md = result.market_data;
  const levels = md.atr_levels;
  const ccy = md.market === "IN" ? "₹" : "$";

  const ribbon = md.ribbon_state || "MIXED";
  const isBull = ribbon === "BULLISH";
  const isBear = ribbon === "BEARISH";

  const ribbonClass = isBull
    ? styles.ribbonBullish
    : isBear
      ? styles.ribbonBearish
      : styles.ribbonMixed;

  return (
    <div className={cx(styles.fullAnalysisPanel, ribbonClass)}>
      <div className={styles.topBar}>
        <div>
          <div className={styles.eyebrow}>Analyzer · Full Analysis</div>
          <div className={styles.decisionTitle}>
            {result.ticker} Decision Brief
          </div>
        </div>

        <button type="button" onClick={onBack} className={styles.backButton}>
          ← Back to Analyzer
        </button>
      </div>

      <div className={styles.heroHeader}>
        <div>
          <div className={styles.badgeRow}>
            <span className={styles.marketBadge}>{md.market}</span>
            <span className={cx(styles.ribbonBadge, ribbonClass)}>
              {ribbon}
            </span>

            {md.has_options != null && (
              <span
                className={cx(
                  styles.optionsBadge,
                  md.has_options
                    ? styles.optionsAvailable
                    : styles.optionsUnavailable,
                )}
              >
                {md.has_options ? "Options Available" : "No Options"}
              </span>
            )}
          </div>

          <div className={styles.priceRow}>
            <h2 className={styles.ticker}>{md.ticker}</h2>

            <div className={styles.currentPrice}>
              {ccy}
              {fmt(md.price)}
            </div>

            <div
              className={cx(
                styles.changePct,
                (md.change_pct ?? 0) >= 0 ? styles.toneGreen : styles.toneRed,
              )}
            >
              {fmtChange(md.change_pct)}
            </div>
          </div>

          <div className={styles.heroSubtext}>
            Decision brief combining intraday 0DTE execution context with
            longer-term stock structure.
          </div>
        </div>

        <div className={styles.heroMetrics}>
          <MetricPill
            label="52W Distance"
            value={
              md.price_vs_52w_high_pct != null
                ? `${Math.abs(md.price_vs_52w_high_pct).toFixed(1)}%`
                : "—"
            }
            tone={
              md.price_vs_52w_high_pct != null && md.price_vs_52w_high_pct >= -5
                ? "red"
                : undefined
            }
          />

          <MetricPill
            label="Rel Volume"
            value={
              md.relative_volume != null
                ? `${md.relative_volume.toFixed(1)}x`
                : "—"
            }
            tone={
              md.relative_volume != null && md.relative_volume >= 1.5
                ? "green"
                : undefined
            }
          />

          <MetricPill label="ATR-14" value={fmt(md.atr_14)} tone="blue" />
        </div>
      </div>

      {levels &&
        (() => {
          const levelItems: FullAnalysisLevelItem[] = [
            {
              label: "GG Complete ▲",
              val: levels.gg_complete_up,
              tone: "green",
            },
            {
              label: "Trigger ▲",
              val: levels.trigger_up,
              tone: "softGreen",
            },
            {
              label: "Now",
              val: md.price,
              tone: "blue",
              isNow: true,
            },
            {
              label: "Trigger ▼",
              val: levels.trigger_down,
              tone: "softRed",
            },
            {
              label: "GG Complete ▼",
              val: levels.gg_complete_down,
              tone: "red",
            },
          ];

          return (
            <div className={styles.levelsStrip}>
              <div className={styles.levelsTitle}>Key Levels</div>

              {levelItems.filter(isRenderableLevelItem).map((item) => {
                const near =
                  !item.isNow &&
                  md.price != null &&
                  md.atr_14 != null &&
                  Math.abs(md.price - item.val) < md.atr_14 * 0.12;

                return (
                  <LevelPill
                    key={item.label}
                    label={item.label}
                    value={item.val}
                    tone={item.tone}
                    isNow={item.isNow}
                    near={near}
                    ccy={ccy}
                  />
                );
              })}
            </div>
          );
        })()}

      <div className={styles.panelGrid}>
        <div className={cx(styles.analysisCard, styles.optionsCard)}>
          <div className={styles.cardHeader}>
            <div className={cx(styles.cardIcon, styles.cardIconBlue)}>⚡</div>

            <div className={styles.cardTitleBlock}>
              <div className={styles.cardTitleBlue}>
                0DTE Options Trade Plan
              </div>
              <div className={styles.cardSubtitle}>
                Intraday execution, stops, targets, and risk filter
              </div>
            </div>

            <span className={cx(styles.modelBadge, styles.modelBadgeBlue)}>
              HAIKU
            </span>
          </div>

          <AnalysisText content={result.short_term} accent="blue" />
        </div>

        <div className={cx(styles.analysisCard, styles.stockCard)}>
          <div className={styles.cardHeader}>
            <div className={cx(styles.cardIcon, styles.cardIconPurple)}>📊</div>

            <div className={styles.cardTitleBlock}>
              <div className={styles.cardTitlePurple}>
                Long-Term Stock Analysis
              </div>
              <div className={styles.cardSubtitle}>
                Investor structure, fundamentals, valuation, and risk
              </div>
            </div>

            <span className={cx(styles.modelBadge, styles.modelBadgePurple)}>
              SONNET
            </span>
          </div>

          <AnalysisText content={result.long_term} accent="purple" />
        </div>
      </div>

      <div className={styles.fundamentalsStrip}>
        {[
          {
            label: "PE Ratio",
            value: md.pe_ratio != null ? md.pe_ratio.toFixed(1) : "—",
          },
          {
            label: "EPS Growth",
            value:
              md.eps_growth_yoy != null
                ? `${md.eps_growth_yoy >= 0 ? "+" : ""}${md.eps_growth_yoy.toFixed(1)}%`
                : "—",
          },
          {
            label: "Revenue",
            value:
              md.revenue_growth_yoy != null
                ? `${md.revenue_growth_yoy >= 0 ? "+" : ""}${md.revenue_growth_yoy.toFixed(1)}%`
                : "—",
          },
          {
            label: "Mkt Cap",
            value: md.market_cap != null ? `${md.market_cap}B` : "—",
          },
          {
            label: "Sector",
            value: md.sector || "—",
          },
          {
            label: "Beta",
            value: md.beta != null ? md.beta.toFixed(2) : "—",
          },
          ...(md.market === "US" && md.iv_rank != null
            ? [{ label: "IV Rank", value: md.iv_rank.toFixed(0) }]
            : []),
          ...(md.earnings_date
            ? [
                {
                  label: "Earnings",
                  value:
                    md.days_to_earnings != null
                      ? `${md.earnings_date} · ${md.days_to_earnings}d`
                      : md.earnings_date,
                  warning:
                    md.days_to_earnings != null && md.days_to_earnings <= 7,
                },
              ]
            : []),
        ].map(({ label, value, warning }) => (
          <div key={label} className={styles.fundamentalItem}>
            <div className={styles.fundamentalLabel}>{label}</div>
            <div
              className={cx(styles.fundamentalValue, warning && styles.toneRed)}
              title={value}
            >
              {value}
            </div>
          </div>
        ))}
      </div>

      <div className={styles.emaStrip}>
        {[
          { label: "EMA 8", val: md.ema_8 },
          { label: "EMA 21", val: md.ema_21 },
          { label: "EMA 48", val: md.ema_48 },
          { label: "EMA 200", val: md.ema_200 },
          { label: "ATR-14", val: md.atr_14 },
        ].map(({ label, val }) => (
          <div key={label} className={styles.emaItem}>
            <span className={styles.emaLabel}>{label}</span>
            <span className={styles.emaValue}>{fmt(val)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
