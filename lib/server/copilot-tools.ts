// Tool surface for the Health Copilot. Executors reuse the same engines and
// data access as the UI, so the copilot can never disagree with the screen.

import { Type, type FunctionDeclaration } from "@google/genai";
import { daysToStockout, facilityForecast } from "../engine/forecast";
import { computeRisk } from "../engine/risk";
import { demandForecast } from "../engine/demand";
import { getAllFacilities, getFacility } from "./data";

export const declarations: FunctionDeclaration[] = [
  {
    name: "getDistrictSummary",
    description:
      "Current district-wide situation: facility counts by status, worst facilities, imminent medicine stock-outs.",
  },
  {
    name: "getFacility",
    description: "Full operational snapshot of one facility: score breakdown, inventory forecasts, staffing, beds.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        facilityId: { type: Type.STRING, description: "Facility id, e.g. 'seloo-phc'. Use listFacilities first if unsure." },
      },
      required: ["facilityId"],
    },
  },
  {
    name: "getForecasts",
    description: "All medicines district-wide that will stock out within N days.",
    parameters: {
      type: Type.OBJECT,
      properties: { daysThreshold: { type: Type.NUMBER, description: "e.g. 7" } },
      required: ["daysThreshold"],
    },
  },
  {
    name: "getPatientDemandForecast",
    description: "Grounded patient demand forecasts. With facilityId returns one facility; without it ranks all facilities by tomorrow's load and demand pressure. Use for demand, OPD, patient load, staffing or capacity questions.",
    parameters: {
      type: Type.OBJECT,
      properties: { facilityId: { type: Type.STRING, description: "Optional facility id. Omit for district-wide ranking." } },
    },
  },
  {
    name: "listFacilities",
    description: "All facility ids, names, statuses and health scores.",
  },
];

type Executor = (args: Record<string, unknown>) => Promise<unknown>;

export const executors: Record<string, Executor> = {
  async getPatientDemandForecast(args) {
    const facilityId = typeof args.facilityId === "string" ? args.facilityId : "";
    const all = facilityId ? [await getFacility(facilityId)].filter((f) => f !== null) : await getAllFacilities();
    if (all.length === 0) return { error: `No facility with id '${facilityId}'. Call listFacilities for valid ids.` };
    return all.map((f) => ({ facilityName: f.name, ...demandForecast(f) })).sort((a, b) => b.predictedTomorrow - a.predictedTomorrow);
  },

  async listFacilities() {
    const all = await getAllFacilities();
    return all
      .map((f) => ({ id: f.id, name: f.name, type: f.type, status: f.status, healthScore: f.healthScore }))
      .sort((a, b) => a.healthScore - b.healthScore);
  },

  async getDistrictSummary() {
    const all = await getAllFacilities();
    const counts = { healthy: 0, at_risk: 0, critical: 0 };
    let patients = 0;
    for (const f of all) {
      counts[f.status]++;
      patients += f.patients.todayCount;
    }
    const stockOuts = all
      .flatMap((f) =>
        facilityForecast(f)
          .filter((x) => x.severity !== "ok" && f.inventory[x.medicineId].essential)
          .map((x) => ({ facility: f.name, medicine: x.name, daysLeft: Math.round(x.daysLeft * 10) / 10 })),
      )
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 10);
    return {
      facilities: all.length,
      counts,
      patientsToday: patients,
      worstFacilities: all
        .sort((a, b) => a.healthScore - b.healthScore)
        .slice(0, 5)
        .map((f) => ({ id: f.id, name: f.name, healthScore: f.healthScore, status: f.status })),
      imminentStockOuts: stockOuts,
    };
  },

  async getFacility(args) {
    const f = await getFacility(String(args.facilityId));
    if (!f) return { error: `No facility with id '${args.facilityId}'. Call listFacilities for valid ids.` };
    return {
      id: f.id,
      name: f.name,
      type: f.type,
      block: f.block,
      status: f.status,
      healthScore: f.healthScore,
      scoreBreakdown: computeRisk(f),
      patients: f.patients,
      patientDemandForecast: demandForecast(f),
      staff: f.staff,
      beds: f.beds,
      testsUnavailable: Object.entries(f.tests).filter(([, v]) => !v).map(([k]) => k),
      medicineForecasts: facilityForecast(f).map((x) => ({
        medicine: x.name,
        daysLeft: isFinite(x.daysLeft) ? Math.round(x.daysLeft * 10) / 10 : "ample",
        severity: x.severity,
      })),
    };
  },

  async getForecasts(args) {
    const threshold = Number(args.daysThreshold ?? 7);
    const all = await getAllFacilities();
    return all
      .flatMap((f) =>
        Object.values(f.inventory)
          .map((item) => ({ item, days: daysToStockout(item, f.patients.trend7dPct) }))
          .filter(({ days }) => days < threshold)
          .map(({ item, days }) => ({
            facility: f.name,
            facilityId: f.id,
            medicine: item.name,
            daysLeft: Math.round(days * 10) / 10,
            currentStock: item.currentStock,
            unit: item.unit,
          })),
      )
      .sort((a, b) => a.daysLeft - b.daysLeft);
  },
};
