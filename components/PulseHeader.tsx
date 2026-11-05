"use client";

import Link from "next/link";
import type { Facility } from "@/lib/engine/types";

interface Props {
  facilities: Facility[];
  pendingRecommendations: number;
  onOpenCopilot: () => void;
}

export default function PulseHeader({ facilities, pendingRecommendations, onOpenCopilot }: Props) {
  const counts = { healthy: 0, at_risk: 0, critical: 0 };
  let patientsToday = 0;
  for (const f of facilities) {
    counts[f.status]++;
    patientsToday += f.patients.todayCount;
  }

  return (
    <header className="h-14 shrink-0 flex items-center gap-6 px-4 bg-surface-1 border-b border-line">
      <div className="flex items-center gap-3">
        <div className="flex items-baseline gap-1">
          <span className="wordmark text-[16px] font-semibold text-ink-1">HealthGrid</span>
          <span className="wordmark text-[16px] font-semibold text-accent">AI</span>
        </div>
        <span className="w-px h-5 bg-line" />
        <div className="flex flex-col leading-tight">
          <span className="text-ink-2 text-xs">Wardha District · Maharashtra</span>
          <span className="flex items-center gap-1.5 text-[10px] text-ink-3">
            <span className="live-dot inline-block w-1.5 h-1.5 rounded-full bg-[var(--status-healthy)]" />
            LIVE · district command center
          </span>
        </div>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <Stat dotVar="var(--status-healthy)" label="Healthy" value={counts.healthy} />
        <Stat dotVar="var(--status-at-risk)" label="At risk" value={counts.at_risk} />
        <Stat dotVar="var(--status-critical)" label="Critical" value={counts.critical} />
        <Divider />
        <div className="flex items-baseline gap-1.5">
          <span className="num text-ink-1 text-sm">{patientsToday.toLocaleString("en-IN")}</span>
          <span className="text-ink-2 text-xs font-medium">patients today</span>
        </div>
        <Divider />
        <div className="flex items-baseline gap-1.5">
          <span className="num text-ink-1 text-sm">{pendingRecommendations}</span>
          <span className="text-ink-2 text-xs font-medium">pending actions</span>
        </div>
        <Divider />
        <button
          onClick={onOpenCopilot}
          className="px-2.5 py-1.5 rounded text-xs font-medium bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25"
        >
          Copilot
        </button>
        <a
          href="/api/report/district"
          download
          title="Download the full district situation report (PDF)"
          className="rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-ink-3 hover:bg-surface-2 hover:text-ink-1"
        >
          District report ↓
        </a>
        <Link href="/field" className="rounded border border-line px-2.5 py-1.5 text-xs font-medium text-ink-2 hover:border-ink-3 hover:bg-surface-2 hover:text-ink-1">
          Field view →
        </Link>
      </div>
    </header>
  );
}

function Stat({ dotVar, label, value }: { dotVar: string; label: string; value: number }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: dotVar }} />
      <span className="num text-ink-1 text-sm">{value}</span>
      <span className="text-ink-2 text-xs font-medium">{label}</span>
    </div>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-line" />;
}
