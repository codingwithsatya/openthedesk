// ── Shared types for challenge pages and sub-components ──────────────────────

export interface CalendarDay {
  date: string;
  td_number: number;
  status: "win" | "loss" | "no_trade";
  day_pnl: number;
  trade_count: number;
  best_grade: string | null;
}

export interface TradeCard {
  id: string | null;
  setup: string | null;
  direction: string | null;
  entry_premium: number | null;
  exit_premium: number | null;
  stop_loss_premium: number | null;
  r_multiple: number | null;
  contracts: number;
  pnl: number | null;
  grade: string | null;
  process_grade: string | null;
  process_review: string | null;
  grade_factors: {
    setup_quality: number;
    execution: number;
    risk_management: number;
    trade_management: number;
    mindset_discipline: number;
  } | null;
  notes: string | null;
}

export interface DayDetailResponse {
  date: string;
  trades: TradeCard[];
  day_pnl: number;
  balance_after: number | null;
  win_rate: number | null;
  avg_r_multiple: number | null;
}

export interface ChallengeStats {
  total_trades: number;
  wins: number;
  losses: number;
  win_rate: number;
  total_pnl: number;
  current_balance: number;
  avg_winner: number;
  avg_loser: number;
  best_setup: string | null;
  process_grades: { A_plus: number; A: number; B: number; C: number };
  avg_process_grade: number | null;
}

export interface ChallengeData {
  id: string;
  start_date: string;
  start_balance: number;
  target_days: number;
  status: string;
  name?: string;
}

export interface EquityPoint {
  date: string;
  pnl: number;
  balance: number;
}

export interface Streaks {
  current: number;
  best: number;
}

export interface GradeBreakdown {
  a_plus: number;
  a: number;
  b: number;
  c: number;
  total: number;
}

export interface StatsResponse {
  active: boolean;
  challenge?: ChallengeData;
  day_number?: number;
  stats?: ChallengeStats;
  calendar?: CalendarDay[];
  equity?: EquityPoint[];
  streaks?: Streaks;
  grade_breakdown?: GradeBreakdown;
}

export interface PastChallenge extends ChallengeData {
  stats: ChallengeStats;
}

export interface GridCell {
  blank: boolean;
  date: string;
  dayNum: number;
  calDay: CalendarDay | null;
  isToday: boolean;
}
