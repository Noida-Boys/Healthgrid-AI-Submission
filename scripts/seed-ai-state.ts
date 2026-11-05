/* Replays real Gemini outputs (captured from live runs on 2026-07-02) into
   Firestore so the UI shows full AI state while the free-tier daily quota is
   exhausted. The live pipeline regenerates all of this whenever quota exists.
   Run after seed: npx tsx --env-file=.env.local scripts/seed-ai-state.ts */
import { adminDb } from "../lib/firebase/admin-core";

const insights = {
  "seloo-phc": {
    rootCauses: [
      { factor: "Severe medicine stock-out risk", evidence: "The medicine score is 0, with ORS Sachets and Zinc Sulphate having only 2 and 2.5 days of stock remaining respectively." },
      { factor: "Complete bed saturation", evidence: "All 10 of the facility's 10 available beds are currently occupied, resulting in a beds score of 0." },
      { factor: "Doctor shortage during patient surge", evidence: "Only 1 of 2 sanctioned doctors is present with a 7-day attendance rate of 50%, while patient volume has surged by 35.8%." },
    ],
    narrative:
      "Seloo PHC is in a critical state with a health score of 25, driven by complete bed saturation (10 of 10 beds occupied) and severe medicine stock-out risk, with ORS Sachets running out in 2 days. This is compounded by a 50% doctor attendance rate during a 35.8% surge in patient volume.",
    narrativeHindi:
      "सेलू पीएचसी 25 के स्वास्थ्य स्कोर के साथ गंभीर स्थिति में है — सभी 10 बिस्तर भरे हैं और ओआरएस का स्टॉक केवल 2 दिनों का बचा है। मरीजों की संख्या में 35.8% की वृद्धि के बीच केवल 50% डॉक्टर उपस्थिति ने संकट और बढ़ा दिया है।",
  },
  "girad-phc": {
    rootCauses: [
      { factor: "Staffing collapse", evidence: "7-day doctor attendance is 45% against 2 sanctioned doctors, the lowest in the district." },
      { factor: "Antibiotic stock-outs", evidence: "Amoxicillin and Azithromycin both have roughly 2 days of stock remaining." },
      { factor: "Diagnostics down", evidence: "3 of 4 core tests (Blood Sugar, Malaria RDT, Urine Analysis) are unavailable." },
    ],
    narrative:
      "Girad PHC scores 32 (critical), significantly below the district median. The facility combines a staffing collapse (45% attendance), imminent antibiotic stock-outs (~2 days), full bed occupancy and 3 of 4 diagnostics down.",
    narrativeHindi:
      "गिरड पीएचसी 32 स्कोर के साथ गंभीर स्थिति में है — डॉक्टर उपस्थिति 45%, एंटीबायोटिक स्टॉक लगभग 2 दिन का, और 4 में से 3 जाँचें बंद हैं।",
  },
};

const recommendations = [
  {
    type: "transfer",
    medicineId: "ors",
    medicineName: "ORS Sachets",
    qty: 378,
    unit: "sachets",
    fromFacilityId: "wardha-chc",
    toFacilityId: "seloo-phc",
    distanceKm: 12,
    reasoning:
      "Wardha CHC is the nearest donor at 12 km with 652 givable units; transferring 378 addresses the critical 2-day stock-out at 18.9 units/day consumption.",
    expectedImpact: "Extends ORS cover from 2 to 22 days (~378 patients protected)",
    confidence: 0.95,
    status: "pending",
    createdAt: Date.now(),
  },
  {
    type: "transfer",
    medicineId: "zinc",
    medicineName: "Zinc Sulphate",
    qty: 252,
    unit: "tabs",
    fromFacilityId: "wardha-chc",
    toFacilityId: "seloo-phc",
    distanceKm: 12,
    reasoning:
      "Wardha CHC holds 339 givable units 12 km away; 252 units cover Seloo PHC's 12.6/day demand and avert the 2.5-day stock-out.",
    expectedImpact: "Extends Zinc Sulphate cover from 2.5 to 22.5 days",
    confidence: 0.95,
    status: "pending",
    createdAt: Date.now() - 60_000,
  },
];

(async () => {
  const db = adminDb();
  for (const [facilityId, ins] of Object.entries(insights)) {
    const f = await db.collection("facilities").doc(facilityId).get();
    await db.collection("insightsCache").doc(facilityId).set({ at: f.data()!.lastUpdated, insights: ins });
  }
  const pending = await db.collection("recommendations").where("status", "==", "pending").get();
  if (pending.empty) {
    for (const rec of recommendations) await db.collection("recommendations").add(rec);
  }
  console.log("AI state seeded: 2 insight sets, recommendations:", pending.empty ? recommendations.length : "kept existing");
})();
