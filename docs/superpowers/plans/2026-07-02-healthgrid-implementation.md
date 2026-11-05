# HealthGrid AI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working end-to-end district health command center (HealthGrid AI) — live map, deterministic risk/forecast engines, 4 Gemini integrations, Hindi voice updates — deployed publicly before the hackathon deadline (~2026-07-05).

**Architecture:** Next.js App Router app; Firestore is the single source of truth with client realtime listeners; all Gemini calls server-side in API routes; deterministic engines (`lib/engine/`) compute every number shown, Gemini explains/recommends/converses. Spec: `docs/superpowers/specs/2026-07-02-healthgrid-design.md`.

**Tech Stack:** Next.js 15 (TypeScript, Tailwind), Firestore (client SDK reads + firebase-admin writes), `@google/genai`, Google Maps JS API via `@googlemaps/js-api-loader`, Vitest.

## Global Constraints

- All Gemini calls server-side only; `GEMINI_API_KEY` never in client bundle. Model ID from `GEMINI_MODEL` env (default `gemini-2.5-flash`; Task 1 upgrades default if a Gemini-3 flash model is available on the key).
- Every displayed number must come from Firestore data or the deterministic engines — Gemini output is only ever explanation/recommendation text and structured proposals validated server-side.
- No polling: client updates come from `onSnapshot` listeners.
- Status semantics everywhere: `healthy` (score ≥70) / `at_risk` (40–69) / `critical` (<40). Colors: semantic green/amber/red used ONLY for facility status.
- Copy rule: product name is exactly "HealthGrid AI". Hindi strings in Devanagari, never romanized.
- Demo data: Wardha district, Maharashtra; Seloo PHC is the engineered critical facility (paracetamol stock-out ≈5 days, patient load +34%).
- Karpathy guidelines apply: minimum code, no speculative abstraction, every line traces to the spec.
- Commit after every task (conventional commits).

---

### Task 1: Scaffold, env, keys verification

**Files:**
- Create: Next.js app in repo root `C:\bwa\healthgrid` (`create-next-app` into existing dir), `.env.local`, `.env.example`, `lib/config.ts`, `vitest.config.ts`
- Modify: `.gitignore` (ensure `.env.local`, service account json)

**Interfaces:**
- Produces: running dev server; `lib/config.ts` exporting `GEMINI_MODEL` (string), `env()` helper that throws on missing vars.

- [ ] **Step 1: Scaffold** — `npx create-next-app@latest . --typescript --tailwind --app --no-src-dir --import-alias "@/*"` (accept into existing dir; docs/ already present). Then `npm i firebase firebase-admin @google/genai @googlemaps/js-api-loader && npm i -D vitest @vitest/coverage-v8`.
- [ ] **Step 2: `.env.example`** with: `GEMINI_API_KEY=`, `GEMINI_MODEL=gemini-2.5-flash`, `NEXT_PUBLIC_FIREBASE_API_KEY=`, `NEXT_PUBLIC_FIREBASE_PROJECT_ID=`, `NEXT_PUBLIC_FIREBASE_APP_ID=`, `NEXT_PUBLIC_MAPS_API_KEY=`, `FIREBASE_SERVICE_ACCOUNT_B64=` (base64 of service-account JSON). Ask user for real values into `.env.local`.
- [ ] **Step 3: Key verification script** `scripts/check-keys.ts`: lists Gemini models via `ai.models.list()`, prints whether a `gemini-3` flash-tier model exists (if so, set `GEMINI_MODEL` accordingly in `.env.local`), does a 1-token `generateContent` smoke call, and initializes firebase-admin. Run: `npx tsx scripts/check-keys.ts`. Expected: `GEMINI OK <model>`, `FIRESTORE OK`.
- [ ] **Step 4: `vitest.config.ts`** (node env, include `lib/**/*.test.ts`). Add `"test": "vitest run"` to package.json scripts.
- [ ] **Step 5: Verify** `npm run dev` serves default page; `npm run test` runs (0 tests OK). Commit `chore: scaffold next app, deps, env, key checks`.

---

### Task 2: Domain types + risk engine (TDD)

**Files:**
- Create: `lib/engine/types.ts`, `lib/engine/risk.ts`, `lib/engine/risk.test.ts`

**Interfaces:**
- Produces:

```ts
// types.ts
export type FacilityStatus = "healthy" | "at_risk" | "critical";
export interface InventoryItem {
  medicineId: string; name: string; unit: string;
  currentStock: number; avgDaily7d: number; avgDaily30d: number;
  reorderLevel: number; essential: boolean;
}
export interface Facility {
  id: string; name: string; type: "PHC" | "CHC"; lat: number; lng: number; block: string;
  staff: { doctorsSanctioned: number; doctorsPresentToday: number; attendanceRate7d: number };
  beds: { total: number; occupied: number };
  patients: { todayCount: number; avg7d: number; trend7dPct: number };
  tests: Record<string, boolean>;
  inventory: Record<string, InventoryItem>;
  healthScore: number; status: FacilityStatus;
  lastUpdated: number; lastUpdateSource: "seed" | "manual" | "voice" | "transfer";
}
// risk.ts
export interface ScoreBreakdown { medicine: number; staffing: number; beds: number; surge: number; tests: number; total: number; status: FacilityStatus; }
export function computeRisk(f: Facility): ScoreBreakdown;
```

- [ ] **Step 1: Failing tests** in `risk.test.ts` — a `baseFacility()` fixture (full stocks 30+ days supply, attendance 0.95, occupancy 0.6, trend 2%, all tests true) asserts `total ≥ 90`, `status === "healthy"`; a crafted critical fixture (2 essential meds < 3 days, attendance 0.5, occupancy 0.95, trend +34%, half tests down) asserts `status === "critical"`; component maxima: medicine ≤40, staffing ≤25, beds ≤15, surge ≤10, tests ≤10; boundary: totals 70/40 map to healthy/at_risk.
- [ ] **Step 2: Run** `npm run test` → FAIL (module not found).
- [ ] **Step 3: Implement `risk.ts`** per spec §6:

```ts
import type { Facility, FacilityStatus } from "./types";
import { daysToStockout } from "./forecast";

export function computeRisk(f: Facility): ScoreBreakdown {
  const meds = Object.values(f.inventory).filter(m => m.essential);
  const penalty = meds.reduce((s, m) => {
    const d = daysToStockout(m, f.patients.trend7dPct);
    return s + (d < 3 ? 1 : d < 7 ? 0.5 : 0);
  }, 0);
  const medicine = Math.round(40 * (1 - (meds.length ? penalty / meds.length : 0)));
  const staffing = Math.round(25 * Math.min(1, f.staff.attendanceRate7d));
  const occ = f.beds.total ? f.beds.occupied / f.beds.total : 0;
  const beds = Math.round(15 * (occ <= 0.85 ? 1 : Math.max(0, 1 - (occ - 0.85) / 0.15)));
  const t = f.patients.trend7dPct;
  const surge = Math.round(10 * (t <= 10 ? 1 : Math.max(0, 1 - (t - 10) / 40)));
  const testVals = Object.values(f.tests);
  const tests = Math.round(10 * (testVals.length ? testVals.filter(Boolean).length / testVals.length : 1));
  const total = medicine + staffing + beds + surge + tests;
  const status: FacilityStatus = total >= 70 ? "healthy" : total >= 40 ? "at_risk" : "critical";
  return { medicine, staffing, beds, surge, tests, total, status };
}
```

(Note: imports `daysToStockout` — write its minimal version in this task inside `forecast.ts`; Task 3 completes it TDD-style.)
- [ ] **Step 4: Run tests** → PASS. Adjust fixture numbers if a boundary assertion misses; engines are ours, tests encode the spec.
- [ ] **Step 5: Commit** `feat: domain types and risk scoring engine`.

---

### Task 3: Forecast engine (TDD)

**Files:**
- Create: `lib/engine/forecast.ts` (complete), `lib/engine/forecast.test.ts`

**Interfaces:**
- Produces:

```ts
export function burnRate(item: InventoryItem, trend7dPct: number): number;
// 0.7*avgDaily7d + 0.3*avgDaily30d; if |trend|>15, multiply by (1 + trend7dPct/100); min 0
export function daysToStockout(item: InventoryItem, trend7dPct: number): number; // Infinity when burnRate 0
export type Severity = "ok" | "warning" | "critical";
export interface MedForecast { medicineId: string; name: string; daysLeft: number; severity: Severity; burnRate: number; }
export function facilityForecast(f: Facility): MedForecast[]; // sorted ascending daysLeft
```

- [ ] **Step 1: Failing tests** — burn rate weighting (avg7=10, avg30=20 → 13); trend amplification (trend 34 → 13×1.34); no amplification at trend 10; `daysToStockout` (stock 65, rate 13 → 5); Infinity at zero rate; severity thresholds (<3 critical, <7 warning); sort order.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** (≤30 lines, pure functions). **Step 4: Run** → PASS. **Step 5: Commit** `feat: consumption forecast engine`.

