"use client";
import React, { useRef, useState } from "react";
import { Message, modelLabel } from "../types";
import QuickActions from "./QuickActions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const SESSION_ID = "satya";

interface ChatPanelProps {
  messages: Message[];
  loading: boolean;
  onSend: (msg: string) => void;
  onOpenPalette: () => void;
  onChartStream: (file: File, context: string, setMessages: (fn: (prev: Message[]) => Message[]) => void) => void;
  setMessages: (fn: (prev: Message[]) => Message[]) => void;
  setLoading: (v: boolean) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  deskOpen?: boolean;
  onMorningBrief?: () => void;
  onOpenDesk?: () => void;
  firstName?: string;
  briefLoading?: boolean;
  canOpenDesk?: boolean;
  marketStatusLabel?: string;
}

function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 1280 / img.width);
      canvas.width  = img.width  * scale;
      canvas.height = img.height * scale;
      canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.85);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
};

// Converts long separator lines (─────, ━━━━━, -----) to visual dividers.
// Keeps all other content as-is with pre-wrap.
function renderDeskMessage(text: string): React.ReactNode {
  const SEP_RE = /^[─━═\-_=*~]{5,}$/;
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];
  let buf: string[] = [];

  const flush = (key: string) => {
    if (!buf.length) return;
    result.push(
      <span key={key} style={{ display: 'block', whiteSpace: 'pre-wrap' }}>
        {buf.join('\n')}
      </span>
    );
    buf = [];
  };

  lines.forEach((line, i) => {
    if (SEP_RE.test(line.trim())) {
      flush(`t${i}`);
      result.push(<div key={`s${i}`} className="msg-sep" />);
    } else {
      buf.push(line);
    }
  });
  flush('end');

  return <>{result}</>;
}

