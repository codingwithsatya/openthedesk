export interface JournalEntry {
  id: string;
  created_at: string;
  date: string;
  ticker: string;
  instrument: string;
  setup: string;
  direction: string;
  entry_price: number;
  exit_price: number | null;
  contracts: number;
  entry_premium: number | null;
  exit_premium: number | null;
  pnl: number | null;
  grade: string;
  process_grade: string;
  process_review: string | null;
  notes: string | null;
  status: string;
  tags: string;
  r_multiple: number | null;
  win_loss: "win" | "loss" | "open";
  row_actions: string[];
  internals?: { trin?: number | null; add?: number | null; vold?: number | null };
}

export interface JournalStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  avg_winner: number;
  avg_loser: number;
  best_setup: string | null;
  best_setup_pnl: number | null;
  profit_factor: number;
  expectancy: number;
  pnl_by_setup: Record<string, { wins: number; losses: number; total_pnl: number }>;
  pnl_by_hour: Record<string, { wins: number; losses: number }>;
  pnl_by_hour_grid: Record<string, { wins: number; losses: number; pnl: number }>;
  equity_curve: number[];
  equity_dates: string[];
}

export interface JournalFilters {
  search: string;
  setup: string;
  direction: string;
  tag: string;
  status: string;
  date_from: string;
  date_to: string;
}