---

### Task 4: Firestore access layer + seed script

**Files:**
- Create: `lib/firebase/client.ts` (client SDK init), `lib/firebase/admin.ts` (admin init from `FIREBASE_SERVICE_ACCOUNT_B64`), `lib/data/district.ts` (static Wardha definition), `scripts/seed.ts`, `lib/data/district.test.ts`

**Interfaces:**
- Produces: `adminDb` (Firestore admin instance); `clientDb`; `WARDHA_FACILITIES: FacilitySeed[]` (15 entries); `MEDICINES` (12: Paracetamol 500mg/tabs, ORS sachets, Amoxicillin 250mg, Iron-Folic Acid, Metformin 500mg, Amlodipine 5mg, Azithromycin 250mg, Zinc tabs, Cetirizine, Ranitidine, IV Fluids NS, Cotrimoxazole — first 8 `essential: true`); `npm run seed -- --demo-date 2026-07-04`.
- Firestore layout per spec §5: `facilities/{id}`, `history/{facilityId}/days/{yyyy-mm-dd}` (90 days), `recommendations/{id}`, `events/{id}`.

- [ ] **Step 1: `district.ts`** — 15 facilities with real-ish coordinates (Wardha CHC 20.745,78.602; Hinganghat CHC 20.549,78.839; Arvi CHC 20.987,78.226; Seloo PHC 20.797,78.699; Deoli PHC 20.650,78.480; Samudrapur PHC 20.653,78.967; Karanja PHC 21.100,78.360; Ashti PHC 21.200,78.216; Pulgaon PHC 20.721,78.320; Talegaon PHC 21.03,78.28; Sindi PHC 20.80,78.88; Anji PHC 20.68,78.56; Waifad PHC 20.86,78.55; Girad PHC 20.55,79.05; Kharangana PHC 20.90,78.75), each with base patient load, bed count (PHC 6–10, CHC 30), sanctioned doctors (PHC 2, CHC 6).
- [ ] **Step 2: Test the engineered outcome** — `district.test.ts`: run generator pure function `generateDistrict(demoDate)` (returns facilities + history in memory, statuses computed via `computeRisk`) and assert: exactly 2 critical (Seloo PHC one of them), 3 at_risk, 10 healthy; Seloo paracetamol `daysToStockout` in [4,6]; Seloo `trend7dPct` in [30,38].
- [ ] **Step 3: Implement generator** — seeded RNG (mulberry32, fixed seed) for reproducibility; per-day patientCount = base × (1 + 0.15·sin(2π·day/365 + phase)) × noise(±10%); consumption per medicine = patients × perPatientFactor; stock decays daily, restock to full every 28–35 days; **overrides:** Seloo — no paracetamol restock for 40 days + linear patient ramp +34% over last 14 days; second critical (Girad PHC) — attendance 0.45 + two tests down + amoxicillin < 3 days; three at_risk facilities get one squeezed dimension each (staffing / bed occupancy 0.92 / zinc+ORS ≈ 5 days). Run test → PASS.
- [ ] **Step 4: `scripts/seed.ts`** — calls `generateDistrict`, batch-writes facilities (with computed `healthScore`/`status`), 90 history days each, clears `recommendations` + `events`, writes one seed event. Run against real Firestore: `npx tsx scripts/seed.ts --demo-date 2026-07-04`. Expected output: `Seeded 15 facilities, 1350 history docs. critical: seloo-phc, girad-phc`.
- [ ] **Step 5: Firestore rules** — in Firebase console (user action, guided): reads allowed, client writes denied. Commit `feat: wardha district generator and firestore seed`.

---

### Task 5: Design system (ui-ux-pro-max) → DESIGN.md + tokens

**Files:**
- Create: `DESIGN.md`, modify `app/globals.css`, `app/layout.tsx` (fonts)

**Interfaces:**
- Produces: CSS custom properties `--surface-0/1/2`, `--ink-1/2/3`, `--accent`, `--status-healthy/at-risk/critical`, `--font-ui`, `--font-mono`; every later UI task styles ONLY with these tokens.

