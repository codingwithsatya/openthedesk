import React, { useEffect, useState } from "react";
import { useAuth } from "@clerk/nextjs";

import type {
  QuickReadResult,
  WatchlistData,
  WatchlistTicker,
} from "@/features/analyzer/lib/types";

import { TickerCard } from "@/features/analyzer/components/AnalyzerTickerCard";
import { QuickAnalysisPanel } from "@/features/analyzer/components/QuickAnalysisPanel";
import styles from "@/features/analyzer/styles/AnalyzerDashboard.module.css";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function WatchlistPanel({
  onAnalyze,
  analyzingTicker,
  onDataLoaded,
}: {
  onAnalyze: (t: string) => void;
  analyzingTicker: string | null;
  onDataLoaded: (data: WatchlistData) => void;
}) {
  const { getToken } = useAuth();
  const [data, setData] = useState<WatchlistData | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selectedQuickTicker, setSelectedQuickTicker] =
    useState<WatchlistTicker | null>(null);
  const [quickReads, setQuickReads] = useState<Record<string, string>>({});
  const [loadingQuick, setLoadingQuick] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const token = await getToken();
        const headers: Record<string, string> = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const r = await fetch(`${API}/watchlist`, { headers });
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json: WatchlistData = await r.json();
        setData(json);
        onDataLoaded?.(json);
      } catch (e) {
        setErr(e instanceof Error ? e.message : "Failed to load watchlist");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleToggle = async (t: WatchlistTicker) => {
    if (selectedQuickTicker?.ticker === t.ticker) {
      setSelectedQuickTicker(null);
      return;
    }

    setSelectedQuickTicker(t);
    if (quickReads[t.ticker]) return;
    setLoadingQuick((prev) => ({ ...prev, [t.ticker]: true }));
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const body: QuickReadResult & Record<string, unknown> = {
        ticker: t.ticker,
        quick_read: "",
        price: t.price ?? 0,
        ribbon_state: t.ribbon_state,
        compression: t.compression,
        po_value: t.po_value ?? 0,
        call_trigger: t.call_trigger ?? 0,
        put_trigger: t.put_trigger ?? 0,
        gg_open_call: t.gg_open_call ?? 0,
        gg_open_put: t.gg_open_put ?? 0,
        atr_14: t.atr_14 ?? 0,
        change_pct: t.change_pct ?? 0,
      };
      const r = await fetch(`${API}/quick-analyze`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const d: QuickReadResult = await r.json();
      setQuickReads((prev) => ({ ...prev, [t.ticker]: d.quick_read }));
    } catch (e) {
      setQuickReads((prev) => ({
        ...prev,
        [t.ticker]: "Failed to load quick read. Try again.",
      }));
    } finally {
      setLoadingQuick((prev) => ({ ...prev, [t.ticker]: false }));
    }
  };

  if (loading) {
    return (
      <div className={styles.watchlistWrap}>
        <div className={styles.watchlistGrid}>
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className={styles.skeletonCard}>
              <div
                className={styles.skeletonBox}
                style={{ width: "40%", height: 12, marginBottom: 10 }}
              />
              <div
                className={styles.skeletonBox}
                style={{ width: "55%", height: 10, marginBottom: 10 }}
              />
              <div
                className={styles.skeletonBox}
                style={{ width: "75%", height: 8 }}
              />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (err) {
    return <div className={styles.errorBox}>Watchlist: {err}</div>;
  }

  if (!data) return null;

  return (
    <div className={styles.watchlistWrap}>
      {(
        [
          { label: "Mag 7", items: data.mag7 },
          { label: "Market Context", items: data.context },
        ] as const
      ).map(({ label, items }) => (
        <div key={label} className={styles.watchlistSection}>
          <div className={styles.watchlistLabel}>{label}</div>

          {Array.from({ length: Math.ceil(items.length / 4) }).map(
            (_, rowIndex) => {
              const rowItems = items.slice(rowIndex * 4, rowIndex * 4 + 4);

              return (
                <div key={`row-${rowIndex}`} className={styles.watchlistRow}>
                  <div className={styles.watchlistGrid}>
                    {rowItems.map((t) => {
                      const isSelected =
                        selectedQuickTicker?.ticker === t.ticker;

                      return (
                        <React.Fragment key={t.ticker}>
                          <TickerCard
                            t={t}
                            selected={isSelected}
                            onQuickRead={() => handleToggle(t)}
                          />

                          {isSelected && selectedQuickTicker && (
                            <div className={styles.quickPanelMobileItem}>
                              <QuickAnalysisPanel
                                ticker={selectedQuickTicker}
                                quickRead={
                                  quickReads[selectedQuickTicker.ticker] ?? null
                                }
                                loading={
                                  loadingQuick[selectedQuickTicker.ticker] ??
                                  false
                                }
                                analyzingTicker={analyzingTicker}
                                onFullAnalysis={() =>
                                  onAnalyze(selectedQuickTicker.ticker)
                                }
                              />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>

                  {rowItems.some(
                    (item) => item.ticker === selectedQuickTicker?.ticker,
                  ) &&
                    selectedQuickTicker && (
                      <div className={styles.quickPanelDesktopItem}>
                        <QuickAnalysisPanel
                          ticker={selectedQuickTicker}
                          quickRead={
                            quickReads[selectedQuickTicker.ticker] ?? null
                          }
                          loading={
                            loadingQuick[selectedQuickTicker.ticker] ?? false
                          }
                          analyzingTicker={analyzingTicker}
                          onFullAnalysis={() =>
                            onAnalyze(selectedQuickTicker.ticker)
                          }
                        />
                      </div>
                    )}
                </div>
              );
            },
          )}
        </div>
      ))}
    </div>
  );
}
