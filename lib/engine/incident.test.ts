import { describe, expect, it } from "vitest";
import { INCIDENTS, incidentEffects, medicineMultiplier } from "./incident";
import type { IncidentScenario } from "./types";

const SCENARIOS: IncidentScenario[] = ["normal", "heavy_rain", "flood_alert", "heatwave"];

describe("incident engine", () => {
  it("defines all four scenarios with labels, descriptions and reasons", () => {
    for (const s of SCENARIOS) {
      const fx = INCIDENTS[s];
      expect(fx.scenario).toBe(s);
      expect(fx.label.length).toBeGreaterThan(0);
      expect(fx.description.length).toBeGreaterThan(0);
      if (s !== "normal") expect(fx.reasons.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("normal is the identity: footfall 1, no medicine multipliers", () => {
    expect(INCIDENTS.normal.footfall).toBe(1);
    expect(Object.keys(INCIDENTS.normal.medicine)).toHaveLength(0);
    expect(medicineMultiplier("ors", "normal")).toBe(1);
    expect(medicineMultiplier("paracetamol")).toBe(1); // undefined scenario
  });

  it("undefined scenario resolves to the same object as normal", () => {
    expect(incidentEffects(undefined)).toBe(INCIDENTS.normal);
    expect(incidentEffects("normal")).toBe(INCIDENTS.normal);
  });

  it("non-normal scenarios only ever increase demand (multipliers >= 1)", () => {
    for (const s of SCENARIOS.filter((x) => x !== "normal")) {
      const fx = INCIDENTS[s];
      expect(fx.footfall).toBeGreaterThan(1);
      for (const [, mult] of Object.entries(fx.medicine)) {
        expect(mult).toBeGreaterThanOrEqual(1);
      }
    }
  });

  it("scenario signatures match the epidemiology they claim", () => {
    // Rain/flood are diarrhoeal events: ORS+zinc lead. Heatwave is dehydration: ORS+IV lead.
    expect(INCIDENTS.flood_alert.medicine.ors).toBeGreaterThan(INCIDENTS.heavy_rain.medicine.ors);
    expect(INCIDENTS.heavy_rain.medicine.zinc).toBeGreaterThan(1.2);
    expect(INCIDENTS.heatwave.medicine.ors).toBeGreaterThanOrEqual(1.8);
    expect(INCIDENTS.heatwave.medicine["iv-ns"]).toBeGreaterThan(1.5);
    // Chronic-disease meds are untouched by rain and flood.
    expect(INCIDENTS.heavy_rain.medicine.metformin).toBeUndefined();
    expect(INCIDENTS.flood_alert.medicine.metformin).toBeUndefined();
  });

  it("is deterministic: repeated lookups return identical values", () => {
    expect(medicineMultiplier("ors", "flood_alert")).toBe(medicineMultiplier("ors", "flood_alert"));
    expect(incidentEffects("heatwave")).toEqual(incidentEffects("heatwave"));
  });
});
