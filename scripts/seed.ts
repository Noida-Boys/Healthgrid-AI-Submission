/* Seeds Firestore with the generated Wardha district.
   Run: npm run seed -- --demo-date 2026-07-04  (defaults to today) */
import { generateDistrict } from "../lib/data/generate";
import { adminDb } from "../lib/firebase/admin-core";

const argIdx = process.argv.indexOf("--demo-date");
const demoDate = argIdx > -1 ? process.argv[argIdx + 1] : new Date().toISOString().slice(0, 10);

async function clearCollection(name: string) {
  const db = adminDb();
  const snap = await db.collection(name).get();
  let batch = db.batch();
  let n = 0;
  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    if (++n % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
}

(async () => {
  const db = adminDb();
  const { facilities, history } = generateDistrict(demoDate);

  await clearCollection("recommendations");
  await clearCollection("events");

  let batch = db.batch();
  let writes = 0;
  const flushIfNeeded = async () => {
    if (++writes % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  };

  for (const f of facilities) {
    batch.set(db.collection("facilities").doc(f.id), f);
    await flushIfNeeded();
    for (const day of history[f.id]) {
      batch.set(db.collection("history").doc(f.id).collection("days").doc(day.date), day);
      await flushIfNeeded();
    }
  }
  batch.set(db.collection("events").doc(), {
    type: "manual_update",
    facilityId: null,
    payload: { note: `District seeded for demo date ${demoDate}` },
    timestamp: Date.now(),
  });
  await batch.commit();

  const critical = facilities.filter((f) => f.status === "critical").map((f) => f.id);
  const historyCount = facilities.length * history[facilities[0].id].length;
  console.log(`Seeded ${facilities.length} facilities, ${historyCount} history docs. critical: ${critical.join(", ")}`);
  process.exit(0);
})();
