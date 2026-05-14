export interface Message {
  role: "user" | "assistant";
  content: string;
  model?: string;
}

export interface OptionContract {
  strike: number;
  bid: number;
  ask: number;
  mid: number;
  delta: number;
  iv: number;
  volume: number;
  open_interest: number;
}

export interface MarketData {
  spx: {
    last: number | null;
    close: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    pdc: number | null;
  };
  vix: { vix: number };
  atr_levels: {
    PDC: number;
    ATR: number;
    call_trigger: number;
    gg_open_call: number;
    gg_50_call: number;
    gg_complete_call: number;
    full_atr_call: number;
    put_trigger: number;
    gg_open_put: number;
    gg_50_put: number;
    gg_complete_put: number;
    full_atr_put: number;
  };
  options?: {
    spot: number;
    expiry: string;
    atr: number | null;
    best_call: OptionContract | null;
    best_put: OptionContract | null;
    call_in_budget: boolean;
    put_in_budget: boolean;
    chain: {
      calls: OptionContract[];
      puts: OptionContract[];
    };
  };
}

// Must mirror route_model() in main.py
export const HAIKU_COMMANDS = new Set([
  "PTR-FAST", "PTR-FULL", "GRADE", "PATTERN CHECK",
  "MARKET REGIME", "CAPITAL PROTECTION", "WIRE OUT",
  "TRADE REVIEW", "EOD",
]);

export const routeModel = (msg: string) =>
  HAIKU_COMMANDS.has(msg.trim().toUpperCase())
    ? "claude-haiku-4-5-20251001"
    : "claude-sonnet-4-6";

export const modelLabel = (m?: string) =>
  m === "claude-haiku-4-5-20251001" ? "haiku" : m ? "sonnet" : undefined;

export interface PaletteCommand {
  cmd: string;
  desc: string;
  group: "quick" | "deep";
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  // Quick — Haiku
  { cmd: "PTR-FAST",           desc: "3-gate quick check",         group: "quick" },
  { cmd: "PTR-FULL",           desc: "12-point full audit",         group: "quick" },
  { cmd: "GRADE",              desc: "Setup quality grade",         group: "quick" },
  { cmd: "PATTERN CHECK",      desc: "Psychology audit",            group: "quick" },
  { cmd: "MARKET REGIME",      desc: "Classify environment",        group: "quick" },
  { cmd: "CAPITAL PROTECTION", desc: "Emergency protocol",          group: "quick" },
  { cmd: "WIRE OUT",           desc: "Calculate wire-out amount",   group: "quick" },
  { cmd: "TRADE REVIEW",       desc: "4-dimension scorecard",       group: "quick" },
  { cmd: "EOD",                desc: "End of day review",           group: "quick" },
  // Deep — Sonnet
  { cmd: "Open the Desk",      desc: "Full session opener",         group: "deep"  },
  { cmd: "PREMARKET",          desc: "5-step morning plan",         group: "deep"  },
  { cmd: "TRADE IDEA",         desc: "6-point analysis",            group: "deep"  },
  { cmd: "IN TRADE",           desc: "Real-time management",        group: "deep"  },
  { cmd: "BLUNT FEEDBACK",     desc: "Direct critique, zero soft",  group: "deep"  },
  { cmd: "WEEKLY REVIEW",      desc: "Full weekly summary",         group: "deep"  },
  { cmd: "SETUP LIBRARY",      desc: "Reference any named setup",   group: "deep"  },
  { cmd: "JOURNAL",            desc: "Session journal entry",       group: "deep"  },
];
