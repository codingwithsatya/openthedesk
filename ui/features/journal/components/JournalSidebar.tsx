"use client";

import s from "@/features/journal/styles/journalSidebar.module.css";

interface JournalSidebarProps {
  entriesCount: number;
  wins: number;
  losses: number;
  setupCounts: Record<string, number>;
  sideFilter: string;
  onSideFilterChange: (value: string) => void;
}

function SideItem({
  label,
  count,
  value,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  value: string;
  active: boolean;
  onClick: (value: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={`${s.sideItem} ${active ? s.sideItemActive : ""}`}
    >
      <span>{label}</span>
      {count !== undefined && <span className={s.count}>{count}</span>}
    </button>
  );
}

export default function JournalSidebar({
  entriesCount,
  wins,
  losses,
  setupCounts,
  sideFilter,
  onSideFilterChange,
}: JournalSidebarProps) {
  return (
    <aside className={s.sidebar}>
      <div className={s.title}>Journal</div>

      <div className={s.sectionLabel}>This Month</div>
      <SideItem
        label="All trades"
        count={entriesCount}
        value="all"
        active={sideFilter === "all"}
        onClick={onSideFilterChange}
      />
      <SideItem
        label="Winners"
        count={wins}
        value="winners"
        active={sideFilter === "winners"}
        onClick={onSideFilterChange}
      />
      <SideItem
        label="Losers"
        count={losses}
        value="losers"
        active={sideFilter === "losers"}
        onClick={onSideFilterChange}
      />

      <div className={s.divider} />

      <div className={s.sectionLabel}>By Setup</div>
      {Object.keys(setupCounts).map((setup) => (
        <SideItem
          key={setup}
          label={setup}
          count={setupCounts[setup] ?? 0}
          value={setup}
          active={sideFilter === setup}
          onClick={onSideFilterChange}
        />
      ))}

      <div className={s.divider} />

      <div className={s.sectionLabel}>Filters</div>
      <button className={s.selectButton}>All instruments</button>
      <button className={s.selectButton}>All directions</button>
      <button className={s.selectButton}>All tags</button>

      <div className={s.sectionLabel}>Date Range</div>
      <button className={s.dateButton}>06/01/2025 - 06/17/2025</button>

      <div className={s.sectionLabel}>Stats View</div>
      <button className={`${s.sideItem} ${s.sideItemActive}`}>
        <span>By day</span>
      </button>
      <button className={s.sideItem}>
        <span>By trade</span>
      </button>

      <div className={s.spacer} />

      <button
        type="button"
        className={s.logButton}
        onClick={() => alert("Trade entry form coming soon")}
      >
        + Log a trade
      </button>
    </aside>
  );
}
