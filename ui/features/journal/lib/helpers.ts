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

export function fmtExpectancy(v: number): string {
  const abs = Math.abs(v).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${v >= 0 ? "+" : "-"}$${abs}`;
}
