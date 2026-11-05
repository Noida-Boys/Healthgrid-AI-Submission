"use client";

import { useEffect, useRef, useState } from "react";

interface Msg {
  role: "user" | "model";
  text: string;
}

const SUGGESTIONS = ["Why is Seloo critical?", "District summary", "कौन सी दवाइयाँ खत्म होने वाली हैं?"];

export default function CopilotDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const next: Msg[] = [...messages, { role: "user", text: trimmed }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const { text: reply } = await res.json();
      // The drawer renders plain text; strip any markdown emphasis that slips through.
      setMessages((m) => [...m, { role: "model", text: String(reply).replace(/\*\*?/g, "") }]);
    } catch {
      setMessages((m) => [...m, { role: "model", text: "Connection lost — please try again." }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`fixed inset-y-0 right-0 z-40 w-[400px] max-w-full flex flex-col bg-surface-1 border-l border-line transition-transform duration-200 ease-out ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
      aria-hidden={!open}
    >
      <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-line">
        <div>
          <div className="text-ink-1 text-sm font-semibold">Health Copilot</div>
          <div className="text-ink-3 text-xs">Grounded in live district data</div>
        </div>
        <button onClick={onClose} className="text-ink-3 hover:text-ink-1 text-lg leading-none px-2" aria-label="Close copilot">
          ×
        </button>
      </div>

      <div ref={scroller} className="flex-1 min-h-0 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <div className="space-y-1.5 pt-2">
            <div className="rail-label mb-2">Ask about the district</div>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full text-left text-xs text-ink-2 rounded border border-line bg-surface-2 px-2.5 py-2 hover:border-ink-3"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[85%] rounded px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
              m.role === "user" ? "ml-auto bg-accent/15 text-ink-1 border border-accent/30" : "bg-surface-2 text-ink-2 border border-line"
            }`}
          >
            {m.text}
          </div>
        ))}
        {busy && (
          <div className="max-w-[85%] rounded px-2.5 py-2 bg-surface-2 border border-line space-y-1.5">
            <div className="h-2 rounded bg-surface-1 w-4/5" />
            <div className="h-2 rounded bg-surface-1 w-3/5" />
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="shrink-0 flex gap-2 p-3 border-t border-line"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="English या हिंदी में पूछें…"
          className="flex-1 rounded border border-line bg-surface-2 px-2.5 py-2 text-xs text-ink-1 placeholder:text-ink-3 focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="px-3 py-2 rounded text-xs font-medium bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
