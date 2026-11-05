import { incidentEffects } from "./incident";
import type { Facility, IncidentScenario } from "./types";

export type DemandTrend = "rising" | "stable" | "falling";
export type DemandPressure = "low" | "moderate" | "high" | "critical";

export interface DemandForecast {
  facilityId: string;
  predictedTomorrow: number;
  predicted7DayTotal: number;
  trend: DemandTrend;
  pressure: DemandPressure;
  confidence: number;
  reasons: string[];
}

function finite(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

export function demandForecast(facility: Facility, scenario?: IncidentScenario): DemandForecast {
  const fx = incidentEffects(scenario);
  const today = Math.max(0, finite(facility.patients?.todayCount, 0));
  const average = Math.max(0, finite(facility.patients?.avg7d, today));
  const trendPct = Math.max(-50, Math.min(100, finite(facility.patients?.trend7dPct, 0)));
  const baseline = average || today;
  const todayGap = baseline > 0 ? (today - baseline) / baseline : 0;
  const trendEffect = trendPct / 100;

  // The weekly trend carries most weight; today's deviation adds a smaller
  // near-term signal without allowing a single noisy day to dominate.
  // The incident footfall lens applies after the clamp (guarded: the normal
  // path stays byte-for-byte identical).
  let tomorrowMultiplier = Math.max(0.5, Math.min(2, 1 + trendEffect * 0.65 + todayGap * 0.35));
  if (fx.footfall !== 1) tomorrowMultiplier *= fx.footfall;
  const predictedTomorrow = Math.max(0, Math.round(baseline * tomorrowMultiplier));
  const dailyGrowth = Math.max(-0.05, Math.min(0.08, trendEffect / 7));
  let predicted7DayTotal = 0;
  for (let day = 0; day < 7; day++) predicted7DayTotal += predictedTomorrow * Math.pow(1 + dailyGrowth, day);

  const trend: DemandTrend = trendPct >= 8 || todayGap >= 0.12 ? "rising" : trendPct <= -8 || todayGap <= -0.12 ? "falling" : "stable";
  const doctorAttendance = Math.max(0, Math.min(1, finite(facility.staff?.attendanceRate7d, 1)));
  const occupancy = facility.beds?.total > 0 ? facility.beds.occupied / facility.beds.total : 0;
  const capacityRatio = baseline > 0 ? predictedTomorrow / baseline : 1;
  let pressureScore = capacityRatio >= 1.25 ? 2 : capacityRatio >= 1.08 ? 1 : 0;
  if (occupancy >= 0.9) pressureScore += 2;
  else if (occupancy >= 0.8) pressureScore += 1;
  if (doctorAttendance < 0.65) pressureScore += 2;
  else if (doctorAttendance < 0.8) pressureScore += 1;
  const unavailableTests = Object.entries(facility.tests ?? {}).filter(([, available]) => !available).map(([name]) => name);
  if (unavailableTests.length >= 2) pressureScore += 1;
  const pressure: DemandPressure = pressureScore >= 5 ? "critical" : pressureScore >= 3 ? "high" : pressureScore >= 1 ? "moderate" : "low";

  const reasons: string[] = [];
  if (fx.footfall !== 1) {
    reasons.push(`${fx.label} scenario: expected footfall adjusted +${Math.round((fx.footfall - 1) * 100)}%.`);
  }
  if (Math.abs(trendPct) >= 5) reasons.push(`Patient demand is ${Math.abs(Math.round(trendPct))}% ${trendPct > 0 ? "above" : "below"} the previous 7-day trend.`);
  else reasons.push("Patient demand is close to its recent 7-day pattern.");
  if (Math.abs(todayGap) >= 0.1) reasons.push(`Today's footfall is ${Math.abs(Math.round(todayGap * 100))}% ${todayGap > 0 ? "above" : "below"} the 7-day average.`);
  if (occupancy >= 0.8) reasons.push(`Bed occupancy is ${Math.round(occupancy * 100)}%, increasing capacity pressure.`);
  if (doctorAttendance < 0.8) reasons.push(`Doctor attendance is ${Math.round(doctorAttendance * 100)}%, below the operational target.`);
  if (unavailableTests.length > 0) reasons.push(`${unavailableTests.slice(0, 2).join(" and ")} ${unavailableTests.length === 1 ? "is" : "are"} unavailable, constraining service capacity.`);

  const completeness = [facility.patients?.todayCount, facility.patients?.avg7d, facility.patients?.trend7dPct, facility.staff?.attendanceRate7d, facility.beds?.total]
    .filter(Number.isFinite).length;
  const confidence = Math.min(0.92, 0.55 + completeness * 0.07);

  return {
    facilityId: facility.id,
    predictedTomorrow,
    predicted7DayTotal: Math.max(0, Math.round(predicted7DayTotal)),
    trend,
    pressure,
    confidence: Math.round(confidence * 100) / 100,
    reasons: reasons.slice(0, fx.footfall !== 1 ? 4 : 3),
  };
}
