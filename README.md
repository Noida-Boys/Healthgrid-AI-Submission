# HealthGrid AI

## 🏆 Winner of Google Cloud X Hack2Skill "Build with AI: Code for Communities"

**An AI command center for district public healthcare.** HMIS systems record what happened; HealthGrid decides what to do next — and a health worker speaking Hindi into a phone changes the district map in front of the District Health Officer's eyes.

Built for the Google **Build with AI — Code for Communities** hackathon · Smart Health track.

![District Command Center](docs/screenshots/01-command-center.png)

## The problem

India's ~25,000 PHCs and ~5,000 CHCs run on paper registers and monthly reports. Medicine stock-outs, doctor absences, and bed shortages are discovered **after** patients are turned away. The data that could prevent this — daily stock levels, attendance, footfall — is trapped at the facility and reaches the district weeks late, if at all.

## What HealthGrid does

One continuous loop: **Observe → Understand → Predict → Recommend → Approve → Execute → Monitor.**

| Capability | How it works |
|---|---|
| 🗺️ **Live district map** | Every facility scored 0–100 by a deterministic risk engine (medicines 40 · staffing 25 · beds 15 · surge 10 · diagnostics 10), rendered on dark-styled Google Maps with realtime Firestore listeners — no refresh, ever. |
| 📉 **Stock-out forecasting** | Weighted burn-rate model (7-day/30-day consumption, patient-trend amplified) computes days-to-stock-out per medicine per facility. |
| 🔎 **AI root-cause analysis** | Gemini explains *why* a facility is at risk, grounded strictly in the live snapshot — every claim cites a number from the data. |
| 🔁 **Guarded transfer recommendations** | Gemini proposes stock transfers from pre-filtered surplus donors; the server **clamps every quantity** (≤40% of donor stock, donor keeps >14 days supply) before anything is shown. One click executes the transfer as a Firestore transaction and both facilities re-score live. |
| 💬 **Health Copilot** | Gemini function-calling over four live-data tools (`getDistrictSummary`, `getFacility`, `getForecasts`, `listFacilities`). Ask in English or Hindi. It can never disagree with the screen, because it reads the same engines. |
| 🎙️ **Hindi voice updates** | A frontline worker holds a button and says *"आज ओआरएस का स्टॉक 50 बचा है"*. Gemini's audio understanding returns a structured update, the worker confirms on screen, the district re-scores, and the map reacts in seconds. |

![Facility intelligence panel](docs/screenshots/02-facility-panel.png)

## Measured impact

We replayed the district's 90 days of history and projected the next 30 days with and without HealthGrid's transfer policy (same deterministic engines, reproducible via `npx tsx scripts/impact-sim.ts`):

> **54 facility-medicine stock-out days across 5 facilities in the next 30 days — reduced to 0** by 31 guarded transfers redistributing 5,157 units of existing district stock. **Zero new medicine purchased.**

The simulation assumes replenishment continues on each facility's observed cadence; HealthGrid's only intervention is the same guarded transfer recommendation shown in the UI. In other words: the medicines to prevent every projected stock-out already exist inside the district — what's missing is the visibility and coordination layer.

## Fits the existing stack — a decision layer, not a replacement

India's public health system already records this data: **HMIS** captures facility reporting, and **DVDMS/eVIN** track drug inventory and logistics. What those systems don't do is *decide* — data flows up as monthly aggregates, and interventions flow back down weeks later. HealthGrid is designed as the **decision layer on top of that existing pipeline**:

- **Ingest:** facility state can be hydrated from HMIS/DVDMS exports (the Firestore schema mirrors their entities: facility → inventory → consumption); the voice/field interface fills the real-time gap between monthly reports rather than replacing them.
- **Act:** recommendations and approvals generate an audit trail (`events` collection) that maps directly onto the existing indent/transfer paperwork.
- **No rip-and-replace:** district administrators keep their systems of record; HealthGrid turns those records into same-day decisions.

## Why the AI is defensible

Every number on screen comes from **deterministic engines we wrote and unit-tested** (45 tests) — risk scoring, burn-rate forecasting, transfer guardrails. Gemini does what LLMs are actually good at: explanation, structured proposals, tool-calling, and multilingual audio understanding. AI proposals are validated and clamped server-side before display; nothing writes to the database without human confirmation.

## Architecture

```mermaid
flowchart LR
  subgraph Field["📱 Field worker (/field)"]
    V[Hindi voice / manual updates]
  end
  subgraph Server["Next.js API routes (server-only)"]
    G[Gemini: insights · recommendations · copilot · audio]
    E[Engines: risk · forecast · guardrails]
    A[Transactional writes<br/>firebase-admin]
  end
  subgraph Data["Cloud Firestore"]
    F[(facilities · history 90d ·<br/>recommendations · events)]
  end
  subgraph DHO["🖥️ Command center (/)"]
    M[Google Maps digital twin]
    P[Facility panel · AI rail · Copilot]
  end
  V -->|audio| G --> E
  E --> A --> F
  F -->|onSnapshot realtime| M & P
  P -->|approve| A
```

