import { demandForecast, type DemandForecast } from "./demand";
import { facilityForecast } from "./forecast";
import { incidentEffects, medicineMultiplier } from "./incident";
import { computeRisk } from "./risk";
import type { Facility, IncidentScenario } from "./types";

export type InterventionStatus = "Critical" | "At Risk" | "Watch";

export interface InterventionItem {
  facilityId: string;
  facilityName: string;
  status: InterventionStatus;
  riskScore: number;
  urgency: number;
  primaryReason: string;
  recommendedAction: string;
  demand: DemandForecast;
}

export function interventionQueue(facilities: Facility[], scenario?: IncidentScenario): InterventionItem[] {
  const fx = incidentEffects(scenario);
  return facilities
    .map((facility) => {
      const demand = demandForecast(facility, scenario);
      const urgentStock = facilityForecast(facility, scenario).find((x) => x.severity !== "ok" && facility.inventory[x.medicineId]?.essential);
      const occupancy = facility.beds.total ? facility.beds.occupied / facility.beds.total : 0;
      const unavailableTest = Object.entries(facility.tests).find(([, available]) => !available)?.[0];
      const attendance = facility.staff.attendanceRate7d;
      // Under a scenario the stored score is re-lensed; normal keeps the
      // stored value so ranking is byte-for-byte identical to today.
      const riskScore = fx.footfall === 1 ? facility.healthScore : computeRisk(facility, scenario).total;
      let urgency = 100 - riskScore;
      if (urgentStock?.severity === "critical") urgency += 24;
      else if (urgentStock) urgency += 12;
      if (demand.pressure === "critical") urgency += 20;
      else if (demand.pressure === "high") urgency += 14;
      else if (demand.pressure === "moderate") urgency += 6;
      if (occupancy >= 0.9) urgency += 12;
      if (attendance < 0.7) urgency += 10;
      if (unavailableTest) urgency += 4;

      let primaryReason = demand.reasons[0];
      let recommendedAction = "Monitor demand and facility capacity";
      if (urgentStock) {
        const days = Math.max(0, Math.floor(urgentStock.daysLeft));
        primaryReason = `${urgentStock.name} may stock out in ${days} ${days === 1 ? "day" : "days"}${demand.pressure === "high" || demand.pressure === "critical" ? ` with ${demand.pressure} patient demand` : ""}.`;
        recommendedAction = "Review transfer recommendation";
      } else if (occupancy >= 0.85) {
        primaryReason = `Bed occupancy is ${Math.round(occupancy * 100)}% with ${demand.trend} OPD demand.`;
        recommendedAction = "Review capacity and staffing";
      } else if (attendance < 0.8) {
        primaryReason = `Doctor attendance is ${Math.round(attendance * 100)}% while demand pressure is ${demand.pressure}.`;
        recommendedAction = "Arrange staffing support";
      } else if (unavailableTest) {
        primaryReason = `${unavailableTest} is unavailable for diagnostics.`;
        recommendedAction = "Verify test availability";
      }

      if (fx.footfall !== 1) {
        primaryReason +=
          urgentStock && medicineMultiplier(urgentStock.medicineId, scenario) > 1
            ? ` ${fx.label} increases ${urgentStock.name} demand and patient footfall pressure.`
            : ` ${fx.label} raises patient footfall pressure.`;
      }

      const status: InterventionStatus = urgency >= 85 || facility.status === "critical" ? "Critical" : urgency >= 50 || facility.status === "at_risk" ? "At Risk" : "Watch";
      return { facilityId: facility.id, facilityName: facility.name, status, riskScore, urgency, primaryReason, recommendedAction, demand };
    })
    .filter((item) => item.status !== "Watch" || item.urgency >= 25)
    .sort((a, b) => b.urgency - a.urgency || a.riskScore - b.riskScore || a.facilityName.localeCompare(b.facilityName));
}
