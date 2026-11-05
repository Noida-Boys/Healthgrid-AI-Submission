# HealthGrid AI — Design Spec (Hackathon Build)

**Event:** Google "Build with AI — Code for Communities" · Challenge: Smart Health — AI-Driven Health Center & Supply Chain Management
**Deadline:** ~2026-07-05 (2–4 days from 2026-07-02)
**Date:** 2026-07-02
**Status:** Approved by user (with Google Maps amendment)

## 1. One-sentence product

HMIS systems record what happened; **HealthGrid AI decides what to do next** — a district health command center where a frontline worker speaking Hindi into a phone visibly changes the district map in front of the District Health Officer's eyes.

## 2. Strategy: how this wins

Judging in comparable Google hackathons: **Technical Execution ~40%, Innovation ~30%, Impact ~20%, Presentation ~10%**. Judged via ≤3-min demo video + public working URL. Google explicitly disqualifies "simple chatbot" projects mentally.

Therefore:
- **One loop, deep** — not four workspaces. Everything shown works end-to-end against live data. No mockups, no dead buttons on the demo path.
- **Defensible AI** — predictions come from deterministic math we compute (burn-rate forecasting, risk scoring). Gemini does what LLMs are genuinely good at: grounded explanation, structured recommendations, function-calling, multimodal Hindi audio. Every number on screen is traceable.
- **The wow moment** — Hindi voice update → structured write → risk recompute → district map flips color in realtime. This is the demo video's climax.
- **Google surface area** — Gemini (structured outputs, function calling, audio understanding, multilingual), Firestore realtime, Firebase App Hosting, Google Maps Platform.

## 3. Scope

### Build (2 screens)

**Screen 1 — District Command Center** (desktop, the DHO persona):
- **Google Maps JS API, custom dark style**, real district geography (Wardha, Maharashtra). ~15 facility nodes (PHCs/CHCs) as custom overlay markers, color-coded 🟢/🟡/🔴 by computed health score. Markers glow/pulse on state change.
- **Facility panel** (on marker click): health score breakdown, medicine inventory with burn-rate sparklines and **stock-out countdown** ("Paracetamol: 5 days left"), doctor attendance, bed occupancy, patient-load trend, test availability.
- **AI Insights rail**: Gemini-generated root-cause explanation for at-risk facilities, grounded in the live data snapshot; **transfer recommendations as structured cards** (medicine, qty, source facility, distance, expected impact, confidence) with an **Approve** button that executes the transfer in Firestore — both facilities recompute live.
- **Copilot drawer**: Gemini with function calling over live data. Tools: `getDistrictSummary`, `getFacility`, `getForecasts`, `proposeTransfer`. Answers in the language asked (English/Hindi).
- **District pulse header**: facilities by status, patients served today, active alerts, pending recommendations.

**Screen 2 — Field Worker** (mobile-width, `/field`):
- Facility picker (demo: preset to one PHC), big-button updates for Medicine / Beds / Doctors / Tests.
- **Hero: hold-to-talk voice update.** Mic capture → audio to Gemini multimodal → structured JSON `InventoryUpdate` → confirmation card in Hindi + English → on confirm, Firestore write → risk engine recomputes → command center map updates via realtime listener.
- **Stretch (only if Days 1–2 on schedule):** photograph a paper stock register → Gemini vision → structured entries → same confirm-and-write pipeline.

### Cut (deliberately)
Auth/roles (persona switcher instead), MP-office viewer, notifications/SMS, BigQuery, Gemma, offline PWA, admin CRUD for facilities, real HMIS integration. These cost days and win no demo points.

## 4. Architecture

