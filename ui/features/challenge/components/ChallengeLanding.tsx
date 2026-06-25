"use client";
import Header from "@/app/components/Header";
import AppIconRail from "@/app/components/AppIconRail";
import ChallengeMountainHero from "@/features/challenge/components/ChallengeMountainHero";
import ChallengeRuleCards from "./ChallengeRuleCards";
import ChallengeJourney from "./ChallengeJourney";
import ChallengeBuildCards from "./ChallengeBuildCards";
import ChallengeChecklist from "./ChallengeChecklist";
import { fmtDate, fmtPnl } from "@/features/challenge/lib/helpers";
import type { PastChallenge } from "../lib/types";
import s from "@/features/challenge/styles/challengeLanding.module.css";

interface Props {
  past: PastChallenge[];
  onStart: () => void;
}

const TrophyIcon = () => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#22c55e"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M8 21h8m-4-4v4M7 3H5a2 2 0 00-2 2v3c0 2.76 2.24 5 5 5h.1M17 3h2a2 2 0 012 2v3c0 2.76-2.24 5-5 5h-.1M7 3h10v5a5 5 0 01-10 0V3z" />
  </svg>
);

function PastRow({ ch }: { ch: PastChallenge }) {
  const st = ch.stats;
  const pnlColor = st.total_pnl >= 0 ? "#22c55e" : "#ef4444";
  return (
    <div className={s.pastRow}>
      <div style={{ flex: 1 }}>
        <div className={s.pastName}>{ch.name ?? "Challenge"}</div>
        <div className={s.pastDate}>{fmtDate(ch.start_date)}</div>
      </div>
      <div>
        <div className={s.pastPnl} style={{ color: pnlColor }}>
          {fmtPnl(st.total_pnl)}
        </div>
        <div className={s.pastMeta}>
          {st.win_rate}% WR · {st.total_trades} trades
        </div>
      </div>
    </div>
  );
}

export default function ChallengeLanding({ past, onStart }: Props) {
  return (
    <div className={s.page}>
      <Header
        deskOpen={false}
        refreshing={false}
        onRefresh={() => {}}
        onClearSession={() => {}}
        marketData={null}
        activePage="challenge"
      />
      <div className={s.body}>
        <AppIconRail activePage="challenge" />
        <main className={s.main}>
          <div className={s.wrap}>
            {/* Hero */}
            <div className={s.hero}>
              <ChallengeMountainHero />

              <div className={s.heroOverlay} />

              <div className={s.heroContent}>
                <div className={s.trophyWrap}>
                  <TrophyIcon />
                </div>

                <h1 className={s.heroTitle}>Saty 90-Day Challenge</h1>

                <p className={s.heroSubtitle}>
                  90 trading days. Prove consistency before sizing up. Process
                  first — P&amp;L is the byproduct.
                </p>

                <div className={s.btnRow}>
                  <button className={s.btnPrimary} onClick={onStart}>
                    Start Challenge — Day 1 begins today
                  </button>
                  <button className={s.btnSecondary}>How it works</button>
                </div>

                <blockquote className={s.quote}>
                  Don&apos;t size up until you are consistent for at least 90
                  days. A year is even better. In 90 days you will see A LOT of
                  different market conditions.
                  <span className={s.quoteAttr}>— Saty Mahajan</span>
                </blockquote>
              </div>
            </div>

            {/* Rules */}
            <div className={s.sectionHead}>Challenge Rules</div>
            <ChallengeRuleCards />

            {/* Journey + Philosophy */}
            <ChallengeJourney />

            {/* What You'll Build */}
            <div className={s.sectionHead}>What You&apos;ll Build</div>
            <ChallengeBuildCards />

            {/* Before You Start */}
            <div className={s.sectionHead}>Before You Start</div>
            <ChallengeChecklist onStart={onStart} />

            {/* Past challenges */}
            {past.length > 0 && (
              <div className={s.pastSection}>
                <div className={s.pastLabel}>Past challenges</div>
                {past.map((c) => (
                  <PastRow key={c.id} ch={c} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
