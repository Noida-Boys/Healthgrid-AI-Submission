// Static definition of the demo district: Wardha, Maharashtra.
// Coordinates are approximate town locations; operational data is synthetic.

export interface MedicineDef {
  id: string;
  name: string;
  unit: string;
  essential: boolean;
  perPatientFactor: number; // avg units consumed per patient visit
}

export const MEDICINES: MedicineDef[] = [
  { id: "paracetamol", name: "Paracetamol 500mg", unit: "tabs", essential: true, perPatientFactor: 0.4 },
  { id: "ors", name: "ORS Sachets", unit: "sachets", essential: true, perPatientFactor: 0.15 },
  { id: "amoxicillin", name: "Amoxicillin 250mg", unit: "caps", essential: true, perPatientFactor: 0.12 },
  { id: "ifa", name: "Iron-Folic Acid", unit: "tabs", essential: true, perPatientFactor: 0.25 },
  { id: "metformin", name: "Metformin 500mg", unit: "tabs", essential: true, perPatientFactor: 0.2 },
  { id: "amlodipine", name: "Amlodipine 5mg", unit: "tabs", essential: true, perPatientFactor: 0.15 },
  { id: "azithromycin", name: "Azithromycin 250mg", unit: "tabs", essential: true, perPatientFactor: 0.06 },
  { id: "zinc", name: "Zinc Sulphate", unit: "tabs", essential: true, perPatientFactor: 0.1 },
  { id: "cetirizine", name: "Cetirizine 10mg", unit: "tabs", essential: false, perPatientFactor: 0.08 },
  { id: "ranitidine", name: "Ranitidine 150mg", unit: "tabs", essential: false, perPatientFactor: 0.08 },
  { id: "iv-ns", name: "IV Fluids (NS)", unit: "bottles", essential: false, perPatientFactor: 0.02 },
  { id: "cotrimoxazole", name: "Cotrimoxazole", unit: "tabs", essential: false, perPatientFactor: 0.05 },
];

export const CORE_TESTS = ["Hemoglobin", "Blood Sugar", "Malaria RDT", "Urine Analysis"] as const;

export interface FacilitySeed {
  id: string;
  name: string;
  type: "PHC" | "CHC";
  lat: number;
  lng: number;
  block: string;
  basePatients: number;
  beds: number;
  doctorsSanctioned: number;
}

export const WARDHA_FACILITIES: FacilitySeed[] = [
  { id: "wardha-chc", name: "Wardha CHC", type: "CHC", lat: 20.7453, lng: 78.6022, block: "Wardha", basePatients: 220, beds: 30, doctorsSanctioned: 6 },
  { id: "hinganghat-chc", name: "Hinganghat CHC", type: "CHC", lat: 20.549, lng: 78.839, block: "Hinganghat", basePatients: 180, beds: 30, doctorsSanctioned: 6 },
  { id: "arvi-chc", name: "Arvi CHC", type: "CHC", lat: 20.987, lng: 78.226, block: "Arvi", basePatients: 160, beds: 30, doctorsSanctioned: 6 },
  { id: "seloo-phc", name: "Seloo PHC", type: "PHC", lat: 20.797, lng: 78.699, block: "Seloo", basePatients: 90, beds: 10, doctorsSanctioned: 2 },
  { id: "deoli-phc", name: "Deoli PHC", type: "PHC", lat: 20.65, lng: 78.48, block: "Deoli", basePatients: 85, beds: 8, doctorsSanctioned: 2 },
  { id: "samudrapur-phc", name: "Samudrapur PHC", type: "PHC", lat: 20.653, lng: 78.967, block: "Samudrapur", basePatients: 75, beds: 8, doctorsSanctioned: 2 },
  { id: "karanja-phc", name: "Karanja PHC", type: "PHC", lat: 21.1, lng: 78.36, block: "Karanja", basePatients: 70, beds: 6, doctorsSanctioned: 2 },
  { id: "ashti-phc", name: "Ashti PHC", type: "PHC", lat: 21.2, lng: 78.216, block: "Ashti", basePatients: 65, beds: 6, doctorsSanctioned: 2 },
  { id: "pulgaon-phc", name: "Pulgaon PHC", type: "PHC", lat: 20.721, lng: 78.32, block: "Deoli", basePatients: 95, beds: 10, doctorsSanctioned: 2 },
  { id: "talegaon-phc", name: "Talegaon PHC", type: "PHC", lat: 21.03, lng: 78.28, block: "Ashti", basePatients: 60, beds: 6, doctorsSanctioned: 2 },
  { id: "sindi-phc", name: "Sindi PHC", type: "PHC", lat: 20.8, lng: 78.88, block: "Seloo", basePatients: 70, beds: 6, doctorsSanctioned: 2 },
  { id: "anji-phc", name: "Anji PHC", type: "PHC", lat: 20.68, lng: 78.56, block: "Wardha", basePatients: 75, beds: 8, doctorsSanctioned: 2 },
  { id: "waifad-phc", name: "Waifad PHC", type: "PHC", lat: 20.86, lng: 78.55, block: "Wardha", basePatients: 65, beds: 6, doctorsSanctioned: 2 },
  { id: "girad-phc", name: "Girad PHC", type: "PHC", lat: 20.55, lng: 79.05, block: "Samudrapur", basePatients: 55, beds: 6, doctorsSanctioned: 2 },
  { id: "kharangana-phc", name: "Kharangana PHC", type: "PHC", lat: 20.9, lng: 78.75, block: "Seloo", basePatients: 60, beds: 6, doctorsSanctioned: 2 },
];

/** Per-facility engineered deviations from a healthy baseline. */
export interface FacilityProfile {
  attendance: number; // 7d attendance rate target
  occupancy: number; // bed occupancy target
  trendPct: number; // 7d patient trend target
  testsDown: number; // how many of CORE_TESTS are unavailable
  medDaysLeft: Record<string, number>; // medicineId -> target days-to-stockout
}

const HEALTHY: FacilityProfile = { attendance: 0.93, occupancy: 0.62, trendPct: 3, testsDown: 0, medDaysLeft: {} };

export const PROFILES: Record<string, FacilityProfile> = {
  // The demo protagonist: supply crisis + patient surge. Target: critical (<60).
  "seloo-phc": {
    attendance: 0.5,
    occupancy: 0.93,
    trendPct: 34,
    testsDown: 1,
    medDaysLeft: { paracetamol: 5, ors: 2, zinc: 2.5, ifa: 6, amoxicillin: 6.5, metformin: 5 },
  },
  // Second critical: staffing collapse + broken diagnostics + antibiotic stock-outs.
  "girad-phc": {
    attendance: 0.45,
    occupancy: 0.95,
    trendPct: 8,
    testsDown: 3,
    medDaysLeft: { amoxicillin: 2, azithromycin: 2, ors: 5, ifa: 6 },
  },
  // At-risk trio: each squeezed on two-three dimensions.
  "hinganghat-chc": { attendance: 0.75, occupancy: 0.9, trendPct: 18, testsDown: 0, medDaysLeft: { zinc: 5, ors: 6 } },
  "pulgaon-phc": { attendance: 0.6, occupancy: 0.7, trendPct: 5, testsDown: 1, medDaysLeft: { paracetamol: 6, ifa: 6.5 } },
  "samudrapur-phc": { attendance: 0.85, occupancy: 0.88, trendPct: 12, testsDown: 0, medDaysLeft: { zinc: 2, metformin: 6 } },
};

export function profileFor(facilityId: string): FacilityProfile {
  return PROFILES[facilityId] ?? HEALTHY;
}
