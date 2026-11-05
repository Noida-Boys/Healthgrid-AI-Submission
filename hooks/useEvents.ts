"use client";

import { useEffect, useState } from "react";
import { HAS_FIREBASE } from "./useFacilities";

export interface DistrictEvent {
  id: string;
  type: "voice_update" | "manual_update" | "transfer_approved" | "status_change";
  facilityId: string | null;
  payload: Record<string, unknown>;
  timestamp: number;
}

export function useEvents(max = 20): DistrictEvent[] {
  const [events, setEvents] = useState<DistrictEvent[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      if (!HAS_FIREBASE) {
        setEvents([
          {
            id: "local",
            type: "manual_update",
            facilityId: null,
            payload: { note: "Local demo data (no Firebase credentials)" },
            timestamp: Date.now(),
          },
        ]);
        return;
      }
      const { clientDb } = await import("@/lib/firebase/client");
      const { collection, limit, onSnapshot, orderBy, query } = await import("firebase/firestore");
      if (cancelled) return;
      unsub = onSnapshot(query(collection(clientDb, "events"), orderBy("timestamp", "desc"), limit(max)), (snap) => {
        setEvents(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as DistrictEvent));
      });
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, [max]);

  return events;
}
