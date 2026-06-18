"use client";

interface Props {
  dayNumber: number;
  totalDays?: number;
}

type Pt  = { x: number; y: number };
type Seg = { p0: Pt; p1: Pt; p2: Pt; p3: Pt };

function lerp2(a: Pt, b: Pt, t: number): Pt {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function cubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const q0 = lerp2(p0, p1, t);
  const q1 = lerp2(p1, p2, t);
  const q2 = lerp2(p2, p3, t);
  const r0 = lerp2(q0, q1, t);
  const r1 = lerp2(q1, q2, t);
  return lerp2(r0, r1, t);
}

function splitCubicAt(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number) {
  const q0 = lerp2(p0, p1, t);
  const q1 = lerp2(p1, p2, t);
  const q2 = lerp2(p2, p3, t);
  const r0 = lerp2(q0, q1, t);
  const r1 = lerp2(q1, q2, t);
  const s  = lerp2(r0, r1, t);
  return { q0, q2, r0, r1, s };
}

function f(n: number) { return n.toFixed(1); }

// 3-segment polybezier matching background SVG path exactly:
// M380 178 C435 155 448 138 493 132 C535 126 548 91 588 90 C615 88 626 61 650 40
const SEG: Seg[] = [
  { p0:{x:380,y:178}, p1:{x:435,y:155}, p2:{x:448,y:138}, p3:{x:493,y:132} },
  { p0:{x:493,y:132}, p1:{x:535,y:126}, p2:{x:548,y: 91}, p3:{x:588,y: 90} },
  { p0:{x:588,y: 90}, p1:{x:615,y: 88}, p2:{x:626,y: 61}, p3:{x:650,y: 40} },
];

function polyAt(t: number): Pt {
  const idx = Math.min(Math.floor(t * 3), 2);
  const lt  = t * 3 - idx;
  const { p0, p1, p2, p3 } = SEG[idx];
  return cubicAt(p0, p1, p2, p3, lt);
}

function segStr(s: Seg, first: boolean): string {
  const m = first ? `M ${s.p0.x} ${s.p0.y} ` : '';
  return `${m}C ${s.p1.x} ${s.p1.y} ${s.p2.x} ${s.p2.y} ${s.p3.x} ${s.p3.y}`;
}

function buildPolyPaths(progress: number): {
  progPath: string | null;
  futurePath: string | null;
  cur: Pt;
} {
  const fullPath = SEG.map((s, i) => segStr(s, i === 0)).join(' ');

  if (progress <= 0) return { progPath: null,     futurePath: fullPath, cur: SEG[0].p0 };
  if (progress >= 1) return { progPath: fullPath, futurePath: null,     cur: SEG[2].p3 };

  const idx = Math.min(Math.floor(progress * 3), 2);
  const lt  = progress * 3 - idx;
  const { q0, q2, r0, r1, s } = splitCubicAt(SEG[idx].p0, SEG[idx].p1, SEG[idx].p2, SEG[idx].p3, lt);
  const cur = s;

  const frontEnd  = `C ${f(q0.x)} ${f(q0.y)} ${f(r0.x)} ${f(r0.y)} ${f(s.x)} ${f(s.y)}`;
  const backStart = `M ${f(s.x)} ${f(s.y)} C ${f(r1.x)} ${f(r1.y)} ${f(q2.x)} ${f(q2.y)} ${SEG[idx].p3.x} ${SEG[idx].p3.y}`;

  let progPath: string;
  let futurePath: string;

  if (idx === 0) {
    progPath   = `M ${SEG[0].p0.x} ${SEG[0].p0.y} ${frontEnd}`;
    futurePath = `${backStart} ${SEG.slice(1).map(sg => segStr(sg, false)).join(' ')}`;
  } else if (idx === 1) {
    progPath   = `${segStr(SEG[0], true)} ${frontEnd}`;
    futurePath = `${backStart} ${segStr(SEG[2], false)}`;
  } else {
    progPath   = `${segStr(SEG[0], true)} ${segStr(SEG[1], false)} ${frontEnd}`;
    futurePath = backStart;
  }

  return { progPath, futurePath, cur };
}