**Google technologies:** Gemini API (structured outputs, function calling, audio understanding, multilingual), Cloud Firestore (realtime sync), Google Maps Platform (district digital twin), Firebase (hosting & admin SDK), Next.js on Firebase App Hosting.

## Data methodology

Operational data (daily stock, attendance, footfall) does not exist publicly for Indian PHCs — that gap **is the problem HealthGrid solves**. The demo district is **synthetic but realistic**: real Wardha (Maharashtra) geography and facility types, 90 days of generated history with seasonality and noise, parameters calibrated to public figures from National Health Mission / Rural Health Statistics reporting (facility staffing norms, OPD footfall ranges, stock-out prevalence). The generator is deterministic and unit-tested (`lib/data/generate.ts`); all synthetic data is labeled as such.

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in Gemini, Firebase web config, and Maps keys
npm run check-keys           # verifies all three credentials
npm run seed                 # seeds the Wardha district into Firestore
npm run dev                  # http://localhost:3000 (DHO) · /field (worker)
```

Firebase Admin supports two local credential modes. Either set
`FIREBASE_SERVICE_ACCOUNT_B64` in `.env.local`, or leave it unset and configure
Application Default Credentials:

```bash
gcloud auth application-default login
gcloud config set project healthgrid-22146
```

Do not commit a service-account JSON file. In Cloud Run, leave the Base64
override unset after migration verification; Admin uses the service account
attached to the `healthgrid` service.

| Script | Purpose |
|---|---|
| `npm run seed -- --demo-date 2026-07-05` | Reseed with stock-outs timed relative to a date |
| `npm run check-keys` | Verify Gemini + Firestore + Maps credentials |
| `npm test` | 45 engine tests (risk, forecast, guardrails, generator) |
| `npx tsx --env-file=.env.local scripts/deploy-rules.ts` | Publish Firestore security rules |

## District situation report (PDF)

The command center header has a **District report ↓** button that downloads a full PDF situation report — district summary, an all-facility triage table sorted most-urgent first, and per-facility score breakdowns with medicine stock-out forecasts. It is generated server-side (`GET /api/report/district`) from the same deterministic engines that power the screen, so the report can never disagree with the map. Built with pdf-lib (pure JS, no runtime font files), so it works unchanged on Cloud Run.

## Operational Notification Center

HealthGrid now closes the operational loop: **Detect → Recommend → Notify → Acknowledge → Monitor**. Selecting a facility in the Command Centre generates a deterministic report from its live risk, forecast, inventory, and pending redistribution data. The administrator can edit it, send it in-app and optionally through WhatsApp, and watch read/acknowledgement state update in realtime. Field View has a facility-scoped inbox with deliberate read and explicit acknowledgement actions.

The server architecture is modular: `NotificationService` persists one document through `FirestoreNotificationRepository`, then dispatches through common in-app, WhatsApp, and disabled-SMS adapters. WhatsApp failure never rolls back the in-app notification.

### Firestore schema and API routes

Notifications are stored in `notifications/{notificationId}` with facility identity, title/report/priority, selected `channels`, per-channel `channelStatus`, aggregate `status`, read/acknowledgement fields, creator, and Firestore server timestamps. The Field inbox queries by `facilityId` and sorts client-side, so no composite index is required.

- `POST /api/actions/notify` — validates the edited report, reloads trusted facility data, creates one notification, and dispatches selected channels.
- `POST /api/actions/notifications/[notificationId]/read` — idempotently marks one notification read.
- `POST /api/actions/notifications/[notificationId]/acknowledge` — idempotently acknowledges and also sets read state.

Current Firestore rules intentionally retain the hackathon demo posture: public reads and no client writes. All notification mutations use Firebase Admin routes. Before production, add authentication and facility assignments so workers can read only their assigned facility.

### WhatsApp configuration

Set these server-only variables in `.env.local` or the deployment secret manager; never expose them with a `NEXT_PUBLIC_` prefix:

```bash
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_GRAPH_API_VERSION=v25.0
WHATSAPP_DEMO_RECIPIENT=919876543210
```

In Meta WhatsApp Cloud API test mode, add the worker number as an allowed test recipient, copy the temporary/system-user access token and phone number ID, then set the variables above. A trusted phone stored on the facility (`whatsappNumber`, `fieldWorkerPhone`, `contactPhone`, or `phone`) takes precedence over `WHATSAPP_DEMO_RECIPIENT`. The browser never sends a recipient number. Without credentials or a recipient, WhatsApp is recorded as failed while in-app delivery continues.

Run locally with the normal setup commands above. Deploy the rules and empty index manifest when Firebase configuration changes:

```bash
npx tsx --env-file=.env.local scripts/deploy-rules.ts
firebase deploy --only firestore:indexes
```

### Notification demo walkthrough

1. Open `/`, select Seloo PHC or another at-risk facility, and review/edit the generated report.
2. Keep In-App selected, optionally select WhatsApp, and send once.
3. Open `/field`, choose the same facility, and open the new notification to mark it read.
4. Select **Acknowledge** after completing the action.
5. Return to the selected facility in `/`; delivery, read, and acknowledgement update without a refresh.

## Team Noida Boys

Built by **Nishant Rajpathak** & **Saatvik Das**.