```
Next.js (App Router, TypeScript, Tailwind)
├─ / ................. District Command Center
├─ /field ............ Field worker screen
├─ /api/ai/insights .. Gemini: root-cause + recommendations (structured output)
├─ /api/ai/copilot ... Gemini: chat with function calling
├─ /api/ai/voice ..... Gemini: audio → structured InventoryUpdate
├─ /api/actions/approve-transfer ... executes transfer, writes both facilities
└─ lib/
   ├─ engine/risk.ts ....... health score (deterministic)
   ├─ engine/forecast.ts ... burn rate + stock-out days (deterministic)
   ├─ gemini.ts ............ client, schemas, tool definitions
   └─ firestore.ts ......... typed accessors

Firestore (realtime listeners on client)      Gemini API (server-side only)
Firebase App Hosting (deploy; Vercel = emergency fallback)
Google Maps JS API (client, custom style)
```

- All Gemini calls happen server-side (API key never shipped to client).
- Client subscribes to Firestore `facilities` + `recommendations` → map and panels update live without refresh. This realtime path IS the demo moment; nothing may poll.
- Model: latest Gemini Flash-tier model available to the key at build time (check `models.list` on Day 1; prefer the Gemini 3 family; pin one model ID in config).

## 5. Data model (Firestore)

```
facilities/{id}
  name, type: PHC|CHC, lat, lng, block
  staff: { doctorsSanctioned, doctorsPresentToday, attendanceRate7d }
  beds: { total, occupied }
  patients: { todayCount, avg7d, trend7dPct }
  tests: { name -> available: boolean }
  inventory: { medicineId -> { name, unit, currentStock, avgDailyConsumption7d,
               reorderLevel, daysToStockout (computed) } }
  healthScore: number (0-100, computed)
  status: healthy|at_risk|critical (computed)
  lastUpdated, lastUpdateSource: seed|manual|voice|transfer

history/{facilityId}/days/{yyyy-mm-dd}     // 90 days seeded
  patientCount, doctorsPresent, bedsOccupied,
  consumption: { medicineId -> qty }, stockLevels: { medicineId -> qty }

recommendations/{id}
  type: transfer, medicineId, qty, fromFacilityId, toFacilityId,
  reasoning, expectedImpact, confidence, status: pending|approved|dismissed,
  createdBy: ai, approvedAt

events/{id}   // audit trail, also feeds "live activity" ticker
  type: voice_update|manual_update|transfer_approved|status_change
  facilityId, payload, timestamp
```

**Seed data:** script (`scripts/seed.ts`) generates Wardha district — ~15 facilities with real-ish coordinates along actual towns (Wardha, Hinganghat, Arvi, Seloo, Deoli, Samudrapur, Karanja, Ashti + villages), ~12 essential medicines (Paracetamol, ORS, Amoxicillin, Iron-Folic Acid, Metformin, Amlodipine, Azithromycin, Zinc, Cetirizine, Ranitidine, IV fluids), 90 days of history with seasonality + noise, engineered so that **on demo day exactly: ~10 green, ~3 amber, 2 red**, and one red facility — **Seloo PHC**, the demo protagonist — has a paracetamol stock-out in ~5 days with rising patient load — matching the demo script. Synthetic data is labeled as such in README (ethics).

## 6. Engines (deterministic, ours)

**Forecast (`forecast.ts`):** per medicine, weighted burn rate (7d avg weighted 70%, 30d avg 30%), `daysToStockout = currentStock / burnRate`, plus trend adjustment if patient load trend > ±15%. Output per facility: list of `{medicine, daysLeft, severity}`.

**Risk score (`risk.ts`):** 0–100 composite —
- Medicine availability 40%: penalty scaled by essential medicines under 7/3 days-of-supply
- Staffing 25%: doctor attendance rate vs sanctioned
- Bed pressure 15%: occupancy > 85% penalized
- Patient-load surge 10%: 7d trend vs baseline
- Test availability 10%: share of core tests down
Thresholds: ≥80 healthy, 60–79 at_risk, <60 critical. Medicine penalty per essential item: <3 days 1.0, <7 days 0.6, normalized so half the essential list in critical supply zeroes the component (calibrated during implementation so realistic collapse patterns actually reach `critical`). Recomputed server-side after every write (update APIs call `recompute(facilityId)`).

## 7. Gemini integration points (all structured)

