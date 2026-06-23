"use client";

import type { RefObject } from "react";
import type { Message } from "@/app/types";
import ChartStrip from "@/app/components/ChartStrip";
import SessionBar from "@/app/components/SessionBar";
import ChatPanel from "@/app/components/ChatPanel";
import s from "@/features/desk/styles/deskWorkspace.module.css";

interface ChallengeInfo {
  dayNumber: number;
  currentBalance: number;
  wins: number;
  losses: number;
}

interface DeskWorkspaceProps {
  chartInterval: string;
  onChartIntervalChange: (tf: string) => void;
  tdNumber: string | number;
  challengeInfo: ChallengeInfo | null;
  messages: Message[];
  loading: boolean;
  onSend: (msg: string) => void;
  onOpenPalette: () => void;
  setMessages: (fn: (prev: Message[]) => Message[]) => void;
  setLoading: (v: boolean) => void;
  bottomRef: RefObject<HTMLDivElement | null>;
  deskOpen: boolean;
  onMorningBrief: () => void;
  onOpenDesk: () => void;
  firstName: string;
  briefLoading: boolean;
  canOpenDesk: boolean;
  marketStatusLabel: string;
}

export default function DeskWorkspace({
  chartInterval,
  onChartIntervalChange,
  tdNumber,
  challengeInfo,
  messages,
  loading,
  onSend,
  onOpenPalette,
  setMessages,
  setLoading,
  bottomRef,
  deskOpen,
  onMorningBrief,
  onOpenDesk,
  firstName,
  briefLoading,
  canOpenDesk,
  marketStatusLabel,
}: DeskWorkspaceProps) {
  return (
    <div className={s.workspace}>
      <ChartStrip interval={chartInterval} onIntervalChange={onChartIntervalChange} />
      <SessionBar
        tdNumber={tdNumber}
        trades={0}
        pnl={0}
        wins={0}
        losses={0}
        budgetUsed={0}
        budgetLimit={500}
        challenge={challengeInfo}
      />
      <div className={s.chatWrapper}>
        <ChatPanel
          messages={messages}
          loading={loading}
          onSend={onSend}
          onOpenPalette={onOpenPalette}
          onChartStream={() => {}}
          setMessages={setMessages}
          setLoading={setLoading}
          bottomRef={bottomRef}
          deskOpen={deskOpen}
          onMorningBrief={onMorningBrief}
          onOpenDesk={onOpenDesk}
          firstName={firstName}
          briefLoading={briefLoading}
          canOpenDesk={canOpenDesk}
          marketStatusLabel={marketStatusLabel}
        />
      </div>
    </div>
  );
}
