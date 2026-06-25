"use client";

import s from "@/features/journal/styles/journalFilterBar.module.css";

type FilterKey = "all" | "bull" | "bear" | "winners" | "losers" | "aplus";

interface JournalFilterBarProps {
  activeFilter: FilterKey;
  onFilterChange: (value: FilterKey) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onClear: () => void;
}

const filters: { label: string; value: FilterKey }[] = [
  { label: "All", value: "all" },
  { label: "Bull", value: "bull" },
  { label: "Bear", value: "bear" },
  { label: "Winners", value: "winners" },
  { label: "Losers", value: "losers" },
  { label: "A+ only", value: "aplus" },
];

export default function JournalFilterBar({
  activeFilter,
  onFilterChange,
  search,
  onSearchChange,
  onClear,
}: JournalFilterBarProps) {
  return (
    <div className={s.bar}>
      <div className={s.left}>
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search trades…"
          style={{
            height: 34,
            borderRadius: 9,
            border: "1px solid rgba(59,130,246,0.2)",
            background: "rgba(15,23,42,0.66)",
            color: "#e2e8f0",
            padding: "0 12px",
            fontSize: 12,
            fontFamily: "var(--font-inter), sans-serif",
            outline: "none",
            width: 160,
          }}
        />
        {filters.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => onFilterChange(f.value)}
            className={`${s.button} ${activeFilter === f.value ? s.active : ""}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <button type="button" className={s.clearButton} onClick={onClear}>
        Clear filters
        <span>×</span>
      </button>
    </div>
  );
}
