import { describe, expect, it } from "vitest";
import type { Facility, InventoryItem } from "./types";
import { burnRate, daysToStockout, facilityForecast } from "./forecast";

export function item(overrides: Partial<InventoryItem> = {}): InventoryItem {
  return {
    medicineId: "paracetamol",
    name: "Paracetamol 500mg",
    unit: "tabs",
    currentStock: 650,
    avgDaily7d: 10,
    avgDaily30d: 20,
    reorderLevel: 100,
    essential: true,
    ...overrides,
  };
}

describe("burnRate", () => {
  it("weights 7d avg at 70% and 30d avg at 30%", () => {
    expect(burnRate(item(), 0)).toBeCloseTo(13); // 0.7*10 + 0.3*20
  });

  it("does not amplify at trend <= 15%", () => {
    expect(burnRate(item(), 10)).toBeCloseTo(13);
    expect(burnRate(item(), 15)).toBeCloseTo(13);
  });

  it("amplifies by trend when |trend| > 15%", () => {
    expect(burnRate(item(), 34)).toBeCloseTo(13 * 1.34);
  });

  it("dampens on falling patient load and never goes negative", () => {
    expect(burnRate(item(), -20)).toBeCloseTo(13 * 0.8);
    expect(burnRate(item(), -200)).toBe(0);
  });
});

describe("daysToStockout", () => {
  it("divides stock by burn rate", () => {
    expect(daysToStockout(item({ currentStock: 65 }), 0)).toBeCloseTo(5);
  });

  it("returns Infinity when burn rate is zero", () => {
    expect(daysToStockout(item({ avgDaily7d: 0, avgDaily30d: 0 }), 0)).toBe(Infinity);
  });
});

describe("facilityForecast", () => {
  const facility = {
    patients: { todayCount: 100, avg7d: 95, trend7dPct: 0 },
    inventory: {
      ok: item({ medicineId: "ok", currentStock: 1300 }), // 100 days
      warn: item({ medicineId: "warn", currentStock: 65 }), // 5 days
      crit: item({ medicineId: "crit", currentStock: 26 }), // 2 days
    },
  } as unknown as Facility;

  it("classifies severity: <3 critical, <7 warning, else ok", () => {
    const byId = Object.fromEntries(facilityForecast(facility).map((f) => [f.medicineId, f]));
    expect(byId.crit.severity).toBe("critical");
    expect(byId.warn.severity).toBe("warning");
    expect(byId.ok.severity).toBe("ok");
  });

  it("sorts ascending by daysLeft", () => {
    const ids = facilityForecast(facility).map((f) => f.medicineId);
    expect(ids).toEqual(["crit", "warn", "ok"]);
  });
});
