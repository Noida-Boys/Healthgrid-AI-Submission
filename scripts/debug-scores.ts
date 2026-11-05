import { generateDistrict } from "../lib/data/generate";
import { computeRisk } from "../lib/engine/risk";
import { daysToStockout } from "../lib/engine/forecast";

const { facilities } = generateDistrict("2026-07-04");
for (const f of facilities) {
  const b = computeRisk(f);
  const lows = Object.values(f.inventory)
    .filter((i) => i.essential)
    .map((i) => [i.medicineId, Math.round(daysToStockout(i, f.patients.trend7dPct) * 10) / 10] as const)
    .filter(([, d]) => d < 11);
  console.log(
    f.id.padEnd(17),
    String(b.total).padStart(3),
    f.status.padEnd(8),
    `med:${b.medicine} staff:${b.staffing} beds:${b.beds} surge:${b.surge} tests:${b.tests}`,
    JSON.stringify(lows),
  );
}
