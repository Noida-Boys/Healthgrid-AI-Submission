"use client";

import { useEvents, type DistrictEvent } from "@/hooks/useEvents";

function describe(e: DistrictEvent): string {
  const p = e.payload as Record<string, string | number>;
  switch (e.type) {
    case "transfer_approved":
      return `Transfer executed: ${p.qty} ${p.unit} ${p.medicineName} · ${p.from} → ${p.to}`;
    case "voice_update":
      return `Voice update · ${p.summary ?? "inventory updated"}`;
    case "manual_update":
      return String(p.note ?? p.summary ?? "Field update recorded");
    case "status_change":
      return `Status change: ${p.name} is now ${p.status}`;
  }
}

function ago(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return new Date(ts).toLocaleDateString("en-IN");
}

export default function ActivityTicker() {
  const events = useEvents(8);
  if (events.length === 0) return null;

  return (
    <footer className="h-8 shrink-0 flex items-center gap-4 px-4 bg-surface-1 border-t border-line overflow-x-auto whitespace-nowrap">
      <span className="rail-label shrink-0">Activity</span>
      {events.map((e) => (
        <span key={e.id} className="text-xs text-ink-3 shrink-0">
          <span className="text-ink-2">{describe(e)}</span>
          <span className="num"> · {ago(e.timestamp)}</span>
        </span>
      ))}
    </footer>
  );
}
