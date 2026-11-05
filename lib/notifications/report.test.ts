import { describe, expect, it } from "vitest";
import type { Facility } from "@/lib/engine/types";
import { generateOperationalReport } from "./report";

const facility: Facility = {
  id: "seloo-phc",
  name: "Seloo PHC",
  type: "PHC",
  lat: 20.8,
  lng: 78.7,
  block: "Seloo",
  staff: { doctorsSanctioned: 3, doctorsPresentToday: 2, attendanceRate7d: 0.8 },
  beds: { total: 10, occupied: 8 },
  patients: { todayCount: 100, avg7d: 90, trend7dPct: 20 },
  tests: { malaria: true },
  inventory: {
    ors: {
      medicineId: "ors",
      name: "ORS Sachets",
      unit: "units",
      currentStock: 50,
      avgDaily7d: 19,
      avgDaily30d: 17,
      reorderLevel: 200,
      essential: true,
    },
  },
  healthScore: 42,
  status: "critical",
  lastUpdated: 1,
  lastUpdateSource: "seed",
};

describe("generateOperationalReport", () => {
  it("uses shortage and redistribution data in a deterministic report", () => {
    const input = {
      facility,
      recommendations: [
        {
          medicineId: "ors",
          medicineName: "ORS Sachets",
          qty: 378,
          unit: "units",
          fromFacilityId: "wardha-chc",
          fromFacilityName: "Wardha CHC",
          toFacilityId: facility.id,
          distanceKm: 18,
          status: "pending" as const,
        },
      ],
    };
    const report = generateOperationalReport(input);
    expect(report).toContain("Facility: Seloo PHC");
    expect(report).toContain("Operational Risk: CRITICAL");
    expect(report).toContain("Current Stock: 50 units");
    expect(report).toContain("Predicted Stock-Out:");
    expect(report).toContain("Receive 378 units of ORS Sachets from Wardha CHC.");
    expect(generateOperationalReport(input)).toBe(report);
  });

  it("handles missing optional recommendation data without invalid output", () => {
    const report = generateOperationalReport({ facility, recommendations: [] });
    expect(report).not.toMatch(/undefined|NaN/);
    expect(report).toContain("Review and replenish ORS Sachets stock immediately.");
  });
});
