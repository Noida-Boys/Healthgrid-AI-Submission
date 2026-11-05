// Server-side data access. Firebase Admin resolves either the optional local
// service-account override or Application Default Credentials.

import type { Facility, HistoryDay } from "../engine/types";

export async function getFacility(id: string): Promise<Facility | null> {
  const { adminDb } = await import("../firebase/admin");
  const snap = await adminDb().collection("facilities").doc(id).get();
  return snap.exists ? (snap.data() as Facility) : null;
}

export async function getAllFacilities(): Promise<Facility[]> {
  const { adminDb } = await import("../firebase/admin");
  const snap = await adminDb().collection("facilities").get();
  return snap.docs.map((d) => d.data() as Facility);
}

export async function getHistoryDays(facilityId: string, days: number): Promise<HistoryDay[]> {
  const { adminDb } = await import("../firebase/admin");
  const snap = await adminDb()
    .collection("history")
    .doc(facilityId)
    .collection("days")
    .orderBy("date", "desc")
    .limit(days)
    .get();
  return snap.docs.map((d) => d.data() as HistoryDay).reverse();
}
