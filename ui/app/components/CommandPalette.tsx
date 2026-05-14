"use client";
import { useState, useEffect, useRef } from "react";
import { PALETTE_COMMANDS } from "../types";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (cmd: string) => void;
  loading: boolean;
}

export default function CommandPalette({ open, onClose, onSelect, loading }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const q = query.trim().toLowerCase();
  const filtered = PALETTE_COMMANDS.filter(
    (c) => !q || c.cmd.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q)
  );
  const quick = filtered.filter((c) => c.group === "quick");
  const deep  = filtered.filter((c) => c.group === "deep");

  const handleSelect = (cmd: string) => {
    if (loading) return;
    onClose();
    onSelect(cmd);
  };

  return (
    <div className="cmd-overlay" onClick={onClose}>
      <div className="cmd-panel" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="cmd-search"
          placeholder="Search commands..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && filtered.length === 1) handleSelect(filtered[0].cmd);
          }}
        />
        <div className="cmd-list">
          {quick.length > 0 && (
            <>
              <div className="cmd-group-label">
                Quick
                <span className="cmd-badge haiku">haiku</span>
              </div>
              {quick.map((c) => (
                <div key={c.cmd} className="cmd-item" onClick={() => handleSelect(c.cmd)}>
                  <span className="cmd-name">{c.cmd}</span>
                  <span className="cmd-desc">{c.desc}</span>
                </div>
              ))}
            </>
          )}
          {deep.length > 0 && (
            <>
              <div className="cmd-group-label" style={{ marginTop: quick.length ? "4px" : 0 }}>
                Deep
                <span className="cmd-badge sonnet">sonnet</span>
              </div>
              {deep.map((c) => (
                <div key={c.cmd} className="cmd-item" onClick={() => handleSelect(c.cmd)}>
                  <span className="cmd-name">{c.cmd}</span>
                  <span className="cmd-desc">{c.desc}</span>
                </div>
              ))}
            </>
          )}
          {filtered.length === 0 && (
            <div style={{ padding: "20px", textAlign: "center", fontSize: "13px", color: "#94a3b8" }}>
              No commands match &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
