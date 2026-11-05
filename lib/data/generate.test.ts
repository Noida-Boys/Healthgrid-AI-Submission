import { describe, expect, it } from "vitest";
import { daysToStockout } from "../engine/forecast";
import { generateDistrict } from "./generate";

describe("generateDistrict", () => {
  const { facilities, history } = generateDistrict("2026-07-04");
  const byId = Object.fromEntries(facilities.map((f) => [f.id, f]));

  it("produces the engineered status distribution: 2 critical, 3 at_risk, 10 healthy", () => {
    const counts = { healthy: 0, at_risk: 0, critical: 0 };
    for (const f of facilities) counts[f.status]++;
    expect(counts).toEqual({ healthy: 10, at_risk: 3, critical: 2 });
  });

  it("Seloo PHC is critical with paracetamol stock-out in 4-6 days", () => {
    const seloo = byId["seloo-phc"];
    expect(seloo.status).toBe("critical");
    const days = daysToStockout(seloo.inventory["paracetamol"], seloo.patients.trend7dPct);
    expect(days).toBeGreaterThanOrEqual(4);
    expect(days).toBeLessThanOrEqual(6);
  });

  it("Seloo PHC has the engineered patient surge (+30-38%)", () => {
    const t = byId["seloo-phc"].patients.trend7dPct;
    expect(t).toBeGreaterThanOrEqual(30);
    expect(t).toBeLessThanOrEqual(38);
  });

  it("Girad PHC is the second critical facility", () => {
    expect(byId["girad-phc"].status).toBe("critical");
  });

  it("generates 90 days of history per facility ending on the demo date", () => {
    for (const f of facilities) {
      expect(history[f.id]).toHaveLength(90);
      expect(history[f.id][89].date).toBe("2026-07-04");
    }
  });

  it("history stock levels end at current inventory levels", () => {
    const seloo = byId["seloo-phc"];
    const lastDay = history["seloo-phc"][89];
    expect(lastDay.stockLevels["paracetamol"]).toBe(seloo.inventory["paracetamol"].currentStock);
  });

  it("is deterministic across runs", () => {
    const again = generateDistrict("2026-07-04");
    expect(again.facilities.map((f) => f.healthScore)).toEqual(facilities.map((f) => f.healthScore));
  });

  it("healthy facilities have no essential medicine under 10 days of supply", () => {
    for (const f of facilities.filter((x) => x.status === "healthy")) {
      for (const item of Object.values(f.inventory).filter((i) => i.essential)) {
        expect(daysToStockout(item, f.patients.trend7dPct), `${f.id}/${item.medicineId}`).toBeGreaterThan(10);
      }
    }
  });
});
