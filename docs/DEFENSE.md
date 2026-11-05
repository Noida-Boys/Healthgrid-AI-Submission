# HealthGrid AI — Presentation Defense Pack

**Presentation: Thursday, July 16, 2026 · Track 03 Smart Health · 10 minutes (7 present + 3 Q&A) · ONE presenter (Saatvik) · Google Meet, join waiting room 5 min early.**

---

## 1. Know the hackathon (why this framing wins)

- **Organizer:** Google Cloud. "Build with AI — Code for Communities." Prize pool ₹10,00,000.
- **The tracks come from sitting Members of Parliament** — each track is a real gap an MP's office wants closed for constituents. Smart Health = "real-time AI orchestration for CHCs/PHCs: predictive medical stock distribution, patient volume spikes, bed allocations, staff attendance."
- **The real prize:** winning solutions get **piloted in an actual PHC / constituency / district**, and top teams present **in-person in New Delhi before MPs and industry leaders**.
- **What this means for judging:** the judges are not only scoring code. They are asking: *"Could this actually run in a district next quarter without embarrassing anyone?"* Every answer should sound like it was written for a District Health Officer, not a demo.
- Their stated mission: AI as "the actual engine that turns scattered, unstructured citizen input and fragmented public data into something an MP, a district health officer, or a farmer can act on **today**."
- Comparable Google hackathon rubric (from our research): **Technical execution ~40%, Innovation ~30%, Impact ~20%, Presentation ~10%** — and "simple chatbot wrappers" are mentally disqualified. Our whole architecture answers that.

**The one-line thesis to repeat:** *HMIS records what happened. HealthGrid decides what to do next.*

---

## 2. The project in plain language (the 60-second version)

India's ~25,000 PHCs run on paper registers. Stock levels, doctor attendance, and bed occupancy reach the district as monthly aggregates, ~30 days late — so stock-outs are discovered **after** patients are turned away. HealthGrid is a **decision layer** on top of the records districts already keep:

1. A **live command center**: every facility in Wardha district on a Google Map, scored 0–100 in real time by a deterministic risk engine.
2. **Stock-out forecasting** per medicine per facility (burn-rate math, not guesses).
3. **Gemini explains and proposes** — root causes grounded in the live numbers, and stock-transfer recommendations that the server **validates and clamps** before a human approves them with one click.
4. A **field worker speaks Hindi into a phone** — Gemini's audio understanding turns it into a structured update, the worker confirms, and the district map re-scores live in seconds.
5. The loop closes operationally: **notifications to the frontline (in-app + WhatsApp)** with read/acknowledge tracking, a **weather/disaster stress-test mode**, and a **one-click district PDF situation report** for the monthly review meeting.

Team: Nishant Rajpathak & Saatvik Das. Live on Google Cloud Run. Repo: github.com/nishantr14/healthgrid.

---

## 3. Every number you must know cold

### Risk engine (deterministic, ours, unit-tested)
- Score 0–100 = **Medicines 40 + Staffing 25 + Beds 15 + Surge 10 + Diagnostics 10**.
- Thresholds: **≥80 healthy · 60–79 at risk · <60 critical**.
- Medicine component: each essential medicine under **3 days** of supply costs full penalty (1.0), under **7 days** costs 0.6; half the essential list in critical supply zeroes the component.
- Beds: occupancy above **85%** starts penalizing. Surge: 7-day patient trend above **+10%** starts penalizing.

### Forecast engine
- Burn rate = **0.7 × 7-day avg + 0.3 × 30-day avg** consumption; amplified by patient trend when |trend| > 15%.
- Days-to-stock-out = current stock ÷ burn rate. Severity: **<3 days critical, <7 warning**.

### Transfer guardrails (server-side, applied to every AI proposal before display)
- A donor facility never gives more than **40% of its stock**.
- A donor must keep **>14 days of its own supply**.
- Approval is a **Firestore transaction** — both facilities re-score atomically; an audit event is written.

### Measured impact (reproducible: `npx tsx scripts/impact-sim.ts`)
- Replayed 90 days of history, projected 30 days with and without HealthGrid's transfer policy (same engines as the product):
- **54 facility-medicine stock-out days across 5 facilities → 0**, via **31 guarded transfers** redistributing **5,157 units** of existing district stock. **₹0 new medicine purchased.**
- Honest caveat (say it before they ask): it's a counterfactual **simulation on calibrated synthetic data** — the point is the method is deterministic and reproducible, and the medicines to prevent every projected stock-out already existed inside the district.

