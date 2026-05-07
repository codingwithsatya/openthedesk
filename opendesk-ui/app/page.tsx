"use client";
import { useState, useRef, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SESSION_ID = "satya";

const SHORTCUTS = [
  {
    label: "Open the Desk",
    cmd: "Open the Desk",
    color: "#16a34a",
    bg: "#f0fdf4",
    border: "#bbf7d0",
  },
  {
    label: "PTR-FAST",
    cmd: "PTR-FAST",
    color: "#1d4ed8",
    bg: "#eff6ff",
    border: "#bfdbfe",
  },
  {
    label: "PTR-FULL",
    cmd: "PTR-FULL",
    color: "#4338ca",
    bg: "#eef2ff",
    border: "#c7d2fe",
  },
  {
    label: "PREMARKET",
    cmd: "PREMARKET",
    color: "#7e22ce",
    bg: "#faf5ff",
    border: "#e9d5ff",
  },
  {
    label: "TRADE IDEA",
    cmd: "TRADE IDEA",
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fde68a",
  },
  {
    label: "IN TRADE",
    cmd: "IN TRADE",
    color: "#c2410c",
    bg: "#fff7ed",
    border: "#fed7aa",
  },
  {
    label: "TRADE REVIEW",
    cmd: "TRADE REVIEW",
    color: "#0f766e",
    bg: "#f0fdfa",
    border: "#99f6e4",
  },
  {
    label: "EOD",
    cmd: "EOD",
    color: "#b91c1c",
    bg: "#fef2f2",
    border: "#fecaca",
  },
  {
    label: "PATTERN CHECK",
    cmd: "PATTERN CHECK",
    color: "#9d174d",
    bg: "#fdf2f8",
    border: "#f9a8d4",
  },
  {
    label: "MARKET REGIME",
    cmd: "MARKET REGIME",
    color: "#6d28d9",
    bg: "#f5f3ff",
    border: "#ddd6fe",
  },
  {
    label: "CAPITAL PROTECTION",
    cmd: "CAPITAL PROTECTION",
    color: "#991b1b",
    bg: "#fff1f2",
    border: "#fecdd3",
  },
  {
    label: "BLUNT FEEDBACK",
    cmd: "BLUNT FEEDBACK",
    color: "#374151",
    bg: "#f9fafb",
    border: "#d1d5db",
  },
  {
    label: "WEEKLY REVIEW",
    cmd: "WEEKLY REVIEW",
    color: "#0369a1",
    bg: "#f0f9ff",
    border: "#bae6fd",
  },
  {
    label: "WIRE OUT",
    cmd: "WIRE OUT",
    color: "#065f46",
    bg: "#ecfdf5",
    border: "#a7f3d0",
  },
];

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [deskOpen, setDeskOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const msg = text.trim();
    setInput("");
    if (textareaRef.current) textareaRef.current.style.height = "44px";
    setMessages((prev) => [...prev, { role: "user", content: msg }]);
    setLoading(true);

    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, session_id: SESSION_ID }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply },
      ]);
      if (msg === "Open the Desk") setDeskOpen(true);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "⚠️ Could not reach the desk. Is the backend running?",
        },
      ]);
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

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "44px";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Inter', sans-serif; background: #f8fafc; color: #0f172a; height: 100vh; overflow: hidden; }
        
        .layout { display: grid; grid-template-columns: 220px 1fr; grid-template-rows: 56px 1fr; height: 100vh; }

        /* Header */
        .header {
          grid-column: 1 / -1;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 20px;
          background: white;
          border-bottom: 1px solid #e2e8f0;
        }
        .header-left { display: flex; align-items: center; gap: 12px; }
        .logo-wrap { display: flex; align-items: center; gap: 8px; }
        .logo-icon {
          width: 30px; height: 30px; border-radius: 8px;
          background: linear-gradient(135deg, #16a34a, #15803d);
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 700; color: white; letter-spacing: -0.5px;
        }
        .logo-text { font-size: 15px; font-weight: 600; color: #0f172a; letter-spacing: -0.3px; }
        .divider-v { width: 1px; height: 20px; background: #e2e8f0; }
        .status-badge {
          display: flex; align-items: center; gap: 5px;
          padding: 3px 10px; border-radius: 99px;
          font-size: 11px; font-weight: 600; letter-spacing: 0.04em;
          text-transform: uppercase; transition: all 0.3s;
        }
        .status-badge.open { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
        .status-badge.closed { background: #f8fafc; color: #94a3b8; border: 1px solid #e2e8f0; }
        .status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
        .status-dot.pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        .header-right { display: flex; gap: 6px; }
        .hbtn {
          padding: 6px 14px; border-radius: 7px; font-size: 12px; font-weight: 500;
          font-family: 'Inter', sans-serif; cursor: pointer; transition: all 0.15s;
          border: 1px solid #e2e8f0; background: white; color: #64748b;
        }
        .hbtn:hover { background: #f8fafc; color: #0f172a; border-color: #cbd5e1; }
        .hbtn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* Sidebar */
        .sidebar {
          background: white;
          border-right: 1px solid #e2e8f0;
          display: flex; flex-direction: column;
          overflow: hidden;
        }
        .sidebar-header {
          padding: 14px 16px 10px;
          font-size: 10px; font-weight: 600; color: #94a3b8;
          text-transform: uppercase; letter-spacing: 0.08em;
          border-bottom: 1px solid #f1f5f9;
        }
        .shortcut-list {
          flex: 1; overflow-y: auto; padding: 8px;
          scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent;
        }
        .shortcut-list::-webkit-scrollbar { width: 3px; }
        .shortcut-list::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }
        .shortcut-btn {
          width: 100%; text-align: left;
          padding: 7px 10px; border-radius: 7px; margin-bottom: 2px;
          font-size: 12px; font-weight: 500; font-family: 'Inter', sans-serif;
          cursor: pointer; transition: all 0.12s; border: 1px solid transparent;
          display: flex; align-items: center; gap: 8px;
        }
        .shortcut-btn:hover { filter: brightness(0.97); transform: translateX(2px); }
        .shortcut-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .shortcut-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }

        /* Chat */
        .chat { display: flex; flex-direction: column; overflow: hidden; background: #f8fafc; }

        .messages {
          flex: 1; overflow-y: auto; padding: 24px 28px;
          display: flex; flex-direction: column; gap: 16px;
          scrollbar-width: thin; scrollbar-color: #e2e8f0 transparent;
        }
        .messages::-webkit-scrollbar { width: 4px; }
        .messages::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 99px; }

        /* Empty state */
        .empty {
          flex: 1; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 20px; text-align: center;
        }
        .empty-icon {
          width: 64px; height: 64px; border-radius: 18px;
          background: linear-gradient(135deg, #f0fdf4, #dcfce7);
          border: 1px solid #bbf7d0;
          display: flex; align-items: center; justify-content: center; font-size: 28px;
        }
        .empty-title { font-size: 20px; font-weight: 600; color: #0f172a; letter-spacing: -0.4px; }
        .empty-sub { font-size: 13px; color: #64748b; line-height: 1.6; margin-top: 4px; }
        .open-desk-btn {
          padding: 12px 28px; background: #16a34a; color: white;
          font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600;
          border: none; border-radius: 10px; cursor: pointer; transition: all 0.15s;
          letter-spacing: 0.01em; margin-top: 4px;
        }
        .open-desk-btn:hover { background: #15803d; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(22,163,74,0.25); }

        /* Message rows */
        .msg-row { display: flex; gap: 10px; max-width: 760px; width: 100%; }
        .msg-row.user { align-self: flex-end; flex-direction: row-reverse; }
        .msg-row.assistant { align-self: flex-start; }

        .msg-av {
          width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; margin-top: 2px;
        }
        .msg-av.user { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
        .msg-av.desk { background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; }

        .msg-bubble {
          padding: 12px 16px; border-radius: 12px;
          font-size: 13px; line-height: 1.75; white-space: pre-wrap;
          font-family: 'JetBrains Mono', monospace; max-width: calc(100% - 40px);
        }
        .msg-bubble.user {
          background: #1d4ed8; color: white;
          border-radius: 12px 12px 4px 12px;
        }
        .msg-bubble.desk {
          background: white; color: #1e293b;
          border: 1px solid #e2e8f0; border-radius: 12px 12px 12px 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }

        /* Typing */
        .typing {
          padding: 14px 16px; background: white; border: 1px solid #e2e8f0;
          border-radius: 12px 12px 12px 4px; display: flex; gap: 4px; align-items: center;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04);
        }
        .tdot {
          width: 6px; height: 6px; border-radius: 50%; background: #94a3b8;
          animation: bounce 1.4s infinite ease-in-out;
        }
        .tdot:nth-child(2) { animation-delay: 0.2s; }
        .tdot:nth-child(3) { animation-delay: 0.4s; }
        @keyframes bounce { 0%,80%,100%{transform:scale(0.8);opacity:0.4} 40%{transform:scale(1.2);opacity:1} }

        /* Input area */
        .input-area {
          padding: 12px 20px 16px; background: white;
          border-top: 1px solid #e2e8f0;
        }
        .input-row { display: flex; gap: 8px; align-items: flex-end; }
        .input-box {
          flex: 1; padding: 10px 14px; border-radius: 10px; border: 1px solid #e2e8f0;
          font-family: 'JetBrains Mono', monospace; font-size: 13px; color: #1e293b;
          background: #f8fafc; outline: none; resize: none; min-height: 44px;
          max-height: 120px; transition: border-color 0.15s; line-height: 1.5;
        }
        .input-box::placeholder { color: #94a3b8; }
        .input-box:focus { border-color: #93c5fd; background: white; }
        .send-btn {
          width: 44px; height: 44px; border-radius: 10px; background: #1d4ed8;
          border: none; cursor: pointer; display: flex; align-items: center;
          justify-content: center; flex-shrink: 0; transition: all 0.15s;
          font-size: 16px; color: white;
        }
        .send-btn:hover:not(:disabled) { background: #1e40af; transform: translateY(-1px); }
        .send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
      `}</style>

      <div className="layout">
        {/* Header */}
        <header className="header">
          <div className="header-left">
            <div className="logo-wrap">
              <div className="logo-icon">OD</div>
              <span className="logo-text">OpenTheDesk</span>
            </div>
            <div className="divider-v" />
            <div className={`status-badge ${deskOpen ? "open" : "closed"}`}>
              <div className={`status-dot ${deskOpen ? "pulse" : ""}`} />
              {deskOpen ? "Desk Open" : "Desk Closed"}
            </div>
          </div>
          <div className="header-right">
            <button
              className="hbtn"
              onClick={refreshContext}
              disabled={refreshing}
            >
              {refreshing ? "Refreshing..." : "↻ Refresh Context"}
            </button>
            <button className="hbtn" onClick={clearSession}>
              Clear Session
            </button>
          </div>
        </header>

        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">Shortcuts</div>
          <div className="shortcut-list">
            {SHORTCUTS.map((s) => (
              <button
                key={s.cmd}
                className="shortcut-btn"
                disabled={loading}
                onClick={() => sendMessage(s.cmd)}
                style={{
                  background: s.bg,
                  color: s.color,
                  borderColor: s.border,
                }}
              >
                <div className="shortcut-dot" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        </aside>

        {/* Chat */}
        <div className="chat">
          <div className="messages">
            {messages.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">📊</div>
                <div>
                  <div className="empty-title">Ready when you are.</div>
                  <div className="empty-sub">
                    Your trading context is loaded.
                    <br />
                    Open the desk to begin TD
                    {new Date().getDay() > 0 ? "" : " today"}.
                  </div>
                </div>
                <button
                  className="open-desk-btn"
                  onClick={() => sendMessage("Open the Desk")}
                >
                  Open the Desk
                </button>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div key={i} className={`msg-row ${msg.role}`}>
                  <div
                    className={`msg-av ${msg.role === "user" ? "user" : "desk"}`}
                  >
                    {msg.role === "user" ? "S" : "D"}
                  </div>
                  <div
                    className={`msg-bubble ${msg.role === "user" ? "user" : "desk"}`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="msg-row assistant">
                <div className="msg-av desk">D</div>
                <div className="typing">
                  <div className="tdot" />
                  <div className="tdot" />
                  <div className="tdot" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="input-area">
            <div className="input-row">
              <textarea
                ref={textareaRef}
                className="input-box"
                value={input}
                onChange={handleTextareaChange}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage(input);
                  }
                }}
                placeholder="Message the desk... (Enter to send, Shift+Enter for new line)"
                disabled={loading}
                rows={1}
              />
              <button
                className="send-btn"
                onClick={() => sendMessage(input)}
                disabled={loading || !input.trim()}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
