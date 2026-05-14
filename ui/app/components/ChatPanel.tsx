"use client";
import { useRef } from "react";
import { Message, modelLabel } from "../types";
import QuickActions from "./QuickActions";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ChatPanelProps {
  messages: Message[];
  loading: boolean;
  onSend: (msg: string) => void;
  onOpenPalette: () => void;
  onChartStream: (file: File, context: string, setMessages: (fn: (prev: Message[]) => Message[]) => void) => void;
  setMessages: (fn: (prev: Message[]) => Message[]) => void;
  setLoading: (v: boolean) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
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

export default function ChatPanel({
  messages,
  loading,
  onSend,
  onOpenPalette,
  setMessages,
  setLoading,
  bottomRef,
}: ChatPanelProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef    = useRef<string>("");
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

  const handleChartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || loading) return;
    e.target.value = "";
    const context = textareaRef.current?.value.trim() || "PTR-FAST";
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "44px";
    }

    const { routeModel } = await import("../types");
    const chartModel = routeModel(context);

    setMessages((prev) => [...prev, { role: "user", content: `[Chart: ${file.name}] ${context}` }]);
    setLoading(true);
    try {
      const form = new FormData();
      const compressed = await compressImage(file);
      form.append("file", compressed, "chart.jpg");
      form.append("context", context);
      form.append("session_id", "satya");
      const res = await fetch(`${API}/analyze-chart`, { method: "POST", body: form });
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let reply = "";
      setMessages((prev) => [...prev, { role: "assistant", content: "", model: chartModel }]);
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        reply += decoder.decode(value);
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: reply, model: chartModel },
        ]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Chart analysis failed." }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat">
      {/* Messages */}
      <div className="messages">
        {messages.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📊</div>
            <div>
              <div className="empty-title">Ready when you are.</div>
              <div className="empty-sub">
                Your trading context is loaded.
                <br />
                Open the desk to begin the session.
              </div>
            </div>
            <button className="open-desk-btn" onClick={() => onSend("Open the Desk")}>
              Open the Desk
            </button>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className={`msg-row ${msg.role}`}>
              <div className={`msg-av ${msg.role === "user" ? "user" : "desk"}`}>
                {msg.role === "user" ? "S" : "D"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", maxWidth: "calc(100% - 40px)" }}>
                <div className={`msg-bubble ${msg.role === "user" ? "user" : "desk"}`} style={{ maxWidth: "100%" }}>
                  {msg.content}
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
      <QuickActions onSend={onSend} loading={loading} onOpenPalette={onOpenPalette} />

      {/* Input */}
      <div className="input-area">
        <div className="input-row">
          <label htmlFor="chart-upload" className="chart-btn" title="Upload chart for analysis">
            📊
            <input
              id="chart-upload"
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleChartUpload}
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
