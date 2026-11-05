import { describe, expect, it } from "vitest";
import { demandForecast } from "./demand";
import type { Facility } from "./types";

const facility: Facility = {
  id: "test-phc", name: "Test PHC", type: "PHC", lat: 0, lng: 0, block: "Test",
  staff: { doctorsSanctioned: 4, doctorsPresentToday: 2, attendanceRate7d: 0.7 },
  beds: { total: 20, occupied: 18 }, patients: { todayCount: 130, avg7d: 100, trend7dPct: 20 },
  tests: { Malaria: false }, inventory: {}, healthScore: 55, status: "at_risk",
  lastUpdated: 0, lastUpdateSource: "seed",
};

describe("demandForecast", () => {
  it("is deterministic and explains rising capacity pressure", () => {
    const first = demandForecast(facility);
    expect(demandForecast(facility)).toEqual(first);
    expect(first.predictedTomorrow).toBeGreaterThan(100);
    expect(first.predicted7DayTotal).toBeGreaterThan(first.predictedTomorrow * 6);
    expect(first.trend).toBe("rising");
    expect(["high", "critical"]).toContain(first.pressure);
    expect(first.reasons.length).toBeGreaterThan(1);
  });
});