### Stress mode multipliers (WHO first-line response patterns)
- **Flood alert:** footfall ×1.35 · ORS ×1.8 · zinc ×1.7 · paracetamol ×1.4 · azithromycin ×1.5 · IV fluids ×1.5.
- **Heavy rain:** footfall ×1.15 · ORS ×1.4 · zinc ×1.35 · paracetamol ×1.25.
- **Heatwave:** footfall ×1.25 · ORS ×1.9 · IV fluids ×1.6.
- It is a **reversible client-side lens** — no data is ever mutated; switching back restores baseline byte-for-byte. Built to be replaced by live IMD weather feeds.

### Scale & engineering facts
- **15 facilities** (12 PHCs, 3 CHCs) in Wardha, Maharashtra — real geography, real block names. **12 essential medicines** tracked.
- **88 unit tests** across risk, forecast, guardrails, demand, interventions, incident lens, and the data generator.
- Next.js 16 + TypeScript, Cloud Firestore realtime listeners (no polling), Google Maps JS API custom dark style, Firebase Admin SDK server-side, deployed on **Cloud Run (asia-south1)**.
- **Gemini quota resilience:** a model pool rotates automatically when a model hits quota (5-minute cooldowns), plus Firestore-cached insights — the demo cannot stall on a 429.
- Gemini used for: structured outputs (insights, recommendations), **function calling** (copilot over 5 live-data tools), **audio understanding** (Hindi/Marathi/English voice), TTS. Every Gemini call is server-side; the key never ships to the browser.

### Notifications (Operational Notification Center)
- Command center generates a deterministic operational report from live risk/forecast/inventory; admin edits and sends via **in-app + WhatsApp Cloud API** (SMS stubbed "coming soon").
- One Firestore document per notification with per-channel delivery status; **read and acknowledge are idempotent server routes**; state streams back to the command center live.
- **WhatsApp failure never rolls back in-app delivery** — the frontline always gets the message.

### District PDF report
- One button → server-rendered A4 PDF: district summary, all 15 facilities triaged most-urgent first, per-facility score breakdown + full medicine forecast table. Generated by the **same engines as the screen, so the report can never disagree with the map**.

---

## 4. The hard questions — with model answers

Answer formula for the 3-minute Q&A: **direct answer in one sentence → one piece of evidence (a number) → stop talking.**

### Data

**"Your data is synthetic. Why should we believe any of this?"**
> Deliberately, and it's labeled as such — daily stock and attendance data for PHCs doesn't exist publicly, and **that gap is precisely the problem we're solving**. The generator is deterministic and unit-tested, calibrated to public NHM/Rural Health Statistics figures (staffing norms, OPD footfall ranges, stock-out prevalence), on real Wardha geography. The moment a district plugs in DVDMS/HMIS exports, the same engines run on real data — the Firestore schema mirrors their entities.

**"Who will actually enter the data? Health workers are overloaded."**
> That's why our field interface is voice-first in Hindi — a 10-second spoken sentence replaces a form. And we don't replace existing reporting: we ingest what DVDMS/HMIS already collect, and voice fills only the real-time gap between monthly reports.

**"How accurate is the forecasting?"**
> It's a weighted burn-rate model — the same class of math DVDMS uses for min-max indenting — but recomputed on every update instead of monthly, and trend-amplified during surges. It's deterministic and unit-tested; every number on screen can be recomputed by hand. ML forecasting is a roadmap upgrade once real longitudinal data flows.

### AI defensibility

**"Isn't this just a Gemini wrapper?"**
> No — every number on screen comes from deterministic engines we wrote and unit-tested (88 tests). Gemini never invents a number. It does four things LLMs are genuinely good at: grounded explanation, structured transfer proposals (which our server validates and clamps), function-calling in the copilot, and Hindi audio understanding. If Gemini went down mid-demo, the map, scores, forecasts, and transfers still work.

**"What if the AI hallucinates a transfer and a facility loses critical stock?"**
> It can't reach the database. Every proposal is validated server-side: a donor never gives more than 40% of stock and always keeps more than 14 days of supply — quantities are clamped before display. A human approves every action, the write is a Firestore transaction, and everything lands in an audit trail.

