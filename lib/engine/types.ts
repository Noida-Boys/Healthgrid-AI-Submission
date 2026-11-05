export type FacilityStatus = "healthy" | "at_risk" | "critical";

export interface InventoryItem {
  medicineId: string;
  name: string;
  unit: string;
  currentStock: number;
  avgDaily7d: number;
  avgDaily30d: number;
  reorderLevel: number;
  essential: boolean;
}

export interface Facility {
  id: string;
  name: string;
  type: "PHC" | "CHC";
  lat: number;
  lng: number;
  block: string;
  staff: {
    doctorsSanctioned: number;
    doctorsPresentToday: number;
    attendanceRate7d: number; // 0..1
  };
  beds: { total: number; occupied: number };
  patients: { todayCount: number; avg7d: number; trend7dPct: number };
  tests: Record<string, boolean>;
  inventory: Record<string, InventoryItem>;
  healthScore: number;
  status: FacilityStatus;
  lastUpdated: number;
  lastUpdateSource: "seed" | "manual" | "voice" | "transfer";
}

/** A district-wide stress scenario applied as a client-side lens over
    forecasts and scores. Never persisted; never mutates inventory. */
export type IncidentScenario = "normal" | "heavy_rain" | "flood_alert" | "heatwave";

export interface HistoryDay {
  date: string; // yyyy-mm-dd
  patientCount: number;
  doctorsPresent: number;
  bedsOccupied: number;
  consumption: Record<string, number>;
  stockLevels: Record<string, number>;
}