- [ ] **Step 1:** Invoke the `ui-ux-pro-max` skill (queries: dark dashboard / command center style, dashboard color palette, font pairing with Devanagari support, nextjs stack guidelines, chart/ux rules for dense data UI).
- [ ] **Step 2:** Write `DESIGN.md`: palette (deep neutral surfaces ~#0B0E14 family, ONE accent, semantic status trio), IBM Plex Sans + Noto Sans Devanagari + IBM Plex Mono (tabular nums for all metrics), spacing scale, component rules (density, borders over shadows, no gradients/glassmorphism/emoji), motion rules (marker pulse + count-up only). Encode the spec §8 prohibitions verbatim.
- [ ] **Step 3:** Implement tokens in `globals.css`, wire `next/font` in `layout.tsx`, set page `<title>HealthGrid AI</title>`. Verify dev server renders fonts. Commit `feat: design tokens and design doctrine`.

---

### Task 6: Realtime data hooks + command center shell + Google Map

**Files:**
- Create: `hooks/useFacilities.ts`, `hooks/useEvents.ts`, `hooks/useRecommendations.ts`, `components/map/MapCanvas.tsx`, `components/map/FacilityMarker.ts` (OverlayView), `lib/map-style.ts` (dark JSON style), `app/page.tsx` (3-column command center grid), `components/PulseHeader.tsx`
- Test: visual via dev server + Firestore-console edit

**Interfaces:**
- Consumes: seeded Firestore, tokens from Task 5.
- Produces: `useFacilities(): { facilities: Facility[]; loading: boolean }` (onSnapshot, ordered by name); `MapCanvas({ facilities, selectedId, onSelect })` — renders styled Google Map centered on Wardha (20.78, 78.6, zoom 10) with one custom `OverlayView` marker per facility: glowing dot (12px core + pulse ring on `status` change, box-shadow glow in status color) + name label at zoom ≥ 11; clicking calls `onSelect(id)`. `PulseHeader({ facilities })`: counts by status, total patients today, pending recommendations count.

- [ ] **Step 1:** Hooks with `onSnapshot`; page shell: header + left map (fills column) + right 380px panel placeholder. 
- [ ] **Step 2:** `MapCanvas` with `@googlemaps/js-api-loader`, `styles: darkMapStyle` (hand-tuned JSON: desaturated dark surfaces, hidden POIs, subtle roads/water), custom OverlayView markers positioned by lat/lng.
- [ ] **Step 3: Verify realtime end-to-end (the demo-critical path):** open dev server; in Firestore console set Seloo `status` to `healthy` → marker turns green without refresh, pulse animation fires; revert. Also verify with `preview_screenshot` that map looks designed, not default. 
- [ ] **Step 4: Commit** `feat: live district map with realtime facility markers`.

---

### Task 7: Facility panel (score, inventory, sparklines, forecast)

**Files:**
- Create: `components/facility/FacilityPanel.tsx`, `components/facility/ScoreRing.tsx`, `components/facility/InventoryTable.tsx`, `components/Sparkline.tsx` (pure inline SVG, ~25 lines, no chart lib), `hooks/useHistory.ts` (last 30 days for selected facility)

**Interfaces:**
- Consumes: `facilityForecast`, `computeRisk` (breakdown displayed), `useHistory(facilityId)`.
- Produces: `FacilityPanel({ facility })` — score ring with breakdown rows (medicine/staffing/beds/surge/tests with maxima), inventory table (stock, burn sparkline from history consumption, `daysLeft` countdown badge colored by severity), staff/beds/patients strip, tests row.

- [ ] **Step 1:** `Sparkline({ values, width, height })` — normalized polyline, stroke `--ink-3`, last point dot.
- [ ] **Step 2:** Panel composition; countdown badge text exactly `"{n} days left"` / `"Stock-out imminent"` when < 1.
- [ ] **Step 3:** Verify: select Seloo → paracetamol shows ~5 days left, red badge; breakdown sums equal total; screenshot check against DESIGN.md. Commit `feat: facility intelligence panel`.

---

### Task 8: Gemini client + insights (root-cause) route + rail

**Files:**
- Create: `lib/gemini.ts`, `app/api/ai/insights/route.ts`, `components/insights/InsightCard.tsx`, `components/insights/InsightsRail.tsx`

**Interfaces:**
- Produces: `lib/gemini.ts` exporting `genai` client + `generateStructured<T>(prompt: string, schema: object, parts?: Part[]): Promise<T>` (responseMimeType json + responseSchema, 20s timeout, 1 retry, throws `GeminiUnavailable`); insights route: `POST { facilityId }` → `{ rootCauses: [{ factor, evidence, severityContribution }], narrative, narrativeHindi }` — prompt embeds facility snapshot + last 14 history days + district median stats, instructs "cite only provided numbers". Response cached in `facilities/{id}.insightsCache` keyed by `lastUpdated`; rail shows top at-risk/critical facilities' narratives; on `GeminiUnavailable`, card falls back to deterministic facts (worst forecast lines + breakdown) — demo never blocks.

- [ ] **Step 1:** `lib/gemini.ts` (complete, incl. schema helper with `Type` from `@google/genai`).
- [ ] **Step 2:** Route + cache-read/write via `adminDb`.
- [ ] **Step 3:** Verify: `curl -X POST localhost:3000/api/ai/insights -d '{"facilityId":"seloo-phc"}'` → JSON cites 34% load rise and paracetamol days; wire rail into page for critical+at_risk facilities.
- [ ] **Step 4: Commit** `feat: gemini grounded root-cause insights`.

---

### Task 9: Recommendations + guardrail (TDD) + approve-transfer execution

**Files:**
- Create: `lib/engine/guardrail.ts`, `lib/engine/guardrail.test.ts`, `app/api/ai/recommend/route.ts`, `app/api/actions/approve-transfer/route.ts`, `components/insights/RecommendationCard.tsx`

**Interfaces:**
- Produces: `clampTransfer(qty, sourceItem, trend)` → qty clamped so qty ≤ 0.4×sourceStock AND source retains >14 days supply (returns 0 if impossible); recommend route: `POST { facilityId }` → server pre-filters donor facilities (same district, `daysToStockout > 21` for the needed medicine, sorted by haversine distance — include `haversineKm(a, b)` in guardrail.ts, tested) → Gemini structured output `{ transfers: [{ medicineId, qty, fromId, reasoning, expectedImpact, confidence }] }` → each clamped server-side → written to `recommendations` collection `status: "pending"`; approve route: `POST { recommendationId }` → `adminDb.runTransaction`: decrement source stock, increment target, recompute both facilities' scores via `computeRisk`, set recommendation `approved`, append `events` doc `transfer_approved`. Card UI: medicine, qty, from→to with distance, impact, confidence bar, Approve / Dismiss.

- [ ] **Step 1: TDD guardrail + haversine** (clamp cases: normal, 40% cap binds, 14-day floor binds, impossible→0; Wardha–Hinganghat ≈ 33 km ±3). FAIL → implement → PASS.
- [ ] **Step 2:** Recommend route; **Step 3:** approve route (transaction).
- [ ] **Step 4: Verify the loop:** generate recommendation for Seloo → card appears (realtime) → Approve → source and Seloo inventories change in panel, Seloo score rises, event in ticker, map marker pulses. This is demo beat 4 working. 
- [ ] **Step 5: Commit** `feat: ai transfer recommendations with guardrails and one-click execution`.

---

### Task 10: Copilot (function calling) + drawer + activity ticker

**Files:**
- Create: `app/api/ai/copilot/route.ts`, `lib/copilot-tools.ts`, `components/copilot/CopilotDrawer.tsx`, `components/ActivityTicker.tsx`

**Interfaces:**
- Produces: `copilot-tools.ts` — function declarations + executors for `getDistrictSummary()` (status counts, worst facilities, top stock-out risks district-wide), `getFacility(facilityId)` (snapshot + breakdown + forecasts), `getForecasts(daysThreshold)` (all meds under N days district-wide), `proposeTransfer(facilityId, medicineId)` (reuses Task 9 pipeline, returns created recommendation). Route: `POST { messages }` → Gemini with tools, loop: while `functionCalls` present execute + feed back (max 5 iterations) → final text. System prompt: answer only from tool results; reply in the user's language (Hindi in Devanagari if asked in Hindi); ≤120 words unless asked. Drawer UI: right-edge slide-over, message list, suggested chips ("Why is Seloo critical?", "district summary", "कौन सी दवाइयाँ खत्म होने वाली हैं?"). `ActivityTicker({ events })` renders `useEvents` feed in the command center footer.

- [ ] **Step 1:** Tools module (executors call same lib functions as UI — no duplicate logic). **Step 2:** Route with tool loop. **Step 3:** Drawer + ticker UI.
- [ ] **Step 4: Verify:** "Why is Seloo critical?" → grounded answer citing real numbers; Hindi question → Devanagari answer; "propose a transfer for seloo paracetamol" → recommendation card appears live. Commit `feat: district copilot with function calling`.

---

### Task 11: Field worker screen + voice pipeline

**Files:**
- Create: `app/field/page.tsx`, `components/field/UpdateButtons.tsx`, `components/field/VoiceUpdate.tsx`, `app/api/ai/voice/route.ts`, `app/api/actions/update-facility/route.ts`

**Interfaces:**
- Produces: update-facility route: `POST { facilityId, updates: [{ field: "stock"|"beds"|"doctors"|"test", medicineId?, testName?, value }], source: "manual"|"voice" }` → admin transaction applies updates, recomputes score, writes event (used by BOTH manual buttons and voice confirm). Voice route: `POST { audioBase64, mimeType, facilityId }` → Gemini multimodal (inlineData) with responseSchema `{ updates: [...same shape], confidence, transcript, echoHindi }` → returned to client (NO write). `VoiceUpdate`: hold-to-talk button (MediaRecorder, `audio/webm`), on release POST → confirmation card showing transcript + parsed updates in Hindi+English → "पुष्टि करें / Confirm" calls update-facility. Confidence < 0.7 → "फिर से बोलें" retry state.

- [ ] **Step 1:** Field page: facility picker (defaults Seloo), stat strip, four big update controls (stepper modals) wired to update-facility; mobile-width layout per DESIGN.md.
- [ ] **Step 2:** Voice route (prompt includes facility's medicine list so Gemini maps "ओआरएस"→`ors`; instruct: numbers in transcript must appear in updates verbatim).
- [ ] **Step 3:** VoiceUpdate component (getUserMedia, hold-to-record, blob→base64).
- [ ] **Step 4: Verify the wow moment end-to-end:** two windows (/, /field). Speak "आज ओआरएस का स्टॉक 50 बचा है" → confirm card shows ORS→50 → confirm → command center: Seloo inventory updates, score recomputes, marker pulses, ticker logs voice update. Record expected latencies. Commit `feat: field worker screen with hindi voice updates`.

---

### Task 12: Persona switcher, polish, deploy, README, demo assets

**Files:**
- Create: `components/PersonaSwitch.tsx` (DHO ↔ Field links), `README.md`, `docs/demo-script.md`; modify anything failing the polish pass.

- [ ] **Step 1: Polish pass against DESIGN.md** — empty/loading states (skeleton rows, not spinners), tabular numerals everywhere, focus states, map label collisions at zoom levels, mobile field screen on 390px viewport (preview_resize), remove all console errors.
- [ ] **Step 2: Rate-limit + demo-safety** — insights cached (already), copilot client-side throttle (1 req in flight), voice max 30s audio; verify graceful fallbacks by temporarily setting a bad `GEMINI_API_KEY`.
- [ ] **Step 3: Deploy** — Firebase App Hosting (`firebase init apphosting` + GitHub or `firebase deploy`); set env vars incl. service account; run seed against prod; full smoke test on public URL (map, panel, insight, recommend+approve, copilot EN+HI, voice from a phone). Fallback if blocked >90 min: Vercel + same Firestore.
- [ ] **Step 4: README** — problem, architecture diagram (mermaid), Google tech table (Gemini structured outputs / function calling / audio understanding / multilingual, Firestore, Maps, App Hosting), synthetic-data disclosure, run instructions. `docs/demo-script.md`: the 7 beats from spec §9 with exact lines to speak and exact clicks, timed to ≤3:00.
- [ ] **Step 5: Reseed with `--demo-date <recording day>`**, commit `feat: polish, deploy, demo assets`, tag `v1.0`.

---

## Self-review notes (done at write time)

- Spec coverage: §3 screens → Tasks 6–7, 10–11; §4 architecture → 1, 4, 8; §5 data → 4; §6 engines → 2–3; §7 Gemini (4 integrations + guardrail + failure handling) → 8–11; §8 design → 5 + 12; §9 demo → 12; §10 day plan ≈ Tasks 1–5 (D1), 6–7 (D2), 8–11 (D3), 12 (D4); §11 risks → key check (T1), MapCanvas isolation (T6), caching/fallbacks (T8, T12), `--demo-date` (T4).
- Register-photo OCR stretch: intentionally NOT a task; only if Task 11 finishes early — it reuses the voice route with image inlineData.
- Type consistency: `daysToStockout(item, trend)` used by risk (T2), forecast tests (T3), donor filter (T9); `update-facility` shared by manual + voice (T11); statuses/thresholds identical in T2 engine and T6 markers.
