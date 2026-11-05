/* Publishes firestore.rules via the Firebase Rules REST API using the admin
   service account (firebase-tools needs broader roles than the SDK account has).
   Run: npx tsx --env-file=.env.local scripts/deploy-rules.ts */
import { readFileSync } from "fs";
import { GoogleAuth } from "google-auth-library";
import { env } from "../lib/config";

(async () => {
  const sa = JSON.parse(Buffer.from(env("FIREBASE_SERVICE_ACCOUNT_B64"), "base64").toString("utf8"));
  const project: string = sa.project_id;
  const auth = new GoogleAuth({
    credentials: sa,
    scopes: ["https://www.googleapis.com/auth/firebase", "https://www.googleapis.com/auth/cloud-platform"],
  });
  const token = await (await auth.getClient()).getAccessToken();
  const headers = { Authorization: `Bearer ${token.token}`, "Content-Type": "application/json" };
  const base = `https://firebaserules.googleapis.com/v1/projects/${project}`;

  const rulesetRes = await fetch(`${base}/rulesets`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      source: { files: [{ name: "firestore.rules", content: readFileSync("firestore.rules", "utf8") }] },
    }),
  });
  if (!rulesetRes.ok) throw new Error(`ruleset create failed: ${rulesetRes.status} ${await rulesetRes.text()}`);
  const ruleset = await rulesetRes.json();
  console.log("ruleset:", ruleset.name);

  const releaseName = `projects/${project}/releases/cloud.firestore`;
  const patchRes = await fetch(`https://firebaserules.googleapis.com/v1/${releaseName}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({ release: { name: releaseName, rulesetName: ruleset.name } }),
  });
  if (patchRes.ok) {
    console.log("release updated:", releaseName);
    return;
  }
  // No existing release (fresh database): create instead.
  const createRes = await fetch(`${base}/releases`, {
    method: "POST",
    headers,
    body: JSON.stringify({ name: releaseName, rulesetName: ruleset.name }),
  });
  if (!createRes.ok) throw new Error(`release failed: ${createRes.status} ${await createRes.text()}`);
  console.log("release created:", releaseName);
})();
