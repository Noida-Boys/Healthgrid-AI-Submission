"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Facility } from "@/lib/engine/types";
import type { TransferRecommendation } from "@/hooks/useRecommendations";

interface Props {
  facilities: Facility[];
  persistedRecs: TransferRecommendation[]; // realtime, from Firestore
  onSelect: (id: string) => void;
}

/** Transfer proposals for the worst critical facility, with one-click
    execution. Generation is triggered automatically once per district state. */
export default function Recommendations({ facilities, persistedRecs, onSelect }: Props) {
  const [localRecs, setLocalRecs] = useState<TransferRecommendation[]>([]);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generatedFor = useRef<string | null>(null);

  const worst = useMemo(
    () => facilities.filter((f) => f.status === "critical").sort((a, b) => a.healthScore - b.healthScore)[0] ?? null,
    [facilities],
  );

  useEffect(() => {
    if (!worst) return;
    // Pending recommendations already exist for this facility: don't burn
    // quota regenerating what the DHO hasn't acted on yet.
    if (persistedRecs.some((r) => r.toFacilityId === worst.id)) return;
    const key = `${worst.id}:${worst.lastUpdated}`;
    if (generatedFor.current === key) return;
    generatedFor.current = key;
    fetch("/api/ai/recommend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: worst.id }),
    })
      .then((r) => r.json())
      .then((res) => {
        if (!res.persisted) setLocalRecs(res.transfers ?? []);
        // Persisted ones arrive via the realtime hook; nothing to do here.
      })
      .catch(() => {});
  }, [worst, persistedRecs]);

  const recs = (persistedRecs.length > 0 ? persistedRecs : localRecs).filter((r) => !hidden.has(r.id));
  if (recs.length === 0) return null;

  const nameOf = (id: string) => facilities.find((f) => f.id === id)?.name ?? id;

  async function approve(rec: TransferRecommendation) {
    setBusy(rec.id);
    setError(null);
    const res = await fetch("/api/actions/approve-transfer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recommendationId: rec.id }),
    });
    setBusy(null);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Execution failed");
    }
    // On success the realtime listeners update everything; no local state needed.
  }

  return (
    <div className="rounded border border-line bg-surface-1 p-3">
      <div className="rail-label mb-2">Recommended actions</div>
      {error && <div className="text-critical text-xs mb-2">{error}</div>}
      <div className="space-y-2">
        {recs.map((rec) => (
          <div key={rec.id} className="rounded border border-line bg-surface-2 p-2.5">
            <div className="flex items-baseline gap-1.5 text-xs">
              <span className="num text-ink-1 font-medium">
                {rec.qty.toLocaleString("en-IN")} {rec.unit}
              </span>
              <span className="text-ink-1">{rec.medicineName}</span>
            </div>
            <div className="text-xs text-ink-2 mt-1">
              <button className="underline decoration-line hover:text-ink-1" onClick={() => onSelect(rec.fromFacilityId)}>
                {nameOf(rec.fromFacilityId)}
              </button>
              {" → "}
              <button className="underline decoration-line hover:text-ink-1" onClick={() => onSelect(rec.toFacilityId)}>
                {nameOf(rec.toFacilityId)}
              </button>
              <span className="num text-ink-3"> · {rec.distanceKm} km</span>
            </div>
            <p className="text-ink-3 text-xs mt-1.5 leading-relaxed">{rec.reasoning}</p>
            <p className="text-ink-2 text-xs mt-1 leading-relaxed">{rec.expectedImpact}</p>

            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1 rounded-full bg-surface-1">
                <div className="h-1 rounded-full bg-accent" style={{ width: `${Math.round(rec.confidence * 100)}%` }} />
              </div>
              <span className="num text-ink-3 text-xs">{Math.round(rec.confidence * 100)}%</span>
            </div>

            <div className="flex gap-2 mt-2.5">
              <button
                onClick={() => approve(rec)}
                disabled={busy === rec.id}
                className="px-2.5 py-1 rounded text-xs font-medium bg-accent/15 text-accent border border-accent/40 hover:bg-accent/25 disabled:opacity-50"
              >
                {busy === rec.id ? "Executing…" : "Approve transfer"}
              </button>
              <button
                onClick={() => setHidden(new Set([...hidden, rec.id]))}
                className="px-2.5 py-1 rounded text-xs text-ink-3 border border-line hover:text-ink-2"
              >
                Dismiss
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
