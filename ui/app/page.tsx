"use client";
import { useState, useRef, useEffect } from "react";
import { Message, MarketData } from "./types";
import Header        from "./components/Header";
import LevelsPanel   from "./components/LevelsPanel";
import ChatPanel     from "./components/ChatPanel";
import CommandPalette from "./components/CommandPalette";
import MobileSheet   from "./components/MobileSheet";

const API        = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SESSION_ID = "satya";

export default function Home() {
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [deskOpen,   setDeskOpen]   = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [marketData, setMarketData] = useState<MarketData | null>(null);
  const [satyAtr,    setSatyAtr]    = useState<string>("");
  const [atrApplied, setAtrApplied] = useState(false);
  const [paletteOpen,  setPaletteOpen]  = useState(false);
  const [levelsOpen,   setLevelsOpen]   = useState(false);    // mobile sheet
  const [mobileTab,    setMobileTab]    = useState<"chat"|"levels"|"commands">("chat");

  const satyAtrRef = useRef<string>("");
  const bottomRef  = useRef<HTMLDivElement>(null);

  // Keep ref in sync with state for interval closure
  useEffect(() => { satyAtrRef.current = satyAtr; }, [satyAtr]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMarketData = (atrOverride?: number) => {
    const atr = atrOverride ?? (satyAtrRef.current ? parseFloat(satyAtrRef.current) : undefined);
    const url = atr && !isNaN(atr) && atr > 0
      ? `${API}/market-data?atr=${atr}`
      : `${API}/market-data`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setMarketData(data);
        if (atrOverride) setAtrApplied(true);
      })
      .catch(() => {});
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
      if (msg === "PREMARKET") {
        const atrVal = satyAtrRef.current ? parseFloat(satyAtrRef.current) : undefined;
        const res = await fetch(`${API}/premarket`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "PREMARKET",
            session_id: SESSION_ID,
            ...(atrVal && !isNaN(atrVal) && atrVal > 0 ? { atr: atrVal } : {}),
          }),
        });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let reply = "";
        setMessages((prev) => [...prev, { role: "assistant", content: "", model: "claude-sonnet-4-6" }]);
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          reply += decoder.decode(value);
          setMessages((prev) => [
            ...prev.slice(0, -1),
            { role: "assistant", content: reply, model: "claude-sonnet-4-6" },
          ]);
        }
        return;
      }

      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, session_id: SESSION_ID }),
      });
      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply, model: data.model }]);
      if (msg === "Open the Desk") setDeskOpen(true);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Could not reach the desk." }]);
    } finally {
      setLoading(false);
    }
  };

  const refreshContext = async () => {
    setRefreshing(true);
    try {
      await fetch(`${API}/refresh-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: SESSION_ID }),
      });
      setMessages([]);
      setDeskOpen(false);
    } finally {
      setRefreshing(false);
    }
  };

  const clearSession = async () => {
    await fetch(`${API}/session/${SESSION_ID}`, { method: "DELETE" });
    setMessages([]);
    setDeskOpen(false);
  };

  const handleAtrChange = (val: string) => {
    setSatyAtr(val);
    setAtrApplied(false);
  };

  const handleAtrApply = (val: number) => {
    fetchMarketData(val);
  };

  const handleAtrReset = () => {
    setSatyAtr("");
    setAtrApplied(false);
    satyAtrRef.current = "";
    fetchMarketData(undefined);
  };

  const handleMobileTab = (tab: "chat" | "levels" | "commands") => {
    setMobileTab(tab);
    if (tab === "levels")   { setLevelsOpen(true); }
    if (tab === "commands") { setPaletteOpen(true); setMobileTab("chat"); }
  };

  return (
    <>
      <div className="layout">
        {/* Header — full width */}
        <Header
          deskOpen={deskOpen}
          refreshing={refreshing}
          onRefresh={refreshContext}
          onClearSession={clearSession}
          marketData={marketData}
        />

        {/* Levels column — desktop only */}
        <div
          className="levels-col"
          style={{
            borderRight: "1px solid #e2e8f0",
            background: "white",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div style={{
            padding: "14px 16px 10px",
            fontSize: "10px", fontWeight: 600, color: "#94a3b8",
            textTransform: "uppercase", letterSpacing: "0.08em",
            borderBottom: "1px solid #f1f5f9",
          }}>
            Today&apos;s Levels
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            <LevelsPanel
              marketData={marketData}
              satyAtr={satyAtr}
              atrApplied={atrApplied}
              onAtrChange={handleAtrChange}
              onApply={handleAtrApply}
              onReset={handleAtrReset}
            />
          </div>
        </div>

        {/* Chat column */}
        <ChatPanel
          messages={messages}
          loading={loading}
          onSend={sendMessage}
          onOpenPalette={() => setPaletteOpen(true)}
          onChartStream={() => {}}
          setMessages={setMessages}
          setLoading={setLoading}
          bottomRef={bottomRef}
        />
      </div>

      {/* Command Palette — renders outside layout */}
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onSelect={sendMessage}
        loading={loading}
      />

      {/* Mobile: Levels bottom sheet */}
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

      {/* Mobile: Bottom nav */}
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
        <button
          className="bnav-item"
          onClick={() => handleMobileTab("commands")}
        >
          <span className="bnav-icon">⌨️</span>
          Commands
        </button>
      </nav>
    </>
  );
}
