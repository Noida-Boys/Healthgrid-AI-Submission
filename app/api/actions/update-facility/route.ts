import { computeRisk } from "@/lib/engine/risk";
import type { Facility } from "@/lib/engine/types";

export interface FieldUpdate {
  field: "stock" | "beds" | "doctors" | "test";
  medicineId?: string;
  testName?: string;
  value: number | boolean;
}

const CONFLICT_ERRORS = new Set(["facility not found", "no valid updates"]);

/** Shared write path for manual buttons AND confirmed voice updates:
    apply → recompute risk → log event. Realtime listeners do the rest. */
export async function POST(req: Request) {
  const { facilityId, updates, source } = (await req.json()) as {
    facilityId: string;
    updates: FieldUpdate[];
    source: "manual" | "voice";
  };
  if (typeof facilityId !== "string" || !Array.isArray(updates) || updates.length === 0) {
    return Response.json({ error: "facilityId and updates required" }, { status: 400 });
  }

  try {
    const { adminDb } = await import("@/lib/firebase/admin");
    const db = adminDb();
    const result = await db.runTransaction(async (tx) => {
      const ref = db.collection("facilities").doc(facilityId);
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("facility not found");
      const f = snap.data() as Facility;

      const applied: string[] = [];
      for (const u of updates) {
        if (u.field === "stock" && u.medicineId && f.inventory[u.medicineId]) {
          f.inventory[u.medicineId].currentStock = Math.max(0, Math.round(Number(u.value)));
          applied.push(`${f.inventory[u.medicineId].name} → ${u.value}`);
        } else if (u.field === "beds") {
          f.beds.occupied = Math.min(f.beds.total, Math.max(0, Math.round(Number(u.value))));
          applied.push(`Beds occupied → ${f.beds.occupied}`);
        } else if (u.field === "doctors") {
          f.staff.doctorsPresentToday = Math.min(f.staff.doctorsSanctioned, Math.max(0, Math.round(Number(u.value))));
          applied.push(`Doctors present → ${f.staff.doctorsPresentToday}`);
        } else if (u.field === "test" && u.testName && u.testName in f.tests) {
          f.tests[u.testName] = Boolean(u.value);
          applied.push(`${u.testName} → ${u.value ? "available" : "down"}`);
        }
      }
      if (applied.length === 0) throw new Error("no valid updates");

      const prevStatus = f.status;
      const b = computeRisk(f);
      f.healthScore = b.total;
      f.status = b.status;
      f.lastUpdated = Date.now();
      f.lastUpdateSource = source;

      tx.set(ref, f);
      tx.create(db.collection("events").doc(), {
        type: source === "voice" ? "voice_update" : "manual_update",
        facilityId,
        payload: { summary: `${f.name}: ${applied.join(", ")}` },
        timestamp: Date.now(),
      });
      if (prevStatus !== f.status) {
        tx.create(db.collection("events").doc(), {
          type: "status_change",
          facilityId,
          payload: { name: f.name, status: f.status },
          timestamp: Date.now(),
        });
      }
      return { healthScore: f.healthScore, status: f.status, applied };
    });

    return Response.json({ ok: true, ...result });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (CONFLICT_ERRORS.has(message)) {
      return Response.json({ error: message }, { status: 409 });
    }
    console.error("Facility update failed", { message });
    return Response.json({ error: "Facility update failed" }, { status: 500 });
  }
}
