"use client";
import s from "@/features/challenge/styles/challengeLanding.module.css";

const StarIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ShieldIcon = () => (
  <svg
    width="22"
    height="22"
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

const ProcessIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
  </svg>
);

const TradesIcon = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const CARDS = [
  {
    Icon: StarIcon,
    tone: "blue",
    title: "Trade Discipline",
    body: "Only A/A+ setups. Every session reinforces the habit of waiting for quality over quantity.",
  },
  {
    Icon: ShieldIcon,
    tone: "red",
    title: "Loss Management",
    body: "Hard –$150 daily stop. Learn to walk away and come back fresh the next session.",
  },
  {
    Icon: ProcessIcon,
    tone: "green",
    title: "Consistent Journaling",
    body: "Every trade logged with grade and notes. Patterns emerge. Process improves over time.",
  },
  {
    Icon: TradesIcon,
    tone: "gold",
    title: "Proven Track Record",
    body: "90 days of data that proves you're ready to scale. Not hope — evidence.",
  },
];

export default function ChallengeBuildCards() {
  return (
    <div className={s.buildGrid}>
      {CARDS.map(({ Icon, tone, title, body }) => (
        <div key={title} className={s.buildCard}>
          <div className={`${s.buildIconWrap} ${s[tone]}`}>
            <Icon />
          </div>

          <div className={s.buildTitle}>{title}</div>
          <div className={s.buildBody}>{body}</div>
        </div>
      ))}
    </div>
  );
}
