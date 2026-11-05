import { Type } from "@google/genai";
import { facilityForecast } from "@/lib/engine/forecast";
import { computeRisk } from "@/lib/engine/risk";
import { GeminiUnavailable, generateStructured } from "@/lib/gemini";
import { getAllFacilities, getFacility, getHistoryDays } from "@/lib/server/data";

export interface Insights {
  rootCauses: { factor: string; evidence: string }[];
  narrative: string;
  narrativeHindi: string;
}

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    rootCauses: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          factor: { type: Type.STRING, description: "Short factor name, e.g. 'Patient surge'" },
          evidence: { type: Type.STRING, description: "One sentence citing exact numbers from the data" },
        },
        required: ["factor", "evidence"],
      },
    },
    narrative: { type: Type.STRING, description: "2-3 sentence plain-English situation summary for the DHO" },
    narrativeHindi: { type: Type.STRING, description: "The same summary in Hindi (Devanagari)" },
  },
  required: ["rootCauses", "narrative", "narrativeHindi"],
};

const SYSTEM = `You are the analysis engine of HealthGrid AI, a district health command center used by a District Health Officer in Maharashtra, India.
Explain WHY a facility is in its current state, grounded ONLY in the data provided. Every claim must cite a number that appears in the data. Never invent numbers. Be terse and factual; no pleasantries.`;

// Two-level cache keyed by the facility's lastUpdated stamp: module memory,
// then Firestore (survives restarts/instances — reloads cost zero quota).
const cache = new Map<string, { at: number; insights: Insights }>();

async function readPersistedCache(facilityId: string, at: number): Promise<Insights | null> {
  const { adminDb } = await import("@/lib/firebase/admin");
  const snap = await adminDb().collection("insightsCache").doc(facilityId).get();
  const data = snap.data();
  return data && data.at === at ? (data.insights as Insights) : null;
}

async function persistCache(facilityId: string, at: number, insights: Insights) {
  const { adminDb } = await import("@/lib/firebase/admin");
  await adminDb().collection("insightsCache").doc(facilityId).set({ at, insights });
}

export async function POST(req: Request) {
  const { facilityId } = await req.json();
  if (typeof facilityId !== "string") return Response.json({ error: "facilityId required" }, { status: 400 });

  const facility = await getFacility(facilityId);
  if (!facility) return Response.json({ error: "facility not found" }, { status: 404 });

  const hit = cache.get(facilityId);
  if (hit && hit.at === facility.lastUpdated) {
    return Response.json({ ...hit.insights, cached: true });
  }
  const persisted = await readPersistedCache(facilityId, facility.lastUpdated);
  if (persisted) {
    cache.set(facilityId, { at: facility.lastUpdated, insights: persisted });
    return Response.json({ ...persisted, cached: true });
  }

  const [history, all] = await Promise.all([getHistoryDays(facilityId, 14), getAllFacilities()]);
  const breakdown = computeRisk(facility);
  const forecasts = facilityForecast(facility).filter((f) => f.severity !== "ok");
  const districtMedianScore = median(all.map((f) => f.healthScore));

  const prompt = JSON.stringify({
    facility: {
      name: facility.name,
      type: facility.type,
      status: facility.status,
      healthScore: facility.healthScore,
      scoreBreakdown: breakdown,
      patients: facility.patients,
      staff: facility.staff,
      beds: facility.beds,
      testsUnavailable: Object.entries(facility.tests).filter(([, v]) => !v).map(([k]) => k),
    },
    medicineRisks: forecasts.map((f) => ({ medicine: f.name, daysToStockout: Math.round(f.daysLeft * 10) / 10 })),
    last14Days: history.map((d) => ({ date: d.date, patients: d.patientCount, doctors: d.doctorsPresent })),
    districtContext: { facilities: all.length, medianHealthScore: districtMedianScore },
  });

  try {
    const insights = await generateStructured<Insights>({ prompt, schema: SCHEMA, system: SYSTEM });
    cache.set(facilityId, { at: facility.lastUpdated, insights });
    await persistCache(facilityId, facility.lastUpdated, insights);
    return Response.json({ ...insights, cached: false });
  } catch (e) {
    if (e instanceof GeminiUnavailable) {
      // Deterministic fallback: the demo never blocks on an API hiccup.
      const fallback: Insights = {
        rootCauses: forecasts.slice(0, 3).map((f) => ({
          factor: `${f.name} supply`,
          evidence: `${f.name}: ${Math.floor(f.daysLeft)} days of stock remaining at current consumption.`,
        })),
        narrative: `${facility.name} scores ${facility.healthScore}/100. Medicines ${breakdown.medicine}/40, staffing ${breakdown.staffing}/25, beds ${breakdown.beds}/15.`,
        narrativeHindi: "",
      };
      return Response.json({ ...fallback, cached: false, degraded: true });
    }
    throw e;
  }
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
}
