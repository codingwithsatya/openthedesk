import React from "react";
import type { WatchlistTicker } from "@/features/analyzer/lib/types";
import { cx, fmtChange, getTickerEmoji } from "@/features/analyzer/lib/helpers";
import styles from "@/features/analyzer/styles/AnalyzerDashboard.module.css";

export function QuickAnalysisPanel({
  ticker,
  quickRead,
  loading,
  analyzingTicker,
  onFullAnalysis,
}: {
  ticker: WatchlistTicker;
  quickRead: string | null;
  loading: boolean;
  analyzingTicker: string | null;
  onFullAnalysis: () => void;
}) {
  const lines = quickRead?.split("\n").filter((line) => line.trim()) ?? [];

  const isRunningFullAnalysis = analyzingTicker === ticker.ticker;

  const biasLine =
    lines.find((line) => line.toUpperCase().startsWith("BIAS:")) ??
    `BIAS: ${ticker.ribbon_state}`;

  const upperLines = lines.map((line) => line.toUpperCase());

  const bullStart = upperLines.findIndex((line) => line.includes("BULL ABOVE"));
  const bearStart = upperLines.findIndex((line) => line.includes("BEAR BELOW"));
  const notesStart = upperLines.findIndex(
    (line) =>
      line.includes("IV NOTE") ||
      line.includes("PREMIUM") ||
      line.includes("NOTE"),
  );

  const bullLines =
    bullStart >= 0
      ? lines.slice(
          bullStart,
          bearStart > bullStart
            ? bearStart
            : notesStart > bullStart
              ? notesStart
              : bullStart + 5,
        )
      : [];

  const nextBullAfterBear = upperLines.findIndex(
    (line, index) => index > bearStart && line.includes("BULL ABOVE"),
  );

  const bearEnd =
    nextBullAfterBear > bearStart
      ? nextBullAfterBear
      : notesStart > bearStart
        ? notesStart
        : bearStart + 5;

  const bearLines = bearStart >= 0 ? lines.slice(bearStart, bearEnd) : [];

  const notes =
    notesStart >= 0
      ? lines.slice(notesStart)
      : lines.filter(
          (line) =>
            !bullLines.includes(line) &&
            !bearLines.includes(line) &&
            line !== biasLine,
        );

  function PanelTitle({
    children,
    tone,
  }: {
    children: React.ReactNode;
    tone: "red" | "green" | "blue" | "neutral";
  }) {
    return (
      <div
        className={cx(
          styles.quickPanelTitle,
          tone === "red" && styles.quickPanelTitleRed,
          tone === "green" && styles.quickPanelTitleGreen,
          tone === "blue" && styles.quickPanelTitleBlue,
          tone === "neutral" && styles.quickPanelTitleNeutral,
        )}
      >
        {children}
      </div>
    );
  }

  function LineList({
    items,
    fallback,
    muted = false,
  }: {
    items: string[];
    fallback: string[];
    muted?: boolean;
  }) {
    const list = items.length ? items : fallback;

    return (
      <div className={styles.quickLineList}>
        {list.map((line, index) => (
          <div
            key={`${line}-${index}`}
            className={cx(styles.quickText, muted && styles.quickTextMuted)}
          >
            {line}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={styles.quickPanel}>
      {loading ? (
        <div className={styles.quickLoading}>
          <div
            className={styles.quickSkeletonLine}
            style={{ width: "28%", height: 14 }}
          />
          <div
            className={styles.quickSkeletonLine}
            style={{ width: "70%", height: 11 }}
          />
          <div
            className={styles.quickSkeletonLine}
            style={{ width: "55%", height: 11 }}
          />
          <div
            className={styles.quickSkeletonLine}
            style={{ width: "80%", height: 11 }}
          />
        </div>
      ) : (
        <>
          <div className={styles.quickGrid}>
            <div className={styles.quickCell}>
              <PanelTitle tone="red">Bias</PanelTitle>
              <div className={styles.quickBiasEmoji}>
                {getTickerEmoji(ticker.ribbon_state)}
              </div>
              <div className={styles.quickText}>{biasLine}</div>
            </div>

            <div className={styles.quickCell}>
              <PanelTitle tone="green">
                Bull Above: ${ticker.call_trigger?.toFixed(2) ?? "—"}
              </PanelTitle>
              <LineList
                items={bullLines}
                fallback={[
                  `Entry: above ${ticker.call_trigger?.toFixed(2) ?? "—"}`,
                  `T1: ${ticker.gg_open_call?.toFixed(2) ?? "—"}`,
                  `Stop: below ${ticker.call_trigger?.toFixed(2) ?? "—"}`,
                ]}
                muted
              />
            </div>

            <div className={styles.quickCell}>
              <PanelTitle tone="red">
                Bear Below: ${ticker.put_trigger?.toFixed(2) ?? "—"}
              </PanelTitle>
              <LineList
                items={bearLines}
                fallback={[
                  `Entry: below ${ticker.put_trigger?.toFixed(2) ?? "—"}`,
                  `T1: ${ticker.gg_open_put?.toFixed(2) ?? "—"}`,
                  `Stop: above ${ticker.put_trigger?.toFixed(2) ?? "—"}`,
                ]}
                muted
              />
            </div>

            <div className={styles.quickCell}>
              <PanelTitle tone="neutral">Quick Notes</PanelTitle>
              <LineList
                items={notes.slice(0, 4)}
                fallback={[
                  `PO: ${ticker.po_value?.toFixed(1) ?? "—"}`,
                  ticker.compression
                    ? "Compression active"
                    : "No compression flag",
                  `Volume: ${ticker.volume_ratio?.toFixed(2) ?? "—"}x`,
                ]}
                muted
              />
            </div>
          </div>

          <div className={styles.quickMetaGrid}>
            <div className={styles.quickMetaBlock}>
              <PanelTitle tone="blue">Premium Estimate</PanelTitle>
              <div className={styles.quickPremiumValue}>$1.80-$2.10</div>
              <div className={styles.quickMetaText}>
                Spread recommended to cap risk.
              </div>
            </div>

            <div className={styles.quickMetaBlock}>
              <PanelTitle tone="neutral">Key Level Context</PanelTitle>

              <div className={styles.quickMetricGrid}>
                {[
                  ["📈", "ATR", ticker.atr_14?.toFixed(2) ?? "—"],
                  ["〽️", "PO", ticker.po_value?.toFixed(1) ?? "—"],
                  [
                    "▮▮▮",
                    "Volume",
                    `${ticker.volume_ratio?.toFixed(2) ?? "—"}x`,
                  ],
                  ["↔", "Change", fmtChange(ticker.change_pct)],
                ].map(([icon, label, value]) => (
                  <div key={label} className={styles.quickMetricItem}>
                    <div className={styles.quickMetricIcon}>{icon}</div>

                    <div className={styles.quickMetricCopy}>
                      <div className={styles.quickMetricLabel}>{label}</div>
                      <div className={styles.quickMetricValue}>{value}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.quickButtonWrap}>
            <button
              onClick={onFullAnalysis}
              disabled={isRunningFullAnalysis}
              className={styles.quickFullButton}
            >
              {isRunningFullAnalysis
                ? "Running Full Analysis..."
                : "Full Analysis →"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
