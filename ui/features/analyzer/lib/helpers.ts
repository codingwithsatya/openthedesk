import type {
  FullAnalysisLevelItem,
  PoBarState,
  RenderableFullAnalysisLevelItem,
  RibbonState,
  RibbonTheme,
} from "./types";

export function fmt(v: number | null | undefined, dec = 2): string {
  return v != null ? v.toFixed(dec) : "—";
}

export function fmtChange(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

export function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function isRenderableLevelItem(
  item: FullAnalysisLevelItem,
): item is RenderableFullAnalysisLevelItem {
  return item.val != null;
}

export function getRibbonTheme(
  state: RibbonState | string | null,
): RibbonTheme {
  const s = state || "MIXED";

  if (s === "BULLISH") {
    return {
      bg: "#052e16",
      color: "#4ade80",
      border: "#14532d",
    };
  }

  if (s === "BEARISH") {
    return {
      bg: "#450a0a",
      color: "#f87171",
      border: "#7f1d1d",
    };
  }

  return {
    bg: "#1e293b",
    color: "#94a3b8",
    border: "#334155",
  };
}

export function getLightRibbonTheme(
  state: RibbonState | string | null,
): RibbonTheme {
  const s = state || "MIXED";

  if (s === "BULLISH") {
    return {
      bg: "#f0fdf4",
      color: "#15803d",
      border: "#bbf7d0",
    };
  }

  if (s === "BEARISH") {
    return {
      bg: "#fef2f2",
      color: "#dc2626",
      border: "#fecaca",
    };
  }

  return {
    bg: "rgba(100,116,139,0.1)",
    color: "#64748b",
    border: "#e2e8f0",
  };
}

export function getGlowClass(state: RibbonState | string | null): string {
  if (state === "BULLISH") return "glow-bull";
  if (state === "BEARISH") return "glow-bear";
  return "glow-mixed";
}

export function getPoBarState(poValue: number | null | undefined): PoBarState {
  const capped = Math.max(-100, Math.min(100, poValue ?? 0));
  const fill = (Math.abs(capped) / 100) * 50;

  return {
    capped,
    fill,
    className: capped >= 0 ? "po-bar-fill-bull" : "po-bar-fill-bear",
  };
}

export function getChangeToneClass(changePct: number | null | undefined) {
  return (changePct ?? 0) >= 0 ? "positive" : "negative";
}

export function getTickerEmoji(state: RibbonState | string | null): string {
  if (state === "BULLISH") return "🐂";
  if (state === "BEARISH") return "🐻";
  return "⚖";
}

export function getTickerLogo(ticker: string): string | null {
  const key = ticker.toUpperCase();

  const map: Record<string, string> = {
    MSFT: "/ticker-logos/msft.svg",
    AMZN: "/ticker-logos/amzn.svg",
    META: "/ticker-logos/meta.svg",
    TSLA: "/ticker-logos/tsla.png",
    NVDA: "/ticker-logos/nvda.svg",
    GOOGL: "/ticker-logos/googl.svg",
    AAPL: "/ticker-logos/aapl.svg",
    SPY: "/ticker-logos/spy.svg",
    QQQ: "/ticker-logos/qqq.svg",
    XLK: "/ticker-logos/xlk.svg",
    XLF: "/ticker-logos/xlf.svg",
    SMH: "/ticker-logos/smh.svg",
  };

  return map[key] ?? null;
}

export function iconForLine(label: string, value: string): string {
  const text = `${label} ${value}`.toUpperCase();

  if (text.includes("VERDICT") || text.includes("DECISION")) return "⚖️";
  if (text.includes("DIRECTION") || text.includes("BIAS")) return "🧭";
  if (text.includes("ENTRY")) return "🎯";
  if (text.includes("STOP")) return "🛑";
  if (text.includes("TARGET")) return "🏁";
  if (text.includes("RISK") || text.includes("R:R")) return "🛡️";
  if (text.includes("RIBBON") || text.includes("TREND")) return "🌊";
  if (text.includes("LEVEL")) return "📍";
  if (text.includes("VOLUME")) return "📊";
  if (text.includes("EARNINGS")) return "🗓️";
  if (text.includes("SUPPORT")) return "🟢";
  if (text.includes("RESISTANCE")) return "🔴";
  if (text.includes("PLAN")) return "📝";
  if (text.includes("CATALYST")) return "⚡";
  if (text.includes("FUNDAMENTAL")) return "🏢";
  if (text.includes("VALUATION")) return "💰";

  return "•";
}