function Chip({
  cx, cy, text, above = true, vw, className,
}: {
  cx: number; cy: number; text: string; above?: boolean; vw: number;
  className?: string;
}) {
  const charW  = 6.8;
  const padX   = 10;
  const h      = 18;
  const w      = Math.max(text.length * charW + padX * 2, 50);
  const safeCx = Math.max(w / 2 + 6, Math.min(cx, vw - w / 2 - 6));
  const ry     = cy + (above ? -(h + 8) : 8);
  return (
    <g className={className}>
      <rect
        x={safeCx - w / 2} y={ry}
        width={w} height={h}
        rx={h / 2}
        fill="rgba(8,13,19,0.78)"
        stroke="rgba(148,163,184,0.22)"
        strokeWidth="0.9"
      />
      <text
        x={safeCx} y={ry + h - 5}
        textAnchor="middle"
        fill="rgba(243,247,251,0.88)"
        fontSize="11"
        fontFamily="system-ui,-apple-system,sans-serif"
        fontWeight="700"
      >
        {text}
      </text>
    </g>
  );
}

export default function ChallengeMountainHero({ dayNumber, totalDays = 90 }: Props) {
  const W = 900, H = 240;

  const progress = Math.max(0, Math.min(dayNumber / totalDays, 1));
  const { progPath, futurePath, cur } = buildPolyPaths(progress);

  // Milestone labels at segment endpoints (t=0,1/3,2/3,1) — match background ghost dots exactly
  const milestones = [
    { t: 0,     day: 1,  chip: "Day 1 · Start",       above: false },
    { t: 1 / 3, day: 30, chip: "Day 30 · Consistency", above: true  },
    { t: 2 / 3, day: 60, chip: "Day 60 · Discipline",  above: true  },
    { t: 1,     day: 90, chip: "Day 90 · Scale Up",    above: true  },
  ].map((m) => ({ ...m, pos: polyAt(m.t) }));

  return (
    // cmh-root is position:absolute inset:0 — fills the .cf-hero-visual grid cell
    <div className="cmh-root">
      {/* Static mountain background — viewBox 900×240, xMaxYMin slice */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/openthedesk_mountain_hero.svg"
        alt=""
        aria-hidden="true"
        className="cmh-bg"
      />

      {/* Dynamic overlay: progress path, dots, milestone labels, current-day marker.
          preserveAspectRatio matches background SVG — both use xMaxYMin slice. */}
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMaxYMin slice"
        aria-hidden="true"
        className="cmh-overlay"
      >
        <defs>
          <filter id="cmh-path-glow" x="-20%" y="-80%" width="140%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <filter id="cmh-dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Future / remaining path — dashed blue */}
        {futurePath && (
          <path
            d={futurePath}
            fill="none"
            stroke="rgba(79,141,255,0.48)"
            strokeWidth="3"
            strokeDasharray="8 9"
            strokeLinecap="round"
          />
        )}

        {/* Completed progress path — solid green with glow */}
        {progPath && (
          <path
            d={progPath}
            fill="none"
            stroke="#35D48A"
            strokeWidth="4"
            strokeLinecap="round"
            opacity="0.95"
            filter="url(#cmh-path-glow)"
          />
        )}

        {/* Four fixed milestone dots + chips */}
        {milestones.map((m) => {
          const reached   = m.day <= dayNumber;
          const isSummit  = m.day === 90;
          const dotColor  = reached ? "#35D48A" : "rgba(79,141,255,0.55)";
          const ringColor = reached ? "rgba(53,212,138,0.22)" : "rgba(79,141,255,0.12)";
          return (
            <g key={m.day}>
              {!isSummit && <circle cx={m.pos.x} cy={m.pos.y} r="8" fill={ringColor} />}
              {!isSummit && (
                <circle
                  cx={m.pos.x} cy={m.pos.y} r="4.5"
                  fill={dotColor}
                  filter={reached ? "url(#cmh-dot-glow)" : undefined}
                />
              )}
              <Chip
                cx={m.pos.x} cy={m.pos.y}
                text={m.chip} above={m.above}
                vw={W}
                className="hero-milestone-label"
              />
            </g>
          );
        })}

        {/* Current-day marker — separate moving element, hidden near summit */}
        {progress > 0 && progress < 0.98 && (
          <g>
            <circle cx={cur.x} cy={cur.y} r="20" fill="rgba(53,212,138,0.09)" />
            <circle cx={cur.x} cy={cur.y} r="12" fill="rgba(53,212,138,0.20)" />
            <circle
              cx={cur.x} cy={cur.y} r="6"
              fill="#35D48A"
              filter="url(#cmh-dot-glow)"
            />
            <Chip
              cx={Math.min(cur.x + (progress < 0.10 ? 28 : 0), W - 60)}
              cy={cur.y}
              text={`Day ${dayNumber}`}
              above
              vw={W}
            />
          </g>
        )}
      </svg>
    </div>
  );
}