1. **Insights** (`/api/ai/insights`): input = facility snapshot + 14d history + district context; output schema = `{ rootCauses: [{factor, evidence, severityContribution}], narrative, narrativeHindi }`. Cached per facility until data changes.
2. **Recommendations**: input = at-risk facility + surplus candidates within district (we pre-filter by stock surplus + distance); output schema = `{ transfers: [{medicineId, qty, fromId, reasoning, expectedImpact, confidence}] }`. Guardrail: server validates qty ≤ 40% of source stock and source stays >14 days-of-supply, else clamps.
3. **Copilot** (`/api/ai/copilot`): chat endpoint, Gemini function calling with the 4 read/propose tools; responses grounded in tool results only; multilingual.
4. **Voice** (`/api/ai/voice`): audio blob (webm/opus from MediaRecorder) sent inline to Gemini multimodal; output schema = `{ facilityRef?, updates: [{field, medicineId?, value}], confidence, transcript, echoHindi }`. Below confidence 0.7 → UI asks user to repeat. User always confirms before write.

Failure handling: every Gemini route has timeout + one retry + graceful UI fallback (insights rail shows deterministic facts if LLM fails; demo never hard-blocks on an API hiccup).

## 8. Design language ("must not look AI-built")

Command-center aesthetic via ui-ux-pro skill, locked in a `DESIGN.md` before UI work:
- Dark cartographic base; restrained palette — deep neutral surfaces, ONE accent, semantic red/amber/green reserved exclusively for facility status.
- Dense, data-first layout; tabular numerals for metrics; real typographic hierarchy; Devanagari-capable font pairing (e.g., IBM Plex Sans + Noto Sans Devanagari).
- No purple gradients, no glassmorphism cards floating on blobs, no emoji-as-UI, no centered-hero marketing layouts, no default shadcn look.
- Motion: only meaningful state-change animation (marker pulse on update, count-up on score change). Feels like Bloomberg Terminal × ISRO control room.

## 9. Demo script (3-min video, 7 beats — matches original PRD narrative)

1. Cold open: district map, one facility glowing red. "37,000 patients depend on this district's 15 health centres…"
2. Click red facility → score breakdown + AI root-cause explanation.
3. Forecast: "Paracetamol: stock-out in 5 days" with sparkline.
4. AI recommendation card: transfer 400 ORS from surplus PHC 22 km away → **Approve** → both facilities update live.
5. Copilot: "Why is Seloo critical?" (typed) → grounded answer; one Hindi question.
6. Cut to phone: health worker holds mic, says "आज ORS का स्टॉक 50 बचा है" → confirmation card.
7. Cut back to command center: map node flips, activity ticker logs the voice update, score recomputes. Close: the loop diagram + "HealthGrid: from data to decisions."

## 10. Build plan (4 days)

- **Day 1:** repo scaffold, Firestore + Maps keys verified (USER: enable Maps JS API billing tonight), data model, seed script, risk+forecast engines with unit tests, map shell rendering seeded facilities.
- **Day 2:** Command center UI complete on real data (panel, sparklines, pulse header, activity ticker), realtime listeners proven (edit Firestore console → map flips).
- **Day 3:** All 4 Gemini routes + approve-transfer action + field screen + voice pipeline end-to-end.
- **Day 4:** Polish pass, deploy to Firebase App Hosting, seed production, record demo video, README with architecture diagram + synthetic-data disclosure, submission.

Slack in plan: register-photo OCR stretch goal only slots into Day 4 morning if Day 3 finishes clean.

## 11. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Maps billing not enabled / key fails | `MapCanvas` component interface; fallback renderer (MapLibre + free dark tiles) swappable in ~1h. Verify key Day 1. |
| Gemini Hindi audio accuracy | Confirm-before-write UI; transcript shown; retry prompt under 0.7 confidence; demo audio rehearsed. |
| Free-tier rate limits during judging | Insights cached; copilot rate-limited client-side; static fallback text. |
| Firebase App Hosting deploy friction | Vercel fallback (15 min), Firestore stays regardless. |
| Demo-day data drift (days pass, stock-outs "happen") | Seed script parameterized by `--demo-date`; reseed morning of recording/judging. |
