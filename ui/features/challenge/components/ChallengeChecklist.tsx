"use client";
import s from "@/features/challenge/styles/challengeLanding.module.css";

interface Props {
  onStart: () => void;
}

const CheckIcon = () => (
  <svg
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const ShieldIcon = () => (
  <svg
    width="26"
    height="26"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 01-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 011-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 011.52 0C14.51 3.81 17 5 19 5a1 1 0 011 1z" />
  </svg>
);

const ITEMS = [
  "I understand the $500 starting balance is fixed for all 90 days",
  "I will only take A or A+ grade setups — no B or C trades",
  "I will stop trading if I hit –$150 in a single session",
  "I will log every trade with grade, setup type, and outcome",
  "I accept that consistent process matters more than daily P&L",
];

export default function ChallengeChecklist({ onStart }: Props) {
  return (
    <div className={s.checkSection}>
      <div className={s.checkIntro}>
        <div className={s.checkIntroIcon}>
          <ShieldIcon />
        </div>

        <div className={s.checkIntroText}>
          <div className={s.checkIntroTitle}>
            Commit to the rules before Day 1
          </div>
          <div className={s.checkIntroBody}>
            This challenge only works if the rules are followed exactly. Start
            only when you are ready to trade process first.
          </div>
        </div>
      </div>

      <div className={s.checkList}>
        {ITEMS.map((item) => (
          <div key={item} className={s.checkItem}>
            <span className={s.checkIcon}>
              <CheckIcon />
            </span>
            <span className={s.checkText}>{item}</span>
          </div>
        ))}
      </div>

      <div className={s.checkCta}>
        <div>
          <div className={s.checkCtaTitle}>Ready to begin?</div>
          <div className={s.checkCtaSub}>
            Day 1 starts today. Keep size small. Let consistency prove itself.
          </div>
        </div>

        <button className={s.checkStartBtn} onClick={onStart}>
          Start Challenge — Day 1 begins today
        </button>
      </div>
    </div>
  );
}
