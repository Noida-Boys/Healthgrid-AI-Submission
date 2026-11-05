"use client";

import { useEffect, useState } from "react";
import type { Facility } from "@/lib/engine/types";

export const HAS_FIREBASE = !!process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

export function useFacilities(): { facilities: Facility[]; loading: boolean } {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let unsub: (() => void) | undefined;
    let cancelled = false;

    (async () => {
      if (HAS_FIREBASE) {
        const { clientDb } = await import("@/lib/firebase/client");
        const { collection, onSnapshot, orderBy, query } = await import("firebase/firestore");
        if (cancelled) return;
        console.log("Firebase client project:", clientDb.app.options.projectId);
        
        console.log("Firebase config:", {
          projectId: clientDb.app.options.projectId,
          appId: clientDb.app.options.appId,
        });
        
        unsub = onSnapshot(
          query(collection(clientDb, "facilities")),
          (snap) => {
            console.log("Facilities snapshot size:", snap.size);
            setFacilities(snap.docs.map((d) => d.data() as Facility));
            setLoading(false);
          },
          (error) => {
            console.error("Facilities Firestore error:", error);
            setFacilities([]);
            setLoading(false);
          }
        );
      } else {
        // No credentials yet: serve the locally generated district so the UI
        // is fully buildable/verifiable. Swaps to live Firestore via env vars.
        const { generateDistrict } = await import("@/lib/data/generate");
        if (cancelled) return;
        const { facilities } = generateDistrict(new Date().toISOString().slice(0, 10));
        setFacilities([...facilities].sort((a, b) => a.name.localeCompare(b.name)));
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  return { facilities, loading };
}