**"What about voice errors — dialects, noise, wrong quantities?"**
> Three gates: Gemini returns a structured update with a confidence score; below threshold the UI asks the worker to repeat; and **nothing writes without the worker visually confirming** the parsed values in their own language. The worker is the human in the loop, not the AI.

**"Which Gemini features do you actually use?"**
> Structured outputs with response schemas everywhere, function calling over five live-data tools in the copilot, native audio understanding for Hindi/Marathi/English voice, and TTS. Plus an engineering layer: automatic model rotation with cooldowns when a model hits quota.

### Positioning

**"How is this different from HMIS / DVDMS / eVIN / eSanjeevani?"**
> Those are systems of **record** — they capture data and move it upward as monthly aggregates. None of them **decides**. HealthGrid is the decision layer on top: it ingests the records districts already keep and answers "what should the DHO do *today*?" No rip-and-replace — the audit trail maps onto existing indent/transfer paperwork. (eSanjeevani is telemedicine — different problem entirely.)

**"Why would a district adopt this?"**
> Because it costs nothing to try and creates no new workflow: the pilot is 10–20 facilities, the data is what they already collect, and the first deliverable — the district PDF report — slots into the monthly District Health Society review they already run.

### Engineering

**"What happens with concurrent updates or approvals?"**
> All mutations are Firebase Admin **transactions** server-side. Two simultaneous approvals serialize; both facilities re-score atomically.

**"Security and privacy?"**
> There is **no patient PII anywhere** — only operational aggregates (stock counts, attendance numbers, bed occupancy). All writes go through server routes with the Admin SDK; the client can't write. Demo posture is public-read for judging; the production path is auth + facility assignments so a worker reads only their own facility — the rules are already structured for it.

**"Does it work offline / on poor connectivity?"**
> Honest answer: the field view is lightweight and works on any phone browser, but it needs connectivity today; voice requires it. That's why WhatsApp is a delivery channel (it survives flaky networks with store-and-forward), SMS is stubbed next, and an offline-first PWA is on the roadmap. We prioritized proving the full decision loop end-to-end first.

**"How does this scale to 800 districts?"**
> The stack is serverless end-to-end — Firestore and Cloud Run scale horizontally with no ops. One district is ~15 facility documents with realtime listeners; 800 districts is a partitioning problem, not a rearchitecture. Medicine lists and languages are configuration. The realistic path is district → state (36 districts in Maharashtra) → national.

**"What does it cost to run?"**
> Per district: Firestore reads/writes at this volume plus Gemini Flash-tier calls (cached insights, quota-rotated) land in the low thousands of rupees per month — against the cost of even one avoided emergency procurement or wasted expiring stock. It runs inside an existing NHM IT budget line.

### Impact & sustainability

**"Is the 54→0 number real?"**
> It's a simulation, and we present it as one — same deterministic engines and guardrails as the product, replayed over the district's 90-day history with a 30-day projection, reproducible with one command in the repo. The claim we stand behind: **the medicines to prevent every projected stock-out already existed inside the district** — what was missing was visibility and coordination.

**"What's your rollout plan if you win the pilot?"**
> Month 1: hydrate from the district's DVDMS/HMIS exports, configure the medicine list, onboard 10–20 facilities. Months 2–3: measure two numbers — stock-out days prevented and district response time from alert to action. Those two metrics decide scale-up. The system already deploys on Cloud Run and needs no new hardware at facilities.

**"What would you build next?"**
> Live IMD weather feeds into the stress engine, SMS/IVR for feature phones, offline PWA, auth with role-based facility assignment, and ML-based demand forecasting once real longitudinal data accumulates — in that order.

### Curveballs

**"How much of this did AI write?"**
> We built it AI-assisted — that's the point of a 'Build with AI' hackathon — but the architecture, the engine math, the guardrail policy, and every product decision are ours, and we can walk through any file. The 88 tests are the proof that we own the logic: they encode our intent, not a model's.

**"Why Wardha?"**
> Real district, real geography, right scale (~15 PHC/CHCs in reach of a pilot), in Maharashtra where the track's constituency context lives. Nothing is Wardha-specific — the district is a config.

