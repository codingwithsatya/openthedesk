"use client";
import React, { useState, useEffect } from "react";
import { useAuth } from "@clerk/nextjs";
import Header from "../components/Header";
import AppIconRail from "@/app/components/AppIconRail";
import FullAnalysisPanel from "@/features/analyzer/components/FullAnalysisPanel";
import type {
  AnalysisResult,
  ScreenerData,
  WatchlistData,
} from "@/features/analyzer/lib/types";

import { ScreenerColumn } from "@/features/analyzer/components/ScreenerColumn";
import { WatchlistPanel } from "@/features/analyzer/components/WatchlistPanel";
import { AnalyzerRightRail } from "@/features/analyzer/components/AnalyzerRightRail";
import styles from "@/features/analyzer/styles/AnalyzerDashboard.module.css";
import { cx } from "@/features/analyzer/lib/helpers";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AnalyzerPage() {
  const { getToken } = useAuth();
  const [tickerInput, setTickerInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingTicker, setAnalyzingTicker] = useState<string | null>(null);
  const [isLoadingScreener, setIsLoadingScreener] = useState(true);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [fullViewOpen, setFullViewOpen] = useState(false);
  const [screener, setScreener] = useState<ScreenerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [watchlistData, setWatchlistData] = useState<WatchlistData | null>(
    null,
  );

  useEffect(() => {
    loadScreener();
  }, []);

  const loadScreener = async () => {
    setIsLoadingScreener(true);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${API}/screener`, { headers });
      setScreener(await r.json());
    } catch {
      /* silently fail */
    } finally {
      setIsLoadingScreener(false);
    }
  };

  const analyze = async (sym: string) => {
    const t = sym.trim().toUpperCase();
    if (!t) return;
    setTickerInput(t);
    setIsAnalyzing(true);
    setAnalyzingTicker(t);
    setError(null);
    setResult(null);
    setFullViewOpen(false);
    try {
      const token = await getToken();
      const authHeader: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) authHeader["Authorization"] = `Bearer ${token}`;
      const r = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ ticker: t }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      setResult(data);
      setFullViewOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
      setAnalyzingTicker(null);
    }
  };

  const handleSubmit = (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault();
    analyze(tickerInput);
  };

  return (
    <div className={styles.pageShell}>
      <Header
        deskOpen={false}
        refreshing={false}
        onRefresh={() => {}}
        onClearSession={() => {}}
        marketData={null}
        activePage="analyzer"
      />

      <div className={styles.bodyShell}>
        <AppIconRail activePage="analyzer" />

        <main className={styles.main}>
          <div
            className={cx(styles.content, fullViewOpen && styles.contentFull)}
          >
            {!fullViewOpen && (
              <section className={styles.searchHero}>
                <div className={styles.searchTop}>
                  <div>
                    <h1 className={styles.searchTitle}>Analyzer</h1>
                    <div className={styles.searchSubtitle}>
                      Search any ticker or open a Quick Read from the live
                      watchlist.
                    </div>
                  </div>
                  <div className={styles.statusBadge}>Live Screener</div>
                </div>

                <form onSubmit={handleSubmit} className={styles.searchForm}>
                  <input
                    value={tickerInput}
                    onChange={(e) =>
                      setTickerInput(e.target.value.toUpperCase())
                    }
                    placeholder="Enter ticker (AAPL, AMZN, RELIANCE.NS...)"
                    disabled={isAnalyzing}
                    className={styles.searchInput}
                  />

                  <button
                    type="submit"
                    disabled={isAnalyzing || !tickerInput.trim()}
                    className={styles.searchButton}
                  >
                    {isAnalyzing ? "Analyzing..." : "Search"}
                  </button>
                </form>
              </section>
            )}

            {error && <div className={styles.errorBox}>{error}</div>}

            {fullViewOpen && result && (
              <FullAnalysisPanel
                result={result}
                onBack={() => {
                  setIsAnalyzing(false);
                  setFullViewOpen(false);
                }}
              />
            )}

            <div
              className={
                fullViewOpen ? styles.hiddenNormalView : styles.normalView
              }
            >
              <div className={styles.dashboardLayout}>
                <div className={styles.dashboardMain}>
                  <WatchlistPanel
                    onAnalyze={analyze}
                    analyzingTicker={analyzingTicker}
                    onDataLoaded={setWatchlistData}
                  />

                  <section>
                    <div className={styles.sectionHeader}>
                      <h2 className={styles.sectionTitle}>
                        {result ? "Other Setups" : "Today's Setups"}
                      </h2>

                      <button
                        onClick={loadScreener}
                        disabled={isLoadingScreener}
                        className={styles.refreshButton}
                      >
                        {isLoadingScreener
                          ? "Loading..."
                          : "↻ Refresh Screener"}
                      </button>
                    </div>

                    {isLoadingScreener && !screener ? (
                      <div className={styles.grid2}>
                        {[0, 1].map((i) => (
                          <div key={i} className={styles.screenerCard}>
                            <div className={styles.screenerHeader}>
                              <div
                                className={styles.skeletonBox}
                                style={{ width: 90, height: 12 }}
                              />
                            </div>

                            <div style={{ padding: 14 }}>
                              {[0, 1, 2, 3].map((j) => (
                                <div
                                  key={j}
                                  className={styles.skeletonBox}
                                  style={{
                                    height: 36,
                                    marginBottom: 8,
                                    borderRadius: 8,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : screener ? (
                      <div className={styles.grid2}>
                        <ScreenerColumn
                          title="US Setups"
                          setups={screener.us_setups}
                          currency="$"
                          onRowClick={analyze}
                        />
                        <ScreenerColumn
                          title="India Setups"
                          setups={screener.india_setups}
                          currency="₹"
                          onRowClick={analyze}
                        />
                      </div>
                    ) : null}
                  </section>
                </div>

                <AnalyzerRightRail
                  watchlist={watchlistData}
                  screener={screener}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
