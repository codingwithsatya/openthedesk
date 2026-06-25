export interface AtrLevels {
  trigger_up: number;
  gg_open_up: number;
  gg_complete_up: number;
  full_atr_up: number;
  trigger_down: number;
  gg_open_down: number;
  gg_complete_down: number;
  full_atr_down: number;
}

export interface TickerData {
  ticker: string;
  market: "US" | "IN";
  price: number | null;
  prev_close: number | null;
  change_pct: number | null;
  ema_8: number | null;
  ema_21: number | null;
  ema_48: number | null;
  ema_200: number | null;
  ribbon_state: "BULLISH" | "BEARISH" | "MIXED" | null;
  atr_14: number | null;
  atr_levels: AtrLevels | null;
  week52_high: number | null;
  week52_low: number | null;
  price_vs_52w_high_pct: number | null;
  distance_from_52w_high_pct: number | null;
  avg_volume_10d: number | null;
  relative_volume: number | null;
  pe_ratio: number | null;
  eps_growth_yoy: number | null;
  revenue_growth_yoy: number | null;
  market_cap: number | null;
  sector: string | null;
  beta: number | null;
  debt_to_equity: number | null;
  short_interest_pct: number | null;
  earnings_date: string | null;
  days_to_earnings: number | null;
  iv_rank?: number | null;
  has_options?: boolean;
}

export interface AnalysisResult {
  ticker: string;
  market_data: TickerData;
  short_term: string;
  long_term: string;
}

export type RibbonState = "BULLISH" | "BEARISH" | "MIXED";

export interface ScreenerRow {
  ticker: string;
  ribbon_state: "BULLISH" | "BEARISH";
  price: number | null;
  change_pct: number | null;
  atr_14: number | null;
  sector: string | null;
}

export interface ScreenerData {
  us_setups: ScreenerRow[];
  india_setups: ScreenerRow[];
  generated_at: string;
}

export interface WatchlistTicker {
  ticker: string;
  price: number | null;
  change_pct: number | null;
  ribbon_state: RibbonState;
  atr_14: number | null;
  call_trigger: number | null;
  put_trigger: number | null;
  gg_open_call: number | null;
  gg_open_put: number | null;
  compression: boolean;
  po_value: number | null;
  volume_ratio: number | null;
  zero_dte_eligible: boolean;
  error: string | null;
}

export interface WatchlistData {
  mag7: WatchlistTicker[];
  context: WatchlistTicker[];
  generated_at: string;
}

export interface QuickReadResult {
  ticker: string;
  quick_read: string;
}

export type LevelTone = "green" | "softGreen" | "red" | "softRed" | "blue";

export interface FullAnalysisLevelItem {
  label: string;
  val: number | null | undefined;
  tone: LevelTone;
  isNow?: boolean;
}

export interface RenderableFullAnalysisLevelItem {
  label: string;
  val: number;
  tone: LevelTone;
  isNow?: boolean;
}

export interface RibbonTheme {
  bg: string;
  color: string;
  border: string;
}

export interface PoBarState {
  capped: number;
  fill: number;
  className: "po-bar-fill-bull" | "po-bar-fill-bear";
}
