import { describe, expect, it } from "vitest";
import type { Facility } from "./types";
import { computeRisk, statusFor } from "./risk";
import { item } from "./forecast.test";

function baseFacility(overrides: Partial<Facility> = {}): Facility {
  return {
    id: "test-phc",
    name: "Test PHC",
    type: "PHC",
    lat: 20.7,
    lng: 78.6,
    block: "Test",
    staff: { doctorsSanctioned: 2, doctorsPresentToday: 2, attendanceRate7d: 0.95 },
    beds: { total: 10, occupied: 6 },
    patients: { todayCount: 80, avg7d: 78, trend7dPct: 2 },
    tests: { hemoglobin: true, bloodSugar: true, malaria: true, urine: true },
    inventory: {
      paracetamol: item({ medicineId: "paracetamol", currentStock: 650, avgDaily7d: 13, avgDaily30d: 13 }), // 50 days
      ors: item({ medicineId: "ors", name: "ORS", currentStock: 400, avgDaily7d: 8, avgDaily30d: 8 }), // 50 days
    },
    healthScore: 0,
    status: "healthy",
    lastUpdated: 0,
    lastUpdateSource: "seed",
    ...overrides,
  };
}

describe("computeRisk", () => {
  it("scores a well-run facility healthy with total >= 90", () => {
    const r = computeRisk(baseFacility());
    expect(r.total).toBeGreaterThanOrEqual(90);
    expect(r.status).toBe("healthy");
  });

  it("respects component maxima", () => {
    const r = computeRisk(baseFacility());
    expect(r.medicine).toBeLessThanOrEqual(40);
    expect(r.staffing).toBeLessThanOrEqual(25);
    expect(r.beds).toBeLessThanOrEqual(15);
    expect(r.surge).toBeLessThanOrEqual(10);
    expect(r.tests).toBeLessThanOrEqual(10);
    expect(r.total).toBe(r.medicine + r.staffing + r.beds + r.surge + r.tests);
  });

  it("scores a collapsing facility critical", () => {
    const f = baseFacility({
      staff: { doctorsSanctioned: 2, doctorsPresentToday: 1, attendanceRate7d: 0.5 },
      beds: { total: 10, occupied: 10 },
      patients: { todayCount: 120, avg7d: 90, trend7dPct: 34 },
      tests: { hemoglobin: true, bloodSugar: false, malaria: false, urine: false },
      inventory: {
        paracetamol: item({ medicineId: "paracetamol", currentStock: 26, avgDaily7d: 13, avgDaily30d: 13 }), // 2d
        ors: item({ medicineId: "ors", currentStock: 16, avgDaily7d: 8, avgDaily30d: 8 }), // 2d
      },
    });
    expect(computeRisk(f).status).toBe("critical");
  });

  it("squeezed on meds, staffing, beds and tests lands in at_risk", () => {
    const f = baseFacility({
      inventory: {
        paracetamol: item({ medicineId: "paracetamol", currentStock: 65, avgDaily7d: 13, avgDaily30d: 13 }), // 5d -> warning
        ors: item({ medicineId: "ors", currentStock: 400, avgDaily7d: 8, avgDaily30d: 8 }),
      },
      staff: { doctorsSanctioned: 2, doctorsPresentToday: 1, attendanceRate7d: 0.7 },
      beds: { total: 10, occupied: 8 },
      tests: { hemoglobin: true, bloodSugar: false, malaria: true, urine: true },
    });
    const r = computeRisk(f);
    expect(r.status).toBe("at_risk");
  });

  it("maps boundary totals: 80 healthy, 60 at_risk, 59 critical", () => {
    expect(statusFor(80)).toBe("healthy");
    expect(statusFor(79)).toBe("at_risk");
    expect(statusFor(60)).toBe("at_risk");
    expect(statusFor(59)).toBe("critical");
  });

  it("ignores non-essential medicines in the medicine component", () => {
    const f = baseFacility({
      inventory: {
        paracetamol: item({ medicineId: "paracetamol", currentStock: 650, avgDaily7d: 13, avgDaily30d: 13 }),
        cetirizine: item({ medicineId: "cetirizine", essential: false, currentStock: 0, avgDaily7d: 5, avgDaily30d: 5 }),
      },
    });
    expect(computeRisk(f).medicine).toBe(40);
  });
});
