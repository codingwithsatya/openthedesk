"use client";

import { useState } from "react";
import s from "@/features/journal/styles/journalSidebar.module.css";

interface JournalSidebarProps {
  entriesCount: number;
  wins: number;
  losses: number;
  setupCounts: Record<string, number>;
  sideFilter: string;
  onSideFilterChange: (value: string) => void;
  instruments: string[];
  instrumentFilter: string;
  onInstrumentFilterChange: (v: string) => void;
  directionFilter: string;
  onDirectionFilterChange: (v: string) => void;
  tagFilter: string;
  onTagFilterChange: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  statsView: "day" | "trade";
  onStatsViewChange: (v: "day" | "trade") => void;
  onLogTrade: () => void;
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
  instruments,
  instrumentFilter,
  onInstrumentFilterChange,
  directionFilter,
  onDirectionFilterChange,
  tagFilter,
  onTagFilterChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  statsView,
  onStatsViewChange,
  onLogTrade
}: JournalSidebarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <aside className={s.sidebar}>
      <button
        type="button"
        className={s.mobileToggle}
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
      >
        <span className={s.mobileToggleLeft}>
          <span className={s.filterIcon} aria-hidden="true">
            <span />
          </span>
          <span>Filters</span>
          <span className={s.mobileCount}>{entriesCount}</span>
        </span>
        <span
          className={`${s.chevron} ${mobileOpen ? s.chevronOpen : ""}`}
          aria-hidden="true"
        />
      </button>

      <div className={`${s.sidebarBody} ${mobileOpen ? s.mobileBodyOpen : ""}`}>
        <div className={s.title}>Journal</div>

        <div className={s.sectionLabel}>This Month</div>
        <div className={s.mobileInlineGrid}>
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
        </div>

        <div className={s.divider} />

        <div className={s.sectionLabel}>By Setup</div>
        <div className={s.mobileSetupGrid}>
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
        </div>

        <div className={s.divider} />

        <div className={s.sectionLabel}>Filters</div>
        <div className={s.mobileFormGrid}>
          <select
            className={s.sideSelect}
            value={instrumentFilter}
            onChange={(e) => onInstrumentFilterChange(e.target.value)}
          >
            <option value="">All instruments</option>
            {instruments.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <select
            className={s.sideSelect}
            value={directionFilter}
            onChange={(e) => onDirectionFilterChange(e.target.value)}
          >
            <option value="">All directions</option>
            <option value="CALL">Bull</option>
            <option value="PUT">Bear</option>
          </select>

          <input
            type="text"
            className={s.sideInput}
            placeholder="All tags"
            value={tagFilter}
            onChange={(e) => onTagFilterChange(e.target.value)}
          />
        </div>

        <div className={s.sectionLabel}>Date Range</div>
        <div className={s.dateRow}>
          <input
            type="date"
            className={s.sideInput}
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
          />
          <input
            type="date"
            className={s.sideInput}
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
          />
        </div>

        <div className={s.sectionLabel}>Stats View</div>
        <div className={s.mobileInlineGrid}>
          <button
            type="button"
            className={`${s.sideItem} ${statsView === "day" ? s.sideItemActive : ""}`}
            onClick={() => onStatsViewChange("day")}
          >
            <span>By day</span>
          </button>
          <button
            type="button"
            className={`${s.sideItem} ${statsView === "trade" ? s.sideItemActive : ""}`}
            onClick={() => onStatsViewChange("trade")}
          >
            <span>By trade</span>
          </button>
        </div>

        <div className={s.spacer} />

        <button
          type="button"
          className={s.logButton}
          onClick={onLogTrade}
        >
          + Log a trade
        </button>
      </div>
    </aside>
  );
}
