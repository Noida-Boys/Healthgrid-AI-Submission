"use client";

import { useEffect, useRef, useState } from "react";
import type { Facility } from "@/lib/engine/types";

interface Insights {
  rootCauses: { factor: string; evidence: string }[];
  narrative: string;
  narrativeHindi: string;
  degraded?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  at_risk: "var(--status-at-risk)",
  critical: "var(--status-critical)",
};

/** AI root-cause cards for every non-healthy facility, worst first. */
export default function InsightsRail({
  facilities,
  onSelect,
}: {
  facilities: Facility[];
  onSelect: (id: string) => void;
}) {
  const flagged = facilities
    .filter((f) => f.status !== "healthy")
    .sort((a, b) => a.healthScore - b.healthScore);

  if (flagged.length === 0) return null;

  return (
    <div className="rounded border border-line bg-surface-1 p-3">
      <div className="rail-label mb-2">AI situation analysis</div>
      <div className="space-y-2">
        {flagged.map((f) => (
          <InsightCard key={f.id} facility={f} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ facility, onSelect }: { facility: Facility; onSelect: (id: string) => void }) {
  const [insights, setInsights] = useState<Insights | null>(null);
  const [failed, setFailed] = useState(false);
  const fetchedFor = useRef<number | null>(null);

  useEffect(() => {
    if (fetchedFor.current === facility.lastUpdated) return;
    fetchedFor.current = facility.lastUpdated;
    setInsights(null);
    setFailed(false);
    fetch("/api/ai/insights", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: facility.id }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then(setInsights)
      .catch(() => setFailed(true));
  }, [facility.id, facility.lastUpdated]);

  const color = STATUS_COLOR[facility.status] ?? "var(--ink-3)";

  return (
    <button
      onClick={() => onSelect(facility.id)}
      className="w-full text-left rounded border border-line bg-surface-2 p-2.5 hover:border-ink-3 transition-colors"
    >
      <div className="flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
        <span className="text-ink-1 text-xs font-medium">{facility.name}</span>
        <span className="num text-xs ml-auto" style={{ color }}>
          {facility.healthScore}
        </span>
      </div>

      {insights ? (
        <div className="mt-1.5 space-y-1.5">
          <p className="text-ink-2 text-xs leading-relaxed">{insights.narrative}</p>
          {insights.rootCauses.slice(0, 3).map((rc) => (
            <div key={rc.factor} className="flex gap-1.5 text-xs">
              <span className="text-ink-3 shrink-0">·</span>
              <span>
                <span className="text-ink-1">{rc.factor}:</span> <span className="text-ink-3">{rc.evidence}</span>
              </span>
            </div>
          ))}
        </div>
      ) : failed ? (
        <p className="mt-1.5 text-ink-3 text-xs">Analysis unavailable — see facility panel for raw indicators.</p>
      ) : (
        <div className="mt-2 space-y-1.5" aria-label="Loading analysis">
          <div className="h-2 rounded bg-surface-1 w-11/12" />
          <div className="h-2 rounded bg-surface-1 w-4/5" />
          <div className="h-2 rounded bg-surface-1 w-3/5" />
        </div>
      )}
    </button>
  );
}
