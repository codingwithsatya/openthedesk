// ── Shared helpers for challenge pages and sub-components ────────────────────

import type { CalendarDay, GridCell } from "@/features/challenge/lib/types";

export function gradeClass(g: string | null): string {
  if (!g) return "";
  if (g === "A+" || g === "A") return "a";
  if (g === "B") return "b";
  return "c";
}

export function gradeColor(g: string | null): string {
  if (!g) return "var(--text-mid)";
  if (g === "A+" || g === "A") return "var(--ch-green)";
  if (g === "B") return "var(--ch-warning)";
  return "var(--ch-red)";
}

export function fmtPnl(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${v >= 0 ? "+" : "−"}$${abs}`;
}

export function fmtDate(d: string): string {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtEndDate(d: string): string {
  return new Date(d + "T12:00:00Z").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Advance N weekdays from startDateStr, return ISO date */
export function addWeekdays(startDateStr: string, n: number): string {
  const d = new Date(startDateStr + "T12:00:00Z");
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    const dow = d.getUTCDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
}

export function buildMonthGrid(
  year: number,
  month: number,
  calDayMap: Map<string, CalendarDay>,
  todayStr: string,
): GridCell[] {
  const cells: GridCell[] = [];
  const firstDow = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 0; i < firstDow; i++)
    cells.push({
      blank: true,
      date: "",
      dayNum: 0,
      calDay: null,
      isToday: false,
    });
  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    cells.push({
      blank: false,
      date,
      dayNum: d,
      calDay: calDayMap.get(date) ?? null,
      isToday: date === todayStr,
    });
  }
  return cells;
}

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
