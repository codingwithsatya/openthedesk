"use client";
import s from "@/features/challenge/styles/challengeLanding.module.css";

const STEPS = [
  {
    badge: "1",
    variant: "start" as const,
    title: "Start",
    desc: "$500 account. First A/A+ setup.",
  },
  {
    badge: "30",
    variant: null,
    title: "Consistency",
    desc: "Patterns repeat. Triggers become visible.",
  },
  {
    badge: "60",
    variant: null,
    title: "Discipline",
    desc: "Process over outcome. Grade quality.",
  },
  {
    badge: "90",
    variant: "summit" as const,
    title: "Scale Up",
    desc: "Consistency proven. Size is earned.",
  },
];

export default function ChallengeJourney() {
  return (
    <div className={s.journeyRow}>
      <div className={s.journeyCard}>
        <div className={s.journeySectionHead}>Challenge Journey</div>

        <div className={s.journeyTimeline}>
          <div className={s.journeyTrack} />

          {STEPS.map((step) => (
            <div key={step.badge} className={s.journeyMilestone}>
              <div
                className={`${s.journeyBadge}${
                  step.variant ? ` ${s[step.variant]}` : ""
                }`}
              >
                {step.badge}
              </div>

              <div className={s.journeyStepTitle}>
                Day {step.badge} · {step.title}
              </div>

              <div className={s.journeyStepDesc}>{step.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={s.journeyCard}>
        <div className={s.journeySectionHead}>Challenge Philosophy</div>

        <p className={s.journeyPhilosophyBody}>
          Most traders lose because they size up before they&apos;re ready. This
          challenge forces you to trade small — small enough that losses sting
          but don&apos;t break you.
        </p>

        <p className={s.journeyPhilosophyBodySpaced}>
          Ninety days is long enough to encounter bull runs, bear flushes, chop,
          and news spikes. If your process survives all of that at small size,
          it will survive bigger size too.
        </p>

        <div className={s.journeyTags}>
          <span className={s.journeyTag}>Process first</span>
          <span className={s.journeyTag}>Grade quality</span>
          <span className={s.journeyTag}>No sizing up</span>
          <span className={s.journeyTag}>Log every trade</span>
        </div>
      </div>
    </div>
  );
}
