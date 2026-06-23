"use client";

import Header from "@/app/components/Header";
import MorningBriefBanner from "@/app/components/MorningBriefBanner";
import LevelsPanel from "@/app/components/LevelsPanel";
import FlowPanel from "@/app/components/FlowPanel";
import SignalStream from "@/app/components/SignalStream";
import CommandPalette from "@/app/components/CommandPalette";
import MobileSignalStream from "@/app/components/MobileSignalStream";
import MobileSheet from "@/app/components/MobileSheet";
import AppIconRail from "@/app/components/AppIconRail";
import DeskWorkspace from "./DeskWorkspace";
import s from "@/features/desk/styles/deskShell.module.css";
import type { DeskShellProps } from "@/features/desk/lib/types";

export default function DeskShell({
  deskOpen,
  refreshing,
  onRefresh,
  onClearSession,
  marketData,
  sessionDuration,
  briefVisible,
  briefBias,
  briefMag7Bull,
  briefMag7Bear,
  briefMag7Mixed,
  briefWarning,
  briefBullLevel,
  briefBearLevel,
  onBriefExpand,
  satyAtr,
  atrApplied,
  onAtrChange,
  onAtrApply,
  onAtrReset,
  chartInterval,
  onChartIntervalChange,
  tdNumber,
  challengeInfo,
  messages,
  loading,
  onSend,
  setMessages,
  setLoading,
  bottomRef,
  onMorningBrief,
  onOpenDesk,
  firstName,
  briefLoading,
  canOpenDesk,
  marketStatusLabel,
  alerts,
  isUnread,
  markRead,
  paletteOpen,
  onPaletteClose,
  onPaletteOpen,
  signalsOpen,
  onSignalsClose,
  levelsOpen,
  onLevelsClose,
  mobileTab,
  onMobileGoToChat,
  onMobileTab,
}: DeskShellProps) {
  return (
    <>
      <div className={s.page}>
        <Header
          deskOpen={deskOpen}
          refreshing={refreshing}
          onRefresh={onRefresh}
          onClearSession={onClearSession}
          marketData={marketData}
          sessionDuration={sessionDuration}
        />

        <MorningBriefBanner
          visible={briefVisible}
          bias={briefBias}
          mag7Bull={briefMag7Bull}
          mag7Bear={briefMag7Bear}
          mag7Mixed={briefMag7Mixed}
          warning={briefWarning}
          bullLevel={briefBullLevel}
          bearLevel={briefBearLevel}
          onExpand={onBriefExpand}
        />

        <div className={s.shell}>
          <AppIconRail activePage="desk" />

          <div className={s.columns}>
            <div className={s.leftCol}>
              <div className={s.leftHeader}>Today&apos;s Levels</div>
              <div className={s.leftBody}>
                <LevelsPanel
                  marketData={marketData}
                  satyAtr={satyAtr}
                  atrApplied={atrApplied}
                  onAtrChange={onAtrChange}
                  onApply={onAtrApply}
                  onReset={onAtrReset}
                />
                <FlowPanel marketData={marketData} />
              </div>
            </div>

            <DeskWorkspace
              chartInterval={chartInterval}
              onChartIntervalChange={onChartIntervalChange}
              tdNumber={tdNumber}
              challengeInfo={challengeInfo}
              messages={messages}
              loading={loading}
              onSend={onSend}
              onOpenPalette={onPaletteOpen}
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

            <SignalStream alerts={alerts} isUnread={isUnread} markRead={markRead} />
          </div>
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={onPaletteClose}
        onSelect={onSend}
        loading={loading}
      />

      <MobileSignalStream
        open={signalsOpen}
        onClose={onSignalsClose}
        alerts={alerts}
        isUnread={isUnread}
        markRead={markRead}
      />

      <MobileSheet
        open={levelsOpen}
        onClose={onLevelsClose}
        marketData={marketData}
        satyAtr={satyAtr}
        atrApplied={atrApplied}
        onAtrChange={onAtrChange}
        onApply={onAtrApply}
        onReset={onAtrReset}
      />

      <nav className="bottom-nav">
        <button
          className={`bnav-item ${mobileTab === "chat" ? "active" : ""}`}
          onClick={onMobileGoToChat}
        >
          <span className="bnav-icon">💬</span>
          Chat
        </button>
        <button
          className={`bnav-item ${mobileTab === "levels" ? "active" : ""}`}
          onClick={() => onMobileTab("levels")}
        >
          <span className="bnav-icon">📊</span>
          Levels
        </button>
        <button className="bnav-item" onClick={() => onMobileTab("commands")}>
          <span className="bnav-icon">⌨️</span>
          Commands
        </button>
        <button
          className={`bnav-item ${mobileTab === "signals" ? "active" : ""}`}
          onClick={() => onMobileTab("signals")}
        >
          <span className="bnav-icon">📡</span>
          Signals
        </button>
      </nav>
    </>
  );
}