**"Show me the code for X"** *(have these files ready in a tab)*
> Risk engine: `lib/engine/risk.ts` · Forecast: `lib/engine/forecast.ts` · Guardrails: `lib/engine/guardrail.ts` · Voice route: `app/api/ai/voice/route.ts` · Notification service: `lib/notifications/service.ts` · Impact sim: `scripts/impact-sim.ts`.

---

## 5. Weaknesses — own them before judges find them

| Weakness | How to handle |
|---|---|
| Synthetic data | Volunteer it early ("synthetic but calibrated, and here's why that's the honest choice"). Never let them discover it. |
| No auth in demo | "Demo posture — server-only writes are already enforced; auth + facility assignment is the first production task." |
| Needs connectivity | Acknowledge, point to WhatsApp channel + SMS stub + PWA roadmap. |
| Impact number is simulated | Say "simulated" yourself, every time. Credibility > headline. |
| Free-tier Gemini quota | If asked: model rotation + caching means the demo survives it; production uses paid tier. |
| Only 15 facilities | Right size for a pilot; scale is config + partitioning, not rearchitecture. |

---

## 6. Presentation tactics (7 min + 3 min, one presenter, online)

**Structure the 7 minutes (13-slide deck → skip fast through 2–3):**
1. **0:00–0:45** Title + problem (slides 1–2). Open cold with the map already loaded in a tab.
2. **0:45–1:15** The insight (slide 3): "HMIS records what happened. HealthGrid decides what to do next."
3. **1:15–4:30** **LIVE DEMO** (this is where you win): map → click Seloo PHC (critical) → score breakdown → recommended transfer → approve → both facilities re-score → flip to /field → Hindi voice update → map reacts → send a notification → show it land in the field inbox → click **District report ↓** and flash the PDF.
4. **4:30–5:30** Stress mode (slide 7 or live toggle) + defensible-AI slide (5): deterministic engines, 88 tests, guardrails.
5. **5:30–6:30** Impact (slide 10) + technology (slide 11) — name every Google API used.
6. **6:30–7:00** Pilot-ready close (slides 12–13): "One district today. 800 in India."

