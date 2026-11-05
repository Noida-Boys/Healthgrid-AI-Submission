/* District-level impact simulation.
   Replays the seeded 90-day history to establish stocks, then projects the
   NEXT 30 days and compares two worlds day by day:
     baseline:        each facility consumes at its current burn rate and is
                      replenished only on its observed restock cadence (where
                      the cadence has already slipped, the next delivery lands
                      one full cycle after the last one observed);
     with HealthGrid: additionally, whenever an essential medicine falls under
                      7 days of cover, the same guarded transfer the app
                      recommends executes (donor >21 days cover, donor keeps
                      >14 days, top-up to ~14 days of cover).
   Headline metric: facility-medicine stock-out days prevented in 30 days.
   Deterministic — same generator seed as the demo district.
   Run: npx tsx scripts/impact-sim.ts [demo-date] */
import { burnRate } from "../lib/engine/forecast";
import { MEDICINES } from "../lib/data/district";
import { generateDistrict } from "../lib/data/generate";

const DEMO_DATE = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const HORIZON = 30;
const { facilities, history } = generateDistrict(DEMO_DATE);
const DAYS = history[facilities[0].id].length;
const essential = MEDICINES.filter((m) => m.essential).map((m) => m.id);

/** Daily burn per facility-medicine, trend-adjusted (same engine as the app). */
const burn: Record<string, Record<string, number>> = {};
for (const f of facilities) {
  burn[f.id] = {};
  for (const med of essential) burn[f.id][med] = Math.max(0.1, burnRate(f.inventory[med], f.patients.trend7dPct));
}

/** Observed restock events (day-over-day stock increases) → cadence + next delivery. */
function restockPlan(fId: string, med: string): { nextDay: number; every: number; qty: number } {
  const days: number[] = [];
  for (let d = 1; d < DAYS; d++) {
    const prev = history[fId][d - 1].stockLevels[med];
    const cur = history[fId][d].stockLevels[med];
    const consumed = history[fId][d].consumption[med];
    if (cur - (prev - consumed) > 1) days.push(d);
  }
  const gaps = days.slice(1).map((d, i) => d - days[i]);
  const every = gaps.length ? gaps.sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 30;
  const last = days.length ? days[days.length - 1] : DAYS - every;
  let nextDay = last + every - DAYS; // relative to projection day 0
  while (nextDay < 0) nextDay += every; // slipped cadence: next full cycle
  return { nextDay, every, qty: Math.round(every * burn[fId][med]) };
}

function simulate(withTransfers: boolean) {
  const stock: Record<string, Record<string, number>> = {};
  const plans: Record<string, Record<string, { nextDay: number; every: number; qty: number }>> = {};
  for (const f of facilities) {
    stock[f.id] = {};
    plans[f.id] = {};
    for (const med of essential) {
      stock[f.id][med] = f.inventory[med].currentStock;
      plans[f.id][med] = restockPlan(f.id, med);
    }
  }

  let stockOutDays = 0;
  let transfers = 0;
  let unitsMoved = 0;
  const facilitiesHit = new Set<string>();

  for (let day = 0; day < HORIZON; day++) {
    for (const f of facilities) {
      for (const med of essential) {
        const plan = plans[f.id][med];
        if (day === plan.nextDay) {
          stock[f.id][med] += plan.qty;
          plan.nextDay += plan.every;
        }
      }
    }

    if (withTransfers) {
      for (const f of facilities) {
        for (const med of essential) {
          if (stock[f.id][med] / burn[f.id][med] >= 7) continue;
          const donor = facilities
            .filter((d) => d.id !== f.id)
            .map((d) => ({ d, cover: stock[d.id][med] / burn[d.id][med] }))
            .filter((x) => x.cover > 21)
            .sort((a, b) => b.cover - a.cover)[0];
          if (!donor) continue;
          const givable = Math.min(
            Math.floor(stock[donor.d.id][med] * 0.4),
            Math.floor(stock[donor.d.id][med] - burn[donor.d.id][med] * 14),
          );
          const qty = Math.min(givable, Math.ceil(burn[f.id][med] * 14));
          if (qty <= 0) continue;
          stock[donor.d.id][med] -= qty;
          stock[f.id][med] += qty;
          transfers++;
          unitsMoved += qty;
        }
      }
    }

    for (const f of facilities) {
      for (const med of essential) {
        if (stock[f.id][med] <= 0) {
          stockOutDays++;
          facilitiesHit.add(f.id);
        }
        stock[f.id][med] = Math.max(0, stock[f.id][med] - burn[f.id][med]);
      }
    }
  }
  return { stockOutDays, transfers, unitsMoved, facilitiesHit: facilitiesHit.size };
}

const baseline = simulate(false);
const guided = simulate(true);
const prevented = baseline.stockOutDays - guided.stockOutDays;
const pct = baseline.stockOutDays ? Math.round((prevented / baseline.stockOutDays) * 100) : 0;

console.log(`District impact projection — next ${HORIZON} days · ${facilities.length} facilities · ${essential.length} essential medicines`);
console.log(`  Baseline stock-out days (facility × medicine × day):  ${baseline.stockOutDays} across ${baseline.facilitiesHit} facilities`);
console.log(`  With HealthGrid transfer policy:                      ${guided.stockOutDays}`);
console.log(`  Stock-out days PREVENTED:                             ${prevented} (${pct}%)`);
console.log(`  Via ${guided.transfers} guarded transfers moving ${guided.unitsMoved.toLocaleString("en-IN")} units — zero new stock purchased`);
