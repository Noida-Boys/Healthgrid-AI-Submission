"use client";

import { useEffect, useState } from "react";
import type { HistoryDay } from "@/lib/engine/types";
import { HAS_FIREBASE } from "./useFacilities";

/** Last `days` days of history for one facility, oldest first. */
export function useHistory(facilityId: string | null, days = 30): HistoryDay[] {
  const [history, setHistory] = useState<HistoryDay[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!facilityId) {
        setHistory([]);
        return;
      }
      if (HAS_FIREBASE) {
        const { clientDb } = await import("@/lib/firebase/client");
        const { collection, getDocs, limitToLast, orderBy, query } = await import("firebase/firestore");
        const snap = await getDocs(
          query(collection(clientDb, "history", facilityId, "days"), orderBy("date"), limitToLast(days)),
        );
        if (!cancelled) setHistory(snap.docs.map((d) => d.data() as HistoryDay));
      } else {
        const { generateDistrict } = await import("@/lib/data/generate");
        if (!cancelled) {
          const all = generateDistrict(new Date().toISOString().slice(0, 10)).history[facilityId] ?? [];
          setHistory(all.slice(-days));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [facilityId, days]);

  return history;
}
