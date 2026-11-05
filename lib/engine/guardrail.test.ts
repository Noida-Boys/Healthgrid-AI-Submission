import { describe, expect, it } from "vitest";
import { clampTransfer, haversineKm } from "./guardrail";
import { item } from "./forecast.test";

describe("haversineKm", () => {
  it("Wardha to Hinganghat is roughly 33 km", () => {
    const d = haversineKm({ lat: 20.7453, lng: 78.6022 }, { lat: 20.549, lng: 78.839 });
    expect(d).toBeGreaterThan(28);
    expect(d).toBeLessThan(38);
  });

  it("zero distance for the same point", () => {
    expect(haversineKm({ lat: 20.7, lng: 78.6 }, { lat: 20.7, lng: 78.6 })).toBe(0);
  });
});

describe("clampTransfer", () => {
  // burn rate 13/day => 14-day floor keeps 182 units.
  const source = item({ currentStock: 1000, avgDaily7d: 13, avgDaily30d: 13 });

  it("passes a reasonable quantity through unchanged", () => {
    expect(clampTransfer(300, source, 0)).toBe(300);
  });

  it("caps at 40% of source stock", () => {
    expect(clampTransfer(900, source, 0)).toBe(400);
  });

  it("never leaves the source under 14 days of supply", () => {
    const tight = item({ currentStock: 250, avgDaily7d: 13, avgDaily30d: 13 });
    // 40% cap = 100, but floor keeps 182 => only 68 givable.
    expect(clampTransfer(100, tight, 0)).toBe(68);
  });

  it("returns 0 when the source cannot give anything", () => {
    const poor = item({ currentStock: 150, avgDaily7d: 13, avgDaily30d: 13 });
    expect(clampTransfer(50, poor, 0)).toBe(0);
  });

  it("accounts for source patient-load trend in the floor", () => {
    // trend 34% amplifies burn to 17.42/day => floor 244; 40% cap = 400; givable = 1000-244 clamped by cap.
    expect(clampTransfer(500, source, 34)).toBe(400);
  });
});
