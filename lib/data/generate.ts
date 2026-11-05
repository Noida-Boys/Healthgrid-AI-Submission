// Deterministic synthetic-history generator for the demo district.
// Generic simulation first, then per-facility engineered overrides so the
// district lands in the exact demo state the spec requires.

import type { Facility, HistoryDay, InventoryItem } from "../engine/types";
import { burnRate } from "../engine/forecast";
import { computeRisk } from "../engine/risk";
import { CORE_TESTS, MEDICINES, WARDHA_FACILITIES, profileFor } from "./district";

export interface DistrictData {
  facilities: Facility[];
  history: Record<string, HistoryDay[]>; // 90 days, oldest first
}

/** mulberry32 seeded PRNG — reproducible seeds across runs. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAYS = 90;
const FULL_STOCK_DAYS = 45;

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function generateDistrict(demoDateIso: string): DistrictData {
  const demoDate = new Date(demoDateIso + "T00:00:00Z");
  const facilities: Facility[] = [];
  const history: Record<string, HistoryDay[]> = {};

  WARDHA_FACILITIES.forEach((seed, fi) => {
    const rnd = mulberry32(1000 + fi * 97);
    const profile = profileFor(seed.id);
    const phase = rnd() * Math.PI * 2;

    // -- Daily patient counts (seasonality + noise + engineered final-week trend) --
    const patientCounts: number[] = [];
    for (let d = 0; d < DAYS; d++) {
      const dayOfYear = (demoDate.getTime() / 86400000 - (DAYS - 1 - d)) % 365;
      const seasonal = 1 + 0.15 * Math.sin((2 * Math.PI * dayOfYear) / 365 + phase);
      patientCounts.push(seed.basePatients * seasonal * (0.9 + rnd() * 0.2));
    }
    // Force last-7 vs previous-7 average ratio to the profile's trend target.
    const prev7 = mean(patientCounts.slice(DAYS - 14, DAYS - 7));
    const targetLast7 = prev7 * (1 + profile.trendPct / 100);
    for (let d = DAYS - 7; d < DAYS; d++) {
      patientCounts[d] = targetLast7 * (0.95 + rnd() * 0.1);
    }

    // -- Consumption + stock simulation per medicine --
    const consumptionByMed: Record<string, number[]> = {};
    const stockByMed: Record<string, number[]> = {};
    for (const med of MEDICINES) {
      const daily = patientCounts.map((p) => p * med.perPatientFactor * (0.85 + rnd() * 0.3));
      consumptionByMed[med.id] = daily.map((x) => Math.round(x));
      const avgDaily = mean(daily);
      const full = Math.round(avgDaily * FULL_STOCK_DAYS);
      let stock = full * (0.6 + rnd() * 0.4);
      const restockEvery = 28 + Math.floor(rnd() * 8);
      const restockOffset = Math.floor(rnd() * restockEvery);
      const levels: number[] = [];
      for (let d = 0; d < DAYS; d++) {
        if ((d + restockOffset) % restockEvery === 0) stock = full;
        stock = Math.max(0, stock - daily[d]);
        levels.push(Math.round(stock));
      }
      stockByMed[med.id] = levels;
    }

    // -- Staffing & beds --
    const attendanceBase = profile.attendance;
    const doctorsPresent: number[] = [];
    for (let d = 0; d < DAYS; d++) {
      // History drifts toward the target rate over the last 2 weeks.
      const w = Math.min(1, (d - (DAYS - 14)) / 14);
      const rate = d < DAYS - 14 ? 0.9 : 0.9 * (1 - w) + attendanceBase * w;
      doctorsPresent.push(Math.min(seed.doctorsSanctioned, Math.round(seed.doctorsSanctioned * rate + rnd() * 0.4)));
    }
    const bedsOccupied = patientCounts.map((p, d) => {
      const w = d < DAYS - 14 ? 0.62 : profile.occupancy;
      return Math.min(seed.beds, Math.round(seed.beds * w * (0.92 + rnd() * 0.16)));
    });

    // -- Assemble current facility state from the simulated tail --
    const trend7dPct =
      (mean(patientCounts.slice(DAYS - 7)) / mean(patientCounts.slice(DAYS - 14, DAYS - 7)) - 1) * 100;

    const inventory: Record<string, InventoryItem> = {};
    for (const med of MEDICINES) {
      const cons = consumptionByMed[med.id];
      const item: InventoryItem = {
        medicineId: med.id,
        name: med.name,
        unit: med.unit,
        currentStock: stockByMed[med.id][DAYS - 1],
        avgDaily7d: Math.round(mean(cons.slice(DAYS - 7)) * 10) / 10,
        avgDaily30d: Math.round(mean(cons.slice(DAYS - 30)) * 10) / 10,
        reorderLevel: Math.round(mean(cons.slice(DAYS - 30)) * 14),
        essential: med.essential,
      };
      // Engineered stock-out targets: pin currentStock to target days supply,
      // then rewrite the last 21 days of history to descend linearly to it.
      const targetDays = profile.medDaysLeft[med.id];
      if (targetDays !== undefined) {
        item.currentStock = Math.max(1, Math.round(targetDays * burnRate(item, trend7dPct)));
      } else if (item.currentStock < burnRate(item, trend7dPct) * 12) {
        // Non-engineered meds must stay comfortably stocked on every facility.
        item.currentStock = Math.round(burnRate(item, trend7dPct) * (20 + rnd() * 25));
      }
      const start = stockByMed[med.id][DAYS - 22] ?? item.currentStock * 2;
      const from = Math.max(start, item.currentStock);
      for (let d = DAYS - 21; d < DAYS; d++) {
        const w = (d - (DAYS - 21)) / 20;
        stockByMed[med.id][d] = Math.round(from * (1 - w) + item.currentStock * w);
      }
      inventory[med.id] = item;
    }

    const tests: Record<string, boolean> = {};
    CORE_TESTS.forEach((t, i) => {
      tests[t] = i >= profile.testsDown;
    });

    const facility: Facility = {
      id: seed.id,
      name: seed.name,
      type: seed.type,
      lat: seed.lat,
      lng: seed.lng,
      block: seed.block,
      staff: {
        doctorsSanctioned: seed.doctorsSanctioned,
        doctorsPresentToday: Math.min(seed.doctorsSanctioned, Math.round(seed.doctorsSanctioned * profile.attendance)),
        // Integer daily headcounts round away engineered targets on 2-doctor
        // PHCs, so the rate (fraction of doctor-days attended) is set from the
        // profile directly, with small noise.
        attendanceRate7d: Math.round(Math.min(1, profile.attendance + (rnd() - 0.5) * 0.04) * 100) / 100,
      },
      beds: { total: seed.beds, occupied: bedsOccupied[DAYS - 1] },
      patients: {
        todayCount: Math.round(patientCounts[DAYS - 1]),
        avg7d: Math.round(mean(patientCounts.slice(DAYS - 7))),
        trend7dPct: Math.round(trend7dPct * 10) / 10,
      },
      tests,
      inventory,
      healthScore: 0,
      status: "healthy",
      lastUpdated: Date.now(),
      lastUpdateSource: "seed",
    };
    const breakdown = computeRisk(facility);
    facility.healthScore = breakdown.total;
    facility.status = breakdown.status;
    facilities.push(facility);

    history[seed.id] = Array.from({ length: DAYS }, (_, d) => {
      const date = new Date(demoDate.getTime() - (DAYS - 1 - d) * 86400000);
      return {
        date: isoDate(date),
        patientCount: Math.round(patientCounts[d]),
        doctorsPresent: doctorsPresent[d],
        bedsOccupied: bedsOccupied[d],
        consumption: Object.fromEntries(MEDICINES.map((m) => [m.id, consumptionByMed[m.id][d]])),
        stockLevels: Object.fromEntries(MEDICINES.map((m) => [m.id, stockByMed[m.id][d]])),
      };
    });
  });

  return { facilities, history };
}
