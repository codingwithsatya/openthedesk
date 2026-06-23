import type { RefObject } from "react";
import type { Message, MarketData } from "@/app/types";
import type { TVAlert } from "@/app/components/AlertPanel";

interface ChallengeInfo {
  dayNumber: number;
  currentBalance: number;
  wins: number;
  losses: number;
}

export interface DeskShellProps {
  // Header
  deskOpen: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onClearSession: () => void;
  marketData: MarketData | null;
  sessionDuration: string;

  // MorningBriefBanner
  briefVisible: boolean;
  briefBias: string;
  briefMag7Bull: number;
  briefMag7Bear: number;
  briefMag7Mixed: number;
  briefWarning: string;
  briefBullLevel: number | null;
  briefBearLevel: number | null;
  onBriefExpand: () => void;

  // LevelsPanel + MobileSheet
  satyAtr: string;
  atrApplied: boolean;
  onAtrChange: (val: string) => void;
  onAtrApply: (val: number) => void;
  onAtrReset: () => void;

  // ChartStrip
  chartInterval: string;
  onChartIntervalChange: (tf: string) => void;

  // SessionBar
  tdNumber: string | number;
  challengeInfo: ChallengeInfo | null;

  // ChatPanel
  messages: Message[];
  loading: boolean;
  onSend: (msg: string) => void;
  setMessages: (fn: (prev: Message[]) => Message[]) => void;
  setLoading: (v: boolean) => void;
  bottomRef: RefObject<HTMLDivElement | null>;
  onMorningBrief: () => void;
  onOpenDesk: () => void;
  firstName: string;
  briefLoading: boolean;
  canOpenDesk: boolean;
  marketStatusLabel: string;

  // Alerts (SignalStream + MobileSignalStream)
  alerts: TVAlert[];
  isUnread: (a: TVAlert) => boolean;
  markRead: (id: string) => void;

  // CommandPalette
  paletteOpen: boolean;
  onPaletteClose: () => void;
  onPaletteOpen: () => void;

  // MobileSignalStream
  signalsOpen: boolean;
  onSignalsClose: () => void;

  // MobileSheet
  levelsOpen: boolean;
  onLevelsClose: () => void;

  // bottom-nav
  mobileTab: "chat" | "levels" | "commands" | "signals";
  onMobileGoToChat: () => void;
  onMobileTab: (tab: "chat" | "levels" | "commands" | "signals") => void;
}
