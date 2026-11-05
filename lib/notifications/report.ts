import { facilityForecast } from "@/lib/engine/forecast";
import type { Facility } from "@/lib/engine/types";
import type { NotificationPriority } from "./types";

export interface ReportRecommendation {
  medicineId: string;
  medicineName: string;
  qty: number;
  unit: string;
  toFacilityId: string;
  fromFacilityId: string;
  fromFacilityName?: string;
  distanceKm?: number;
  reasoning?: string;
  status: "pending" | "approved" | "dismissed";
}

export interface OperationalReportInput {
  facility: Facility;
  recommendations?: ReportRecommendation[];
}

export function priorityForFacility(facility: Facility): NotificationPriority {
  if (facility.status === "critical") return "critical";
  if (facility.status === "at_risk") return "high";
  return "low";
}

function displayNumber(value: number, maximumFractionDigits = 1): string {
  if (!Number.isFinite(value)) return "Not available";
  return value.toLocaleString("en-IN", { maximumFractionDigits });
}

function riskLabel(facility: Facility): string {
  if (facility.status === "at_risk") return "AT RISK";
  return facility.status.toUpperCase();
}

export function generateOperationalReport({ facility, recommendations = [] }: OperationalReportInput): string {
  const forecasts = facilityForecast(facility);
  const shortage =
    forecasts.find((forecast) => forecast.severity !== "ok" && facility.inventory[forecast.medicineId]?.essential) ??
    forecasts.find((forecast) => forecast.severity !== "ok");
  const recommendation = shortage
    ? recommendations.find(
        (item) => item.toFacilityId === facility.id && item.medicineId === shortage.medicineId && item.status === "pending",
      )
    : recommendations.find((item) => item.toFacilityId === facility.id && item.status === "pending");
  const inventoryItem = shortage ? facility.inventory[shortage.medicineId] : undefined;
  const lines = [
    "HEALTHGRID OPERATIONAL ALERT",
    "",
    `Facility: ${facility.name}`,
    `Facility Type: ${facility.type}`,
    `Block: ${facility.block}`,
    `Operational Risk: ${riskLabel(facility)}`,
    `Health Score: ${displayNumber(facility.healthScore, 0)}/100`,
    `Priority: ${priorityForFacility(facility).toUpperCase()}`,
  ];

  if (shortage && inventoryItem) {
    lines.push(
      "",
      `Medicine: ${shortage.name}`,
      `Current Stock: ${displayNumber(inventoryItem.currentStock, 0)} ${inventoryItem.unit}`,
      `Forecasted Demand: ${displayNumber(shortage.burnRate)} ${inventoryItem.unit}/day`,
      `Predicted Stock-Out: ${displayNumber(shortage.daysLeft)} days`,
    );
  }

  lines.push("", "Recommended Action:");
  if (recommendation) {
    const donor = recommendation.fromFacilityName ?? recommendation.fromFacilityId;
    lines.push(`Receive ${displayNumber(recommendation.qty, 0)} ${recommendation.unit} of ${recommendation.medicineName} from ${donor}.`);
    if (typeof recommendation.distanceKm === "number" && Number.isFinite(recommendation.distanceKm)) {
      lines.push(`Distance: ${displayNumber(recommendation.distanceKm)} km`);
    }
    if (recommendation.reasoning?.trim()) lines.push(recommendation.reasoning.trim());
  } else if (shortage) {
    lines.push(`Review and replenish ${shortage.name} stock immediately.`);
  } else {
    lines.push("Continue routine monitoring and confirm current operational capacity.");
  }

  lines.push(
    "",
    "Please acknowledge this notification once the recommended action has been completed.",
    "",
    "HealthGrid District Command Centre",
  );
  return lines.join("\n");
}