export default function ChatPanel({
  messages,
  loading,
  onSend,
  onOpenPalette,
  setMessages,
  setLoading,
  bottomRef,
  deskOpen = false,
  onMorningBrief,
  onOpenDesk,
  firstName = "Satya",
  briefLoading = false,
  canOpenDesk = true,
  marketStatusLabel = "Market Closed",
}: ChatPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef    = useRef<string>("");
  const [dragOver, setDragOver] = useState(false);
  const [chartContext, setChartContext] = useState<string>("TRADE IDEA");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  // We use an uncontrolled approach for the textarea to avoid prop-drilling input state
  // The textarea value is read directly on submit

  const handleSend = () => {
    const val = textareaRef.current?.value.trim() ?? "";
    if (!val || loading) return;
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "44px";
    }
    inputRef.current = "";
    onSend(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Open command palette on /
    if (e.key === "/" && (textareaRef.current?.value ?? "").length === 0) {
      e.preventDefault();
      onOpenPalette();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    inputRef.current = e.target.value;
    e.target.style.height = "44px";
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
  };

  function handleChartFiles(files: File[]) {
    if (!files.length || loading) return;
    setPendingFiles(files);
  }

  async function uploadPendingFiles() {
    if (!pendingFiles.length || loading) return;
    const files = pendingFiles;
    const context = chartContext;
    setPendingFiles([]);

    const label = files.length === 1
      ? `[Chart: ${files[0].name}]`
      : `[${files.length} Charts: ${files.map(f => f.name).join(", ")}]`;

    setMessages(prev => [...prev, { role: "user", content: `${label} ${context}` }]);
    setLoading(true);

    try {
      const form = new FormData();
      for (const file of files) {
        const compressed = await compressImage(file);
        form.append("files", compressed, file.name.replace(/\.[^.]+$/, ".jpg"));
      }
      form.append("context", context);
      form.append("session_id", SESSION_ID);

      const res = await fetch(`${API}/analyze-chart`, { method: "POST", body: form });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      setMessages(prev => [...prev, { role: "assistant", content: "", model: "claude-sonnet-4-6" }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value);
        setMessages(prev => [...prev.slice(0, -1), { role: "assistant", content: reply, model: "claude-sonnet-4-6" }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Chart analysis failed." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat" style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      {/* Messages */}
      <div className="messages" style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        {messages.length === 0 ? (
          <div style={{
            height: "100%", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: 20,
            padding: "0 24px",
          }}>
            <div style={{ textAlign: "center" as const }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🌅</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", marginBottom: 8 }}>
                {getGreeting()}, {firstName}.
              </div>
              <div style={{ fontSize: 13, color: "#94a3b8", maxWidth: 300, lineHeight: 1.6 }}>
                Start with a Morning Brief to understand today&apos;s bias,
                then open the desk when you&apos;re ready to trade.
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center" }}>
              <button
                onClick={onMorningBrief ?? (() => onSend("MORNING BRIEF"))}
                disabled={briefLoading || loading}
                style={{
                  padding: "12px 32px", borderRadius: 10,
                  background: "linear-gradient(135deg, #1d4ed8, #7e22ce)",
                  color: "white", border: "none",
                  cursor: (briefLoading || loading) ? "not-allowed" : "pointer",
                  fontSize: 14, fontWeight: 700,
                  boxShadow: "0 4px 20px rgba(29,78,216,0.25)",
                  opacity: (briefLoading || loading) ? 0.7 : 1,
                }}
              >
                {briefLoading ? "⏳ Preparing Brief..." : "🌅 Morning Brief"}
              </button>
              <button
                onClick={onOpenDesk ?? (() => onSend("Open the Desk"))}
                disabled={loading || !canOpenDesk}
                title={!canOpenDesk ? `Market is closed — ${marketStatusLabel}` : undefined}
                style={{
                  padding: "10px 24px", borderRadius: 10,
                  background: "transparent",
                  color: canOpenDesk ? "#4ade80" : "#64748b",
                  border: `1px solid ${canOpenDesk ? "rgba(74,222,128,0.35)" : "rgba(100,116,139,0.18)"}`,
                  cursor: (loading || !canOpenDesk) ? "not-allowed" : "pointer",
                  fontSize: 13, fontWeight: 600,
                  opacity: canOpenDesk ? 1 : 0.5,
                  transition: "all 0.2s",
                }}
              >
                {canOpenDesk ? "Open the Desk →" : `Desk locked — ${marketStatusLabel}`}
              </button>
              <div style={{ fontSize: 11, color: "#94a3b8" }}>or type a command below</div>
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`msg-row ${msg.role}`}>
              <div className={`msg-av ${msg.role === "user" ? "user" : "desk"}`}>
                {msg.role === "user" ? "S" : "D"}
              </div>
              <div style={{
                display: "flex",
                flexDirection: "column",
                ...(msg.role === "assistant"
                  ? { flex: 1, minWidth: 0 }
                  : { maxWidth: "calc(100% - 40px)" }),
              }}>
                <div className={`msg-bubble ${msg.role === "user" ? "user" : "desk"}`}>
                  {msg.role === "assistant"
                    ? renderDeskMessage(msg.content)
                    : msg.content}
                </div>
                {msg.role === "assistant" && modelLabel(msg.model) && (
                  <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "3px", fontFamily: "monospace", paddingLeft: "2px" }}>
                    {modelLabel(msg.model)}
                  </div>
                )}
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

      {/* Quick Actions */}
      <div style={{ flexShrink: 0 }}>
        <QuickActions onSend={onSend} loading={loading} onOpenPalette={onOpenPalette} deskOpen={deskOpen} canOpenDesk={canOpenDesk} briefLoading={briefLoading} />
      </div>

      {/* Input */}
      <div
        className="input-area"
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
          if (files.length) handleChartFiles(files);
        }}
        style={{ flexShrink: 0, outline: dragOver ? "2px dashed #3b82f6" : undefined }}
      >
        {pendingFiles.length > 0 && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderTop: "1px solid rgba(255,255,255,0.07)",
            background: "#0d1220", flexWrap: "wrap",
          }}>
            <span style={{ fontSize: 11, color: "#94a3b8", flexShrink: 0 }}>
              📊 {pendingFiles.length} chart{pendingFiles.length > 1 ? "s" : ""} — analyze as:
            </span>
            {["TRADE IDEA", "IN TRADE", "PREMARKET", "PTR-FAST"].map(ctx => (
              <button
                key={ctx}
                onClick={() => setChartContext(ctx)}
                style={{
                  padding: "3px 10px", borderRadius: 99, fontSize: 11,
                  fontWeight: 500, cursor: "pointer", border: "1px solid",
                  borderColor: chartContext === ctx ? "rgba(59,130,246,0.45)" : "rgba(255,255,255,0.1)",
                  background: chartContext === ctx ? "rgba(29,78,216,0.2)" : "rgba(255,255,255,0.04)",
                  color: chartContext === ctx ? "#93c5fd" : "#94a3b8",
                }}
              >
                {ctx}
              </button>
            ))}
            <button
              onClick={() => uploadPendingFiles()}
              style={{
                marginLeft: "auto", padding: "4px 14px", borderRadius: 99,
                fontSize: 11, fontWeight: 600, cursor: "pointer",
                background: "#1d4ed8", color: "white", border: "none",
              }}
            >
              Analyze →
            </button>
            <button
              onClick={() => setPendingFiles([])}
              style={{
                padding: "4px 10px", borderRadius: 99, fontSize: 11,
                cursor: "pointer", background: "transparent",
                color: "#94a3b8", border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              Cancel
            </button>
          </div>
        )}
        <div className="input-row">
          <label htmlFor="chart-upload" className="chart-btn" title="Upload chart for analysis">
            📊
            <input
              id="chart-upload"
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) handleChartFiles(files);
                e.target.value = "";
              }}
            />
          </label>
          <textarea
            ref={textareaRef}
            className="input-box"
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Message the desk... or press / for commands"
            disabled={loading}
            rows={1}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData?.items ?? []);
              const imageFiles = items
                .filter(item => item.type.startsWith("image/"))
                .map(item => item.getAsFile())
                .filter((f): f is File => f !== null);
              if (imageFiles.length > 0) {
                e.preventDefault();
                handleChartFiles(imageFiles);
              }
            }}
          />
          <button
            className="send-btn"
            onClick={handleSend}
            disabled={loading}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
