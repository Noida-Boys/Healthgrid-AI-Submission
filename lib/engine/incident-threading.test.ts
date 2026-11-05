import { describe, expect, it } from "vitest";
import { demandForecast } from "./demand";
import { burnRate, daysToStockout, facilityForecast } from "./forecast";
import { INCIDENTS } from "./incident";
import { interventionQueue } from "./intervention";
import { computeRisk } from "./risk";
import { generateDistrict } from "../data/generate";
import { item } from "./forecast.test";

const { facilities } = generateDistrict("2026-07-07");
const seloo = facilities.find((f) => f.id === "seloo-phc")!;
const healthy = facilities.find((f) => f.id === "wardha-chc")!;

describe("scenario threading — normal is the identity", () => {
  it("burnRate and daysToStockout: undefined, 'normal' and legacy call agree exactly", () => {
    const it1 = item({ medicineId: "ors", currentStock: 400, avgDaily7d: 8, avgDaily30d: 8 });
    expect(burnRate(it1, 12)).toBe(burnRate(it1, 12, "normal"));
    expect(burnRate(it1, 12)).toBe(burnRate(it1, 12, undefined));
    expect(daysToStockout(it1, 12)).toBe(daysToStockout(it1, 12, "normal"));
  });

  it("facilityForecast: 'normal' output deep-equals the legacy output for every facility", () => {
    for (const f of facilities) {
      expect(facilityForecast(f, "normal")).toEqual(facilityForecast(f));
    }
  });

  it("demandForecast: 'normal' output deep-equals the legacy output for every facility", () => {
    for (const f of facilities) {
      expect(demandForecast(f, "normal")).toEqual(demandForecast(f));
    }
  });

  it("computeRisk: 'normal' output deep-equals the legacy output for every facility", () => {
    for (const f of facilities) {
      expect(computeRisk(f, "normal")).toEqual(computeRisk(f));
    }
  });

  it("interventionQueue: 'normal' output deep-equals the legacy output", () => {
    expect(interventionQueue(facilities, "normal")).toEqual(interventionQueue(facilities));
  });
});

describe("scenario threading — multipliers apply", () => {
  it("flood alert shortens an ORS stock-out timeline by exactly the ORS multiplier", () => {
    const ors = item({ medicineId: "ors", currentStock: 360, avgDaily7d: 8, avgDaily30d: 8 });
    const base = daysToStockout(ors, 0);
    const flooded = daysToStockout(ors, 0, "flood_alert");
    expect(flooded).toBeCloseTo(base / INCIDENTS.flood_alert.medicine.ors, 6);
  });

  it("scenarios leave unlisted medicines untouched", () => {
    const metformin = item({ medicineId: "metformin", currentStock: 500, avgDaily7d: 10, avgDaily30d: 10 });
    expect(daysToStockout(metformin, 0, "flood_alert")).toBe(daysToStockout(metformin, 0));
  });

  it("flood alert raises predicted footfall by roughly the footfall multiplier", () => {
    const base = demandForecast(healthy);
    const flooded = demandForecast(healthy, "flood_alert");
    const ratio = flooded.predictedTomorrow / base.predictedTomorrow;
    expect(ratio).toBeGreaterThan(1.3);
    expect(ratio).toBeLessThan(1.4);
  });

  it("an active scenario is named in the demand reasons", () => {
    const flooded = demandForecast(seloo, "flood_alert");
    expect(flooded.reasons.some((r) => r.includes("Flood Alert"))).toBe(true);
    expect(demandForecast(seloo).reasons.some((r) => r.includes("Flood Alert"))).toBe(false);
  });

  it("demand pressure can only escalate under stress, never relax", () => {
    const order = ["low", "moderate", "high", "critical"];
    for (const f of facilities) {
      const base = demandForecast(f);
      const flooded = demandForecast(f, "flood_alert");
      expect(order.indexOf(flooded.pressure)).toBeGreaterThanOrEqual(order.indexOf(base.pressure));
    }
  });
});

describe("scenario threading — risk and intervention queue", () => {
  it("stress hits weak facilities harder than strong ones, preserving differentiation", () => {
    const weakDrop = computeRisk(seloo).total - computeRisk(seloo, "flood_alert").total;
    const strongDrop = computeRisk(healthy).total - computeRisk(healthy, "flood_alert").total;
    expect(weakDrop).toBeGreaterThanOrEqual(strongDrop);
    // Strong facilities barely move: 30+ days of cover divided by <2 stays >7.
    expect(strongDrop).toBeLessThanOrEqual(5);
    // The gap between weak and strong never collapses.
    expect(computeRisk(healthy, "flood_alert").total).toBeGreaterThan(computeRisk(seloo, "flood_alert").total + 20);
  });

  it("urgency is monotone: nobody becomes LESS urgent under a scenario", () => {
    const base = new Map(interventionQueue(facilities).map((i) => [i.facilityId, i.urgency]));
    for (const item of interventionQueue(facilities, "flood_alert")) {
      const before = base.get(item.facilityId);
      if (before !== undefined) expect(item.urgency).toBeGreaterThanOrEqual(before);
    }
  });

  it("queue items name the scenario in their reason under stress", () => {
    const flooded = interventionQueue(facilities, "flood_alert");
    expect(flooded.length).toBeGreaterThan(0);
    for (const item of flooded) {
      expect(item.primaryReason).toContain("Flood Alert");
    }
    for (const item of interventionQueue(facilities)) {
      expect(item.primaryReason).not.toContain("Flood Alert");
    }
  });

  it("scenario codepaths never call a write path (lens only)", async () => {
    // The incident modules must not import firebase or any route/action code.
    const src = await import("fs").then((fs) => fs.readFileSync("lib/engine/incident.ts", "utf8"));
    expect(src).not.toMatch(/firebase|firestore|fetch\(|adminDb/i);
  });
});
