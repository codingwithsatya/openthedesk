"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Message, MarketData } from "./types";
import Header from "./components/Header";
import LevelsPanel from "./components/LevelsPanel";
import FlowPanel from "./components/FlowPanel";
import ChatPanel from "./components/ChatPanel";
import CommandPalette from "./components/CommandPalette";
import MobileSheet from "./components/MobileSheet";
import MorningBriefBanner from "./components/MorningBriefBanner";
import ChartStrip from "./components/ChartStrip";
import SessionBar from "./components/SessionBar";
import SignalStream from "./components/SignalStream";
import { useAlerts } from "./components/AlertPanel";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SESSION_ID = "satya";

export default function Home() {
  const { getToken } = useAuth();
  const { user } = useUser();
  const firstName = user?.firstName
    ? user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1)
    : "Satya";

  const getMarketStatus = () => {
    const now = new Date();
    const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const day = et.getDay();
    const h = et.getHours();
    const m = et.getMinutes();
    const mins = h * 60 + m;
    if (day === 0 || day === 6) return "weekend";
    if (mins < 480) return "premarket_early";
    if (mins < 570) return "premarket";
    if (mins < 960) return "open";
    return "closed";
  };
  const marketStatus = getMarketStatus();
  const canOpenDesk = marketStatus === "open";
  const marketStatusLabel =
    marketStatus === "open" ? "Market Open" :
    marketStatus === "premarket" ? "Pre-Market" :
    marketStatus === "weekend" ? "Weekend" :
    "Market Closed";

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [deskOpen, setDeskOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      const stored = localStorage.getItem("otd_desk_open");
      const timeStr = localStorage.getItem("otd_desk_open_time");
      if (stored === "true" && timeStr) {
        const openedAt = new Date(timeStr);
        const hoursAgo = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
        return hoursAgo < 12;
      }
    } catch { /* ignore */ }
    return false;
  });
  const [deskOpenTime, setDeskOpenTime] = useState<Date | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = localStorage.getItem("otd_desk_open");
      const timeStr = localStorage.getItem("otd_desk_open_time");
      if (stored === "true" && timeStr) {
        const openedAt = new Date(timeStr);
        const hoursAgo = (Date.now() - openedAt.getTime()) / (1000 * 60 * 60);
        if (hoursAgo < 12) return openedAt;
      }
    } catch { /* ignore */ }
    return null;
  });
  const [sessionDuration, setSessionDuration] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [satyAtr, setSatyAtr] = useState<string>("");
  const [atrApplied, setAtrApplied] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [mobileTab, setMobileTab] = useState<"chat" | "levels" | "commands">("chat");
  const [chartInterval, setChartInterval] = useState("3");
  const { alerts, isUnread, markRead } = useAlerts();
  const satyAtrRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { satyAtrRef.current = satyAtr; }, [satyAtr]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (!deskOpen || !deskOpenTime) { setSessionDuration(""); return; }
    const tick = () => {
      const diff = Math.floor((Date.now() - deskOpenTime.getTime()) / 1000);
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      setSessionDuration(h > 0 ? `${h}h ${m}m` : `${m}m`);
    };
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [deskOpen, deskOpenTime]);

  useEffect(() => {
    const checkAutoClose = () => {
      if (!deskOpen) return;
      const now = new Date();
      const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
      const mins = et.getHours() * 60 + et.getMinutes();
      if (mins >= 975) {
        setDeskOpen(false);
        setDeskOpenTime(null);
        try {
          localStorage.removeItem("otd_desk_open");
          localStorage.removeItem("otd_desk_open_time");
        } catch { /* ignore */ }
      }
    };
    checkAutoClose();
    const id = setInterval(checkAutoClose, 60000);
    return () => clearInterval(id);
  }, [deskOpen]);

  const fetchMarketData = (atrOverride?: number) => {
    const atr = atrOverride ?? (satyAtrRef.current ? parseFloat(satyAtrRef.current) : undefined);
    const url = atr && !isNaN(atr) && atr > 0 ? `${API}/market-data?atr=${atr}` : `${API}/market-data`;
    fetch(url).then((r) => r.json()).then((data) => {
      setMarketData(data);
      if (atrOverride) setAtrApplied(true);
    }).catch(() => {});
  };

  useEffect(() => {
    fetchMarketData();
    const interval = setInterval(() => fetchMarketData(), 60_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const msg = text.trim();
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);
    try {
      const token = await getToken();
      const authHeader: Record<string, string> = { "Content-Type": "application/json" };
      if (token) authHeader["Authorization"] = `Bearer ${token}`;

      if (msg === "MORNING BRIEF") {
        const atrVal = satyAtrRef.current ? parseFloat(satyAtrRef.current) : undefined;
        const res = await fetch(`${API}/morning-brief`, {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({ message: "MORNING BRIEF", session_id: SESSION_ID, ...(atrVal && !isNaN(atrVal) && atrVal > 0 ? { atr: atrVal } : {}) }),
        });
        const data = await res.json();
        setMessages((prev) => [...prev, { role: "assistant", content: data.morning_brief, model: "claude-sonnet-4-6" }]);
        return;
      }

      if (msg === "PREMARKET") {
        const atrVal = satyAtrRef.current ? parseFloat(satyAtrRef.current) : undefined;
        const res = await fetch(`${API}/premarket`, {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({ message: "PREMARKET", session_id: SESSION_ID, ...(atrVal && !isNaN(atrVal) && atrVal > 0 ? { atr: atrVal } : {}) }),
        });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let reply = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "", model: "claude-sonnet-4-6" }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply += decoder.decode(value);
          setMessages((prev) => [...prev.slice(0, -1), { role: "assistant", content: reply, model: "claude-sonnet-4-6" }]);
        }
        return;
      }

      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ message: msg, session_id: SESSION_ID }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, model: data.model }]);
      if (msg === "Open the Desk") {
        const now = new Date();
        setDeskOpen(true);
        setDeskOpenTime(now);
        try {
          localStorage.setItem("otd_desk_open", "true");
          localStorage.setItem("otd_desk_open_time", now.toISOString());
        } catch { /* ignore */ }
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Could not reach the desk." }]);
    } finally {
      setLoading(false);
    }
  };

  const refreshContext = async () => {
    setRefreshing(true);
    try {
      const token = await getToken();
      const authHeader: Record<string, string> = { "Content-Type": "application/json" };
      if (token) authHeader["Authorization"] = `Bearer ${token}`;
      await fetch(`${API}/refresh-context`, { method: "POST", headers: authHeader, body: JSON.stringify({ session_id: SESSION_ID }) });
      setMessages([]);
      setDeskOpen(false);
      setDeskOpenTime(null);
      try { localStorage.removeItem("otd_desk_open"); localStorage.removeItem("otd_desk_open_time"); } catch { /* ignore */ }
    } finally {
      setRefreshing(false);
    }
  };

  const clearSession = async () => {
    const token = await getToken();
    const authHeader: Record<string, string> = {};
    if (token) authHeader["Authorization"] = `Bearer ${token}`;
    await fetch(`${API}/session/${SESSION_ID}`, { method: "DELETE", headers: authHeader });
    setMessages([]);
    setDeskOpen(false);
    setDeskOpenTime(null);
    try { localStorage.removeItem("otd_desk_open"); localStorage.removeItem("otd_desk_open_time"); } catch { /* ignore */ }
  };

  const handleAtrChange = (val: string) => { setSatyAtr(val); setAtrApplied(false); };
  const handleAtrApply = (val: number) => { fetchMarketData(val); };
  const handleAtrReset = () => { setSatyAtr(""); setAtrApplied(false); satyAtrRef.current = ""; fetchMarketData(undefined); };

  const runMorningBrief = async () => {
    if (briefLoading) return;
    setBriefLoading(true);
    setMessages((prev) => [...prev, { role: "user" as const, content: "MORNING BRIEF" }]);
    try {
      const token = await getToken();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const atrVal = satyAtrRef.current ? parseFloat(satyAtrRef.current) : undefined;
      const res = await fetch(`${API}/morning-brief`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: "MORNING BRIEF", session_id: SESSION_ID, ...(atrVal && !isNaN(atrVal) && atrVal > 0 ? { atr: atrVal } : {}) }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant" as const, content: data.morning_brief, model: "claude-sonnet-4-6" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant" as const, content: "⚠️ Morning Brief failed to load. Check your connection and try again." }]);
    } finally {
      setBriefLoading(false);
    }
  };

  const openDesk = async () => {
    if (!canOpenDesk) return;
    const now = new Date();
    setDeskOpen(true);
    setDeskOpenTime(now);
    try { localStorage.setItem("otd_desk_open", "true"); localStorage.setItem("otd_desk_open_time", now.toISOString()); } catch { /* ignore */ }
    await sendMessage("Open the Desk");
  };

  // Parse bias/Mag7 from the last morning brief assistant message
  const briefData = useMemo(() => {
    const briefMsg = [...messages].reverse().find(
      (m) => m.role === "assistant" && m.content.includes("BIAS") && m.content.length > 200,
    );
    if (!briefMsg) return null;
    const text = briefMsg.content;
    const biasMatch = text.match(/BIAS[:\s*_]*([A-Z][A-Z\s\-]+?)(?:\n|$)/i);
    const bullMatch = text.match(/(\d+)\s+BULL/i);
    const bearMatch = text.match(/(\d+)\s+BEAR/i);
    const mixedMatch = text.match(/(\d+)\s+(?:MIXED|NEUTRAL)/i);
    const bullLevelMatch = text.match(/BULL[^:]*[:>]\s*([\d.]+)/i);
    const bearLevelMatch = text.match(/BEAR[^:]*[:>]\s*([\d.]+)/i);
    const warningMatch = text.match(/(?:⚠|WARN|RISK|CAUTION)[^\n]*([^\n]+)/i);
    return {
      bias: biasMatch ? biasMatch[1].trim() : "",
      mag7Bull: bullMatch ? parseInt(bullMatch[1]) : 0,
      mag7Bear: bearMatch ? parseInt(bearMatch[1]) : 0,
      mag7Mixed: mixedMatch ? parseInt(mixedMatch[1]) : 0,
      bullLevel: bullLevelMatch ? parseFloat(bullLevelMatch[1]) : null,
      bearLevel: bearLevelMatch ? parseFloat(bearLevelMatch[1]) : null,
      warning: warningMatch ? warningMatch[1].trim() : "",
    };
  }, [messages]);

  const tdNumber = deskOpenTime
    ? Math.ceil((deskOpenTime.getTime() - new Date(deskOpenTime.getFullYear(), 0, 1).getTime()) / (1000 * 60 * 60 * 24))
    : "—";

  const handleMobileTab = (tab: "chat" | "levels" | "commands") => {
    setMobileTab(tab);
    if (tab === "levels") setLevelsOpen(true);
    if (tab === "commands") { setPaletteOpen(true); setMobileTab("chat"); }
  };

  return (
    <>
      <div className="otd-layout">
        <Header
          deskOpen={deskOpen}
          refreshing={refreshing}
          onRefresh={refreshContext}
          onClearSession={clearSession}
          marketData={marketData}
          sessionDuration={sessionDuration}
        />

        <MorningBriefBanner
          visible={briefData !== null}
          bias={briefData?.bias ?? ""}
          mag7Bull={briefData?.mag7Bull ?? 0}
          mag7Bear={briefData?.mag7Bear ?? 0}
          mag7Mixed={briefData?.mag7Mixed ?? 0}
          warning={briefData?.warning ?? ""}
          bullLevel={briefData?.bullLevel ?? null}
          bearLevel={briefData?.bearLevel ?? null}
          onExpand={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
        />

        <div className="otd-columns">
          {/* Left — levels + flow */}
          <div className="otd-left-col">
            <div className="otd-left-header">Today&apos;s Levels</div>
            <div className="otd-left-body">
              <LevelsPanel
                marketData={marketData}
                satyAtr={satyAtr}
                atrApplied={atrApplied}
                onAtrChange={handleAtrChange}
                onApply={handleAtrApply}
                onReset={handleAtrReset}
              />
              <FlowPanel marketData={marketData} />
            </div>
          </div>

          {/* Center — chart + session bar + chat */}
          <div className="otd-center">
            <ChartStrip interval={chartInterval} onIntervalChange={setChartInterval} />
            <SessionBar
              tdNumber={tdNumber}
              trades={0}
              pnl={0}
              wins={0}
              losses={0}
              budgetUsed={0}
              budgetLimit={500}
            />
            <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
              <ChatPanel
                messages={messages}
                loading={loading}
                onSend={sendMessage}
                onOpenPalette={() => setPaletteOpen(true)}
                onChartStream={() => {}}
                setMessages={setMessages}
                setLoading={setLoading}
                bottomRef={bottomRef}
                deskOpen={deskOpen}
                onMorningBrief={runMorningBrief}
                onOpenDesk={openDesk}
                firstName={firstName}
                briefLoading={briefLoading}
                canOpenDesk={canOpenDesk}
                marketStatusLabel={marketStatusLabel}
              />
            </div>
          </div>

          {/* Right — signal stream */}
          <SignalStream
            alerts={alerts}
            isUnread={isUnread}
            markRead={markRead}
          />
        </div>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={sendMessage}
        loading={loading}
      />

      <MobileSheet
        open={levelsOpen}
        onClose={() => { setLevelsOpen(false); setMobileTab("chat"); }}
        marketData={marketData}
        satyAtr={satyAtr}
        atrApplied={atrApplied}
        onAtrChange={handleAtrChange}
        onApply={handleAtrApply}
        onReset={handleAtrReset}
      />

      <nav className="bottom-nav">
        <button
          className={`bnav-item ${mobileTab === "chat" ? "active" : ""}`}
          onClick={() => { setLevelsOpen(false); setMobileTab("chat"); }}
        >
          <span className="bnav-icon">💬</span>
          Chat
        </button>
        <button
          className={`bnav-item ${mobileTab === "levels" ? "active" : ""}`}
          onClick={() => handleMobileTab("levels")}
        >
          <span className="bnav-icon">📊</span>
          Levels
        </button>
        <button className="bnav-item" onClick={() => handleMobileTab("commands")}>
          <span className="bnav-icon">⌨️</span>
          Commands
        </button>
      </nav>
    </>
  );
}
