"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { useAuth, useUser } from "@clerk/nextjs";
import { Message, MarketData } from "./types";
import { useAlerts } from "./components/AlertPanel";
import DeskShell from "@/features/desk/components/DeskShell";

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
    const et = new Date(
      now.toLocaleString("en-US", { timeZone: "America/New_York" }),
    );
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
    marketStatus === "open"
      ? "Market Open"
      : marketStatus === "premarket"
        ? "Pre-Market"
        : marketStatus === "weekend"
          ? "Weekend"
          : "Market Closed";

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
    } catch {
      /* ignore */
    }
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
    } catch {
      /* ignore */
    }
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
  const [mobileTab, setMobileTab] = useState<
    "chat" | "levels" | "commands" | "signals"
  >("chat");
  const [signalsOpen, setSignalsOpen] = useState(false);
  const [chartInterval, setChartInterval] = useState("3");
  const [challengeInfo, setChallengeInfo] = useState<{
    dayNumber: number;
    currentBalance: number;
    wins: number;
    losses: number;
  } | null>(null);
  const { alerts, isUnread, markRead } = useAlerts();
  const satyAtrRef = useRef<string>("");
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    satyAtrRef.current = satyAtr;
  }, [satyAtr]);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!deskOpen || !deskOpenTime) {
      setSessionDuration("");
      return;
    }
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
      const et = new Date(
        now.toLocaleString("en-US", { timeZone: "America/New_York" }),
      );
      const mins = et.getHours() * 60 + et.getMinutes();
      if (mins >= 975) {
        setDeskOpen(false);
        setDeskOpenTime(null);
        try {
          localStorage.removeItem("otd_desk_open");
          localStorage.removeItem("otd_desk_open_time");
        } catch {
          /* ignore */
        }
      }
    };
    checkAutoClose();
    const id = setInterval(checkAutoClose, 60000);
    return () => clearInterval(id);
  }, [deskOpen]);

  const fetchMarketData = (atrOverride?: number) => {
    const atr =
      atrOverride ??
      (satyAtrRef.current ? parseFloat(satyAtrRef.current) : undefined);
    const url =
      atr && !isNaN(atr) && atr > 0
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

    (async () => {
      try {
        const token = await getToken();
        if (!token) return;

        // Load challenge stats
        const challengeRes = await fetch(`${API}/challenge/stats`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (challengeRes.ok) {
          const d = await challengeRes.json();
          if (d.active && d.stats) {
            setChallengeInfo({
              dayNumber: d.day_number,
              currentBalance: d.stats.current_balance,
              wins: d.stats.wins,
              losses: d.stats.losses,
            });
          }
        }

        // Restore chat history after navigation
        const historyRes = await fetch(`${API}/session/${SESSION_ID}/history`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (historyRes.ok) {
          const data = await historyRes.json();
          if (data.history && data.history.length > 0) {
            setMessages(
              data.history.map((m: { role: string; content: string }) => ({
                role: m.role as "user" | "assistant",
                content: m.content,
                model: "claude-sonnet-4-6",
              })),
            );
          }
        }
      } catch {
        /* silent */
      }
    })();

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
      const authHeader: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) authHeader["Authorization"] = `Bearer ${token}`;

      if (msg === "MORNING BRIEF") {
        const atrVal = satyAtrRef.current
          ? parseFloat(satyAtrRef.current)
          : undefined;
        const res = await fetch(`${API}/morning-brief`, {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({
            message: "MORNING BRIEF",
            session_id: SESSION_ID,
            ...(atrVal && !isNaN(atrVal) && atrVal > 0 ? { atr: atrVal } : {}),
          }),
        });
        const data = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: data.morning_brief,
            model: "claude-sonnet-4-6",
          },
        ]);
        return;
      }

      if (msg === "PREMARKET") {
        const atrVal = satyAtrRef.current
          ? parseFloat(satyAtrRef.current)
          : undefined;
        const res = await fetch(`${API}/premarket`, {
          method: "POST",
          headers: authHeader,
          body: JSON.stringify({
            message: "PREMARKET",
            session_id: SESSION_ID,
            ...(atrVal && !isNaN(atrVal) && atrVal > 0 ? { atr: atrVal } : {}),
          }),
        });
        const reader = res.body!.getReader();
        const decoder = new TextDecoder();
        let reply = "";
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "", model: "claude-sonnet-4-6" },
        ]);
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
        headers: authHeader,
        body: JSON.stringify({ message: msg, session_id: SESSION_ID }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply, model: data.model },
      ]);
      if (msg === "Open the Desk") {
        const now = new Date();
        setDeskOpen(true);
        setDeskOpenTime(now);
        try {
          localStorage.setItem("otd_desk_open", "true");
          localStorage.setItem("otd_desk_open_time", now.toISOString());
        } catch {
          /* ignore */
        }
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Could not reach the desk." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const refreshContext = async () => {
    setRefreshing(true);
    try {
      const token = await getToken();
      const authHeader: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) authHeader["Authorization"] = `Bearer ${token}`;
      await fetch(`${API}/refresh-context`, {
        method: "POST",
        headers: authHeader,
        body: JSON.stringify({ session_id: SESSION_ID }),
      });
      setMessages([]);
      setDeskOpen(false);
      setDeskOpenTime(null);
      try {
        localStorage.removeItem("otd_desk_open");
        localStorage.removeItem("otd_desk_open_time");
      } catch {
        /* ignore */
      }
    } finally {
      setRefreshing(false);
    }
  };

  const clearSession = async () => {
    const token = await getToken();
    const authHeader: Record<string, string> = {};
    if (token) authHeader["Authorization"] = `Bearer ${token}`;
    await fetch(`${API}/session/${SESSION_ID}`, {
      method: "DELETE",
      headers: authHeader,
    });
    setMessages([]);
    setDeskOpen(false);
    setDeskOpenTime(null);
    try {
      localStorage.removeItem("otd_desk_open");
      localStorage.removeItem("otd_desk_open_time");
    } catch {
      /* ignore */
    }
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

  const runMorningBrief = async () => {
    if (briefLoading) return;
    setBriefLoading(true);
    setMessages((prev) => [
      ...prev,
      { role: "user" as const, content: "MORNING BRIEF" },
    ]);
    try {
      const token = await getToken();
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const atrVal = satyAtrRef.current
        ? parseFloat(satyAtrRef.current)
        : undefined;
      const res = await fetch(`${API}/morning-brief`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: "MORNING BRIEF",
          session_id: SESSION_ID,
          ...(atrVal && !isNaN(atrVal) && atrVal > 0 ? { atr: atrVal } : {}),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant" as const,
          content: data.morning_brief,
          model: "claude-sonnet-4-6",
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant" as const,
          content:
            "⚠️ Morning Brief failed to load. Check your connection and try again.",
        },
      ]);
    } finally {
      setBriefLoading(false);
    }
  };

  const openDesk = async () => {
    if (!canOpenDesk) return;
    const now = new Date();
    setDeskOpen(true);
    setDeskOpenTime(now);
    try {
      localStorage.setItem("otd_desk_open", "true");
      localStorage.setItem("otd_desk_open_time", now.toISOString());
    } catch {
      /* ignore */
    }
    await sendMessage("Open the Desk");
  };

  // Parse bias/Mag7 from the last morning brief assistant message
  const briefData = useMemo(() => {
    const briefMsg = [...messages]
      .reverse()
      .find(
        (m) =>
          m.role === "assistant" &&
          m.content.includes("BIAS") &&
          m.content.length > 200,
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
    ? Math.ceil(
        (deskOpenTime.getTime() -
          new Date(deskOpenTime.getFullYear(), 0, 1).getTime()) /
          (1000 * 60 * 60 * 24),
      )
    : "—";

  const handleMobileTab = (tab: "chat" | "levels" | "commands" | "signals") => {
    setMobileTab(tab);
    if (tab === "levels") setLevelsOpen(true);
    if (tab === "commands") {
      setPaletteOpen(true);
      setMobileTab("chat");
    }
    if (tab === "signals") setSignalsOpen(true);
  };

  return (
    <DeskShell
      deskOpen={deskOpen}
      refreshing={refreshing}
      onRefresh={refreshContext}
      onClearSession={clearSession}
      marketData={marketData}
      sessionDuration={sessionDuration}
      briefVisible={briefData !== null}
      briefBias={briefData?.bias ?? ""}
      briefMag7Bull={briefData?.mag7Bull ?? 0}
      briefMag7Bear={briefData?.mag7Bear ?? 0}
      briefMag7Mixed={briefData?.mag7Mixed ?? 0}
      briefWarning={briefData?.warning ?? ""}
      briefBullLevel={briefData?.bullLevel ?? null}
      briefBearLevel={briefData?.bearLevel ?? null}
      onBriefExpand={() => bottomRef.current?.scrollIntoView({ behavior: "smooth" })}
      satyAtr={satyAtr}
      atrApplied={atrApplied}
      onAtrChange={handleAtrChange}
      onAtrApply={handleAtrApply}
      onAtrReset={handleAtrReset}
      chartInterval={chartInterval}
      onChartIntervalChange={setChartInterval}
      tdNumber={tdNumber}
      challengeInfo={challengeInfo}
      messages={messages}
      loading={loading}
      onSend={sendMessage}
      setMessages={setMessages}
      setLoading={setLoading}
      bottomRef={bottomRef}
      onMorningBrief={runMorningBrief}
      onOpenDesk={openDesk}
      firstName={firstName}
      briefLoading={briefLoading}
      canOpenDesk={canOpenDesk}
      marketStatusLabel={marketStatusLabel}
      alerts={alerts}
      isUnread={isUnread}
      markRead={markRead}
      paletteOpen={paletteOpen}
      onPaletteClose={() => setPaletteOpen(false)}
      onPaletteOpen={() => setPaletteOpen(true)}
      signalsOpen={signalsOpen}
      onSignalsClose={() => {
        setSignalsOpen(false);
        setMobileTab("chat");
      }}
      levelsOpen={levelsOpen}
      onLevelsClose={() => {
        setLevelsOpen(false);
        setMobileTab("chat");
      }}
      mobileTab={mobileTab}
      onMobileGoToChat={() => {
        setLevelsOpen(false);
        setMobileTab("chat");
      }}
      onMobileTab={handleMobileTab}
    />
  );
}