**Demo-risk insurance (do all of these):**
- Reseed the district the morning of: `npm run seed -- --demo-date 2026-07-16` so Seloo PHC is critical on cue.
- Pre-open every tab: `/`, `/field` (language already picked), the PDF, and the **demo videos** as fallback if live anything dies.
- Fresh WhatsApp token that morning (temp tokens die in 24h) — or a system-user token beforehand.
- Test screen-share of the actual Chrome window on Meet **the day before** (share the window, not the screen, so notifications don't leak).
- Practice the whole thing twice with a timer. 7 minutes is shorter than it feels.
- Q&A discipline: direct answer → one number → stop. Never ramble past the answer; it invites follow-ups you don't control.

---

## 7. Prompt for ChatGPT — Q&A trainer

Paste everything between the lines into ChatGPT (it is self-contained; ChatGPT needs no other context):

---

You are a panel of three skeptical hackathon judges for Google Cloud's "Build with AI — Code for Communities" hackathon, Smart Health track, in India. The track was set by a Member of Parliament's office; winning projects get piloted in a real district and presented in New Delhi. You are grilling me — a team member defending our project in a strict 3-minute Q&A after a 7-minute presentation.

Your three personas:
1. **The Google engineer** — probes technical depth: architecture, concurrency, failure modes, whether the AI is real or a wrapper, security, scale.
2. **The public-health official (ex-District Health Officer)** — probes ground reality: who enters data, worker burden, connectivity, trust in AI, fit with HMIS/DVDMS/eVIN, adoption, procurement.
3. **The impact investor** — probes the numbers: is the impact claim credible, cost to run, sustainability, rollout plan, why this over competitors.

THE PROJECT (all facts are real — test me against them):
HealthGrid AI — an AI command center for district public healthcare. Thesis: "HMIS records what happened; HealthGrid decides what to do next." India's ~25,000 PHCs run on paper; data reaches districts as monthly aggregates ~30 days late, so stock-outs are found after patients are turned away.

Product: (1) Live command center — 15 facilities (12 PHC, 3 CHC) of Wardha district, Maharashtra on a dark-styled Google Map, each scored 0–100 in realtime by a deterministic risk engine (weights: medicines 40, staffing 25, beds 15, surge 10, diagnostics 10; thresholds ≥80 healthy / 60–79 at risk / <60 critical), realtime via Firestore listeners, no refresh. (2) Stock-out forecasting per medicine: burn rate = 0.7×7-day + 0.3×30-day consumption, trend-amplified when patient trend >15%; <3 days = critical, <7 = warning. (3) Gemini root-cause insights grounded in live data (every claim cites a number). (4) Gemini-proposed stock transfers, server-validated and clamped (donor gives ≤40% of stock, keeps >14 days supply), human one-click approval, Firestore transaction, audit trail. (5) Copilot: Gemini function calling over 5 live-data tools, English/Hindi. (6) Voice: field worker speaks Hindi/Marathi/English ("आज ओआरएस का स्टॉक 50 बचा है"), Gemini audio understanding returns structured update + confidence, worker confirms on screen, district re-scores in seconds. (7) Weather/Disaster stress mode: reversible client-side lens (flood: ORS ×1.8, zinc ×1.7, footfall ×1.35; heatwave: ORS ×1.9, IV fluids ×1.6; heavy rain: ORS ×1.4, footfall ×1.15), WHO first-line response patterns, no data mutated, built to swap in live IMD feeds. (8) Operational Notification Center: command center sends auditable operational reports to facilities in-app + WhatsApp Cloud API (SMS stubbed); per-channel delivery status; field inbox with idempotent read/acknowledge streaming back live; WhatsApp failure never blocks in-app. (9) One-click district PDF situation report (server-rendered from the same engines — cannot disagree with the map): district summary, all facilities triaged most-urgent first, per-facility forecasts.

Engineering: Next.js 16 + TypeScript, Cloud Firestore realtime, Google Maps JS API, Firebase Admin SDK (server-only writes, transactions), Gemini API (structured outputs, function calling, audio understanding, TTS) with automatic model-pool rotation + cooldowns for quota resilience, deployed on Google Cloud Run (asia-south1). 88 unit tests over risk/forecast/guardrails/demand/incident/generator. No patient PII anywhere — operational aggregates only. Demo Firestore rules are public-read/server-write; production path is auth + facility assignments.

Data: synthetic but calibrated and labeled as such — real Wardha geography, 90 days of generated history with seasonality/noise, parameters calibrated to NHM/Rural Health Statistics norms. Rationale: daily PHC operational data does not exist publicly — that gap IS the problem; the Firestore schema mirrors HMIS/DVDMS entities so real exports hydrate the same engines.

Impact (simulated, reproducible via one script): replaying 90 days and projecting 30, HealthGrid's guarded transfers cut 54 projected facility-medicine stock-out days across 5 facilities to 0, using 31 transfers of 5,157 units of existing district stock, ₹0 new medicine purchased. Positioning: a decision layer on top of HMIS/DVDMS (systems of record that don't decide), not a replacement. Pilot plan: 10–20 facilities in one district, measure stock-out days prevented + response time; scale district → state (36 in Maharashtra) → national (800 districts); serverless stack scales by configuration.

Known weaknesses I must handle honestly: synthetic data; no auth in the demo; needs connectivity (voice especially); impact number is a simulation; free Gemini tier (mitigated by rotation/caching).

RULES OF THE DRILL:
- Ask me ONE question at a time, rotating personas. Start medium, get harder. Include at least: the synthetic-data attack, the "just a Gemini wrapper" attack, the "who enters the data" attack, the connectivity attack, the "is 54→0 real" attack, the HMIS/DVDMS differentiation, hallucinated-transfer safety, scale-to-800-districts, cost, and two curveballs I won't expect.
- After each of my answers, score it 1–10 and give brutal feedback: was it direct, did it lead with the answer, did it cite a number, did it stay under 30 seconds spoken, did it accidentally open a new attack surface?
- Then show a model answer in the format: one-sentence direct answer → one supporting number → stop.
- If I say something factually wrong about my own project (contradicting the facts above), call it out immediately — that's an automatic 2/10.
- Every 5 questions, give me a running scorecard and my top weakness.
- Stay in character. Be tough but fair. The Q&A is only 3 minutes long in reality, so train me to be FAST.

Begin by introducing the panel in one line each, then fire the first question.

---

*Good luck. You built something real — defend it like you know it, because you do.*
