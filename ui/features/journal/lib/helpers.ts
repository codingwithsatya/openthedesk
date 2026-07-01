export function fmtPnl(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${v >= 0 ? "+" : "-"}$${abs}`;
}

export function fmtRMult(r: number | null | undefined): string {
  if (r == null) return "—";
  return `${r >= 0 ? "+" : ""}${r.toFixed(1)}R`;
}

// Add this helper at the top of the file:
export function fmtPremiumPct(
  entry: number | null,
  exit: number | null,
): string {
  if (entry == null || exit == null || entry === 0) return "—";
  const pct = ((exit - entry) / entry) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
}

export function fmtExpectancy(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v >= 0 ? "+" : "-"}$${abs}`;
}
