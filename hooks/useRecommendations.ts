"use client";

import { useEffect, useState } from "react";
import { HAS_FIREBASE } from "./useFacilities";

export interface TransferRecommendation {
  id: string;
  type: "transfer";
  medicineId: string;
  medicineName: string;
  qty: number;
  unit: string;
  fromFacilityId: string;
  toFacilityId: string;
  distanceKm: number;
  reasoning: string;
  expectedImpact: string;
  confidence: number; // 0..1
  status: "pending" | "approved" | "dismissed";
  createdAt: number;
}

export function useRecommendations(): TransferRecommendation[] {
  const [recs, setRecs] = useState<TransferRecommendation[]>([]);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      if (!HAS_FIREBASE) return;
      const { clientDb } = await import("@/lib/firebase/client");
      const { collection, onSnapshot, query, where } = await import("firebase/firestore");
      if (cancelled) return;
      // No orderBy: where+orderBy needs a composite index; sorting a handful
      // of pending recommendations client-side avoids that dependency.
      unsub = onSnapshot(query(collection(clientDb, "recommendations"), where("status", "==", "pending")), (snap) =>
        setRecs(
          snap.docs
            .map((d) => ({ ...(d.data() as Omit<TransferRecommendation, "id">), id: d.id }))
            .sort((a, b) => b.createdAt - a.createdAt),
        ),
      );
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return recs;
}
