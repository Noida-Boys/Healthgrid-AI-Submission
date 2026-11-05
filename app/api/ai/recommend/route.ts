import { Type } from "@google/genai";
import { daysToStockout, facilityForecast } from "@/lib/engine/forecast";
import { clampTransfer, haversineKm } from "@/lib/engine/guardrail";
import type { Facility } from "@/lib/engine/types";
import { GeminiUnavailable, generateStructured } from "@/lib/gemini";
import { getAllFacilities, getFacility } from "@/lib/server/data";

interface ProposedTransfer {
  medicineId: string;
  qty: number;
  fromId: string;
  reasoning: string;
  expectedImpact: string;
  confidence: number;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    transfers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          medicineId: { type: Type.STRING },
          qty: { type: Type.NUMBER, description: "Units to transfer" },
          fromId: { type: Type.STRING, description: "Donor facility id — must be one of the listed donors" },
          reasoning: { type: Type.STRING, description: "One sentence citing the numbers that justify this" },
          expectedImpact: {
            type: Type.STRING,
            description: "Concrete expected outcome, e.g. 'Extends ORS cover from 2 to 14 days (~180 patients)'",
          },
          confidence: { type: Type.NUMBER, description: "0 to 1" },
        },
        required: ["medicineId", "qty", "fromId", "reasoning", "expectedImpact", "confidence"],
      },
    },
  },
  required: ["transfers"],
};

const SYSTEM = `You are the resource-optimization engine of HealthGrid AI for a district health administration in Maharashtra, India.
Propose stock transfers from donor facilities to the facility in crisis. Use ONLY the donors listed; never exceed a donor's maxGivable. Prefer nearby donors. One transfer per shortage medicine, most urgent first. Cite numbers from the data in reasoning.`;

// One generation per facility state; regenerating on every click costs quota.
const cache = new Map<string, { at: number; response: unknown }>();

export async function POST(req: Request) {
  const { facilityId } = await req.json();
  if (typeof facilityId !== "string") return Response.json({ error: "facilityId required" }, { status: 400 });

  const target = await getFacility(facilityId);
  if (!target) return Response.json({ error: "facility not found" }, { status: 404 });

  const hit = cache.get(facilityId);
  if (hit && hit.at === target.lastUpdated) return Response.json(hit.response);

  const all = await getAllFacilities();
  const shortages = facilityForecast(target).filter((f) => f.severity !== "ok" && target.inventory[f.medicineId].essential);
  if (shortages.length === 0) return Response.json({ transfers: [], persisted: false });

  // Deterministic pre-filter: only genuinely surplus donors reach the model.
  const donorsByMed = shortages.slice(0, 4).map((s) => {
    const donors = all
      .filter((f) => f.id !== target.id && daysToStockout(f.inventory[s.medicineId], f.patients.trend7dPct) > 21)
      .map((f) => ({
        facility: f,
        distanceKm: Math.round(haversineKm(target, f)),
        stock: f.inventory[s.medicineId].currentStock,
        maxGivable: clampTransfer(Number.MAX_SAFE_INTEGER, f.inventory[s.medicineId], f.patients.trend7dPct),
      }))
      .filter((d) => d.maxGivable > 0)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, 3);
    return { shortage: s, donors };
  });

  const prompt = JSON.stringify({
    facilityInCrisis: {
      id: target.id,
      name: target.name,
      healthScore: target.healthScore,
      patientTrend7dPct: target.patients.trend7dPct,
      avg7dPatients: target.patients.avg7d,
    },
    shortages: donorsByMed.map(({ shortage, donors }) => ({
      medicineId: shortage.medicineId,
      medicine: shortage.name,
      daysToStockout: Math.round(shortage.daysLeft * 10) / 10,
      dailyConsumption: Math.round(shortage.burnRate * 10) / 10,
      donors: donors.map((d) => ({
        id: d.facility.id,
        name: d.facility.name,
        distanceKm: d.distanceKm,
        currentStock: d.stock,
        maxGivable: d.maxGivable,
      })),
    })),
  });

  try {
    const out = await generateStructured<{ transfers: ProposedTransfer[] }>({ prompt, schema: SCHEMA, system: SYSTEM });

    // Server-side validation: donor must be in the pre-filtered list, qty re-clamped.
    const validated = out.transfers.flatMap((t) => {
      const med = donorsByMed.find((m) => m.shortage.medicineId === t.medicineId);
      const donor = med?.donors.find((d) => d.facility.id === t.fromId);
      if (!med || !donor) return [];
      const qty = clampTransfer(Math.round(t.qty), donor.facility.inventory[t.medicineId], donor.facility.patients.trend7dPct);
      if (qty === 0) return [];
      return [
        {
          type: "transfer" as const,
          medicineId: t.medicineId,
          medicineName: med.shortage.name,
          qty,
          unit: target.inventory[t.medicineId].unit,
          fromFacilityId: t.fromId,
          toFacilityId: target.id,
          distanceKm: donor.distanceKm,
          reasoning: t.reasoning,
          expectedImpact: t.expectedImpact,
          confidence: Math.min(1, Math.max(0, t.confidence)),
          status: "pending" as const,
          createdAt: Date.now(),
        },
      ];
    });

    let persisted = false;
    const withIds = [];
    const { adminDb } = await import("@/lib/firebase/admin");
    const db = adminDb();
    for (const rec of validated) {
      const ref = await db.collection("recommendations").add(rec);
      withIds.push({ ...rec, id: ref.id });
    }
    persisted = true;

    const response = { transfers: withIds, persisted };
    cache.set(facilityId, { at: target.lastUpdated, response });
    return Response.json(response);
  } catch (e) {
    if (e instanceof GeminiUnavailable) return Response.json({ transfers: [], persisted: false, degraded: true });
    throw e;
  }
}

export type { Facility };
