// Weather / disaster stress scenarios: deterministic multipliers applied as a
// lens over the demand and stock-out engines. Presets only — a real signal
// source (IMD weather feed, district disaster cell) could later provide the
// same IncidentEffects shape, but no adapter exists yet by design.

import type { IncidentScenario } from "./types";

export interface IncidentEffects {
  scenario: IncidentScenario;
  label: string;
  /** One-line banner explanation shown when the scenario is active. */
  description: string;
  /** Patient footfall multiplier (1 = unchanged). */
  footfall: number;
  /** Per-medicine consumption multipliers; medicines not listed are 1. */
  medicine: Record<string, number>;
  /** Judge-facing justifications for the numbers above. */
  reasons: string[];
}

export const INCIDENTS: Record<IncidentScenario, IncidentEffects> = {
  normal: {
    scenario: "normal",
    label: "Normal",
    description: "No stress scenario active.",
    footfall: 1,
    medicine: {},
    reasons: [],
  },

  heavy_rain: {
    scenario: "heavy_rain",
    label: "Heavy Rain",
    description: "Simulating sustained heavy rainfall: waterborne illness and fever cases rise.",
    footfall: 1.15,
    medicine: {
      ors: 1.4,
      zinc: 1.35,
      paracetamol: 1.25,
      azithromycin: 1.2,
      amoxicillin: 1.15,
    },
    reasons: [
      "Heavy rain contaminates drinking water: diarrhoeal cases drive ORS (+40%) and paediatric zinc (+35%) demand.",
      "Monsoon fevers and respiratory infection raise paracetamol (+25%) and antibiotic (+15–20%) consumption.",
      "OPD footfall rises ~15% as waterborne and vector illness presents.",
    ],
  },

  flood_alert: {
    scenario: "flood_alert",
    label: "Flood Alert",
    description: "Simulating district flood alert: displacement, contaminated water, outbreak-level diarrhoeal load.",
    footfall: 1.35,
    medicine: {
      ors: 1.8,
      zinc: 1.7,
      paracetamol: 1.4,
      azithromycin: 1.5,
      amoxicillin: 1.3,
      "iv-ns": 1.5,
    },
    reasons: [
      "Flooding produces outbreak-level acute diarrhoea: ORS (+80%) and zinc (+70%) are the WHO first-line response.",
      "Displaced populations crowd facilities: footfall +35%, dysentery antibiotics (azithromycin +50%) follow.",
      "Severe dehydration cases need IV fluids (+50%); fevers push paracetamol +40%.",
    ],
  },

  heatwave: {
    scenario: "heatwave",
    label: "Heatwave",
    description: "Simulating severe heatwave: dehydration, heat stroke and cardiovascular stress.",
    footfall: 1.25,
    medicine: {
      ors: 1.9,
      "iv-ns": 1.6,
      paracetamol: 1.15,
      amlodipine: 1.1,
    },
    reasons: [
      "Heat illness is treated with aggressive rehydration: ORS (+90%) and IV fluids (+60%) lead consumption.",
      "Heat stress decompensates cardiovascular patients: antihypertensive (amlodipine) demand +10%.",
      "OPD footfall rises ~25% with heat exhaustion and pyrexia (paracetamol +15%).",
    ],
  },
};

/** Effects for a scenario; undefined and "normal" both resolve to the
    identity effects so existing call sites stay byte-for-byte unchanged. */
export function incidentEffects(scenario?: IncidentScenario): IncidentEffects {
  return INCIDENTS[scenario ?? "normal"];
}

/** Consumption multiplier for one medicine under a scenario (1 when normal). */
export function medicineMultiplier(medicineId: string, scenario?: IncidentScenario): number {
  return incidentEffects(scenario).medicine[medicineId] ?? 1;
}
