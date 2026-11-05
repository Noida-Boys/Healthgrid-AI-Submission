"use client";

import { useMemo } from "react";
import type { Facility } from "@/lib/engine/types";
import { interventionQueue } from "@/lib/engine/intervention";
import type { TransferRecommendation } from "@/hooks/useRecommendations";
import type { IncidentScenario } from "@/lib/engine/types";

export default function DistrictInterventionQueue({
  facilities,
  recommendations,
  onSelect,
  scenario,
}: {
  facilities: Facility[];
  recommendations: TransferRecommendation[];
  onSelect: (id: string) => void;
  scenario?: IncidentScenario;
}) {
  const items = useMemo(() => interventionQueue(facilities, scenario).slice(0, 5), [facilities, scenario]);
  if (items.length === 0) return null;
  return (
    <div className="rounded border border-line bg-surface-1 p-3">
      <div className="flex items-end justify-between gap-2 mb-2">
        <div><div className="rail-label text-ink-2">District intervention queue</div><div className="text-[10px] text-ink-2 mt-0.5">Ranked by operational urgency</div></div>
        <span className="num rounded border border-line bg-surface-2 px-2 py-1 text-xs font-semibold text-ink-1">{items.length} flagged</span>
      </div>
      <div className="space-y-1.5">
        {items.map((item, index) => {
          const hasTransfer = recommendations.some((r) => r.toFacilityId === item.facilityId);
          const color = item.status === "Critical" ? "var(--status-critical)" : item.status === "At Risk" ? "var(--status-at-risk)" : "var(--ink-3)";
          return (
            <button key={item.facilityId} onClick={() => onSelect(item.facilityId)} className="w-full text-left rounded border border-line bg-surface-2 p-2 hover:border-ink-3 transition-colors">
              <div className="flex items-center gap-2">
                <span className="num text-ink-3 text-xs w-4">{index + 1}</span><span className="text-xs font-medium text-ink-1 flex-1 truncate">{item.facilityName}</span>
                <span className="text-[10px] font-medium" style={{ color }}>{item.status}</span><span className="num text-[10px] text-ink-3">Risk {item.riskScore}</span>
              </div>
              <div className="ml-6 mt-1 text-[11px] leading-snug text-ink-2">{item.primaryReason}</div>
              <div className="ml-6 mt-1 flex items-center justify-between gap-2 text-[10px]">
                <span className="text-accent">{hasTransfer ? "Review AI transfer recommendation" : item.recommendedAction}</span>
                <span className="text-ink-3 whitespace-nowrap">Tomorrow {item.demand.predictedTomorrow} · {item.demand.pressure}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
