// Finds the most demo-effective voice line: which single-sentence update
// flips a healthy facility's status live on the map.
import { computeRisk } from "../lib/engine/risk";
import { getAllFacilities } from "../lib/server/data";

(async () => {
  const facilities = await getAllFacilities();
  for (const f of facilities) {
    if (f.status !== "healthy") continue;
    const before = computeRisk(f);
    // Simulate: beds full + ORS down to 10 + only 1 doctor today
    const sim = structuredClone(f);
    sim.beds.occupied = sim.beds.total;
    if (sim.inventory["ors"]) sim.inventory["ors"].currentStock = 10;
    const orsKey = Object.keys(sim.inventory).find((k) => sim.inventory[k].name.toLowerCase().includes("ors"));
    if (orsKey) sim.inventory[orsKey].currentStock = 10;
    const after = computeRisk(sim);
    console.log(
      `${f.id.padEnd(16)} ${f.name.padEnd(16)} beds ${f.beds.occupied}/${f.beds.total}  ` +
      `${before.total} (${before.status})  ->  ${after.total} (${after.status})` +
      (before.status !== after.status ? "   << FLIPS" : ""),
    );
  }
})();
