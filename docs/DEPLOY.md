# Deploying HealthGrid AI to Google Cloud

Two supported paths. **Cloud Run (below)** is the plain Google Cloud experience and
uses the repo `Dockerfile` — the container bakes the public keys at build time, so
the map/Firestore work in the browser with no extra flags. **Firebase App Hosting**
(further down) is the git-push alternative.

Project: `healthgrid-22146` · Region: `asia-south1` (Mumbai, next to Firestore).

---

# Path A — Cloud Run (recommended, uses the Dockerfile)

The repo has a proven multi-stage `Dockerfile` (Next.js standalone, serves on
`$PORT`/8080). Because a Dockerfile is present, Cloud Run uses it for both the
console and CLI flows — the public `NEXT_PUBLIC_*` keys are baked in the build, so
there is **no build-env-var footgun**. Set the Gemini secret at runtime;
Firebase Admin uses the Cloud Run service account through Application Default Credentials (ADC).

## A1 — From the Google Cloud Console (no CLI install)

1. Merge the Dockerfile to `main`:
   https://github.com/nishantr14/healthgrid/compare/main...deploy?expand=1 → Merge.
2. Console → **Cloud Run** → **Deploy container** → **Service** →
   **Continuously deploy from a repository (source or function)** → **Set up with Cloud Build**.
3. **Repository:** authorize GitHub → `nishantr14/healthgrid`. **Branch:** `main`.
   **Build type:** `Dockerfile` (it auto-detects `/Dockerfile`). Save.
4. Service settings:
   - **Region:** `asia-south1`
   - **Authentication:** Allow unauthenticated invocations
   - **Container port:** `8080` (already set by the Dockerfile)
5. Expand **Containers → Variables & Secrets** and add these **runtime** vars:

   | Name | Value |
   |---|---|
   | `GEMINI_MODEL` | `gemini-3.5-flash` |
   | `GEMINI_FALLBACK_MODEL` | `gemini-3-flash-preview` |
   | `GEMINI_API_KEY` | *(from `.env.local`)* |
   | `FIREBASE_SERVICE_ACCOUNT_B64` | *(optional migration/local override)* |

   (For `GEMINI_API_KEY` / the service account you can instead click **Reference a
   secret** and store them in Secret Manager — cleaner, optional.)
6. **Create.** First build ~4–7 min; you get a URL like
   `https://healthgrid-xxxxx-el.a.run.app`.

Future deploys: push to `main` → Cloud Build rebuilds automatically.

## A2 — From the gcloud CLI (if you prefer terminal)

```powershell
# one-time: install gcloud, then
gcloud auth login
gcloud config set project healthgrid-22146
gcloud run deploy healthgrid --source . --region asia-south1 --allow-unauthenticated `
  --set-env-vars "GEMINI_MODEL=gemini-3.5-flash,GEMINI_FALLBACK_MODEL=gemini-3-flash-preview" `
  --set-env-vars "GEMINI_API_KEY=<key>"
```

With the Dockerfile present, `--source .` uses it; no build-env flags are needed.

## A3 — Grant the attached service account Firestore access

Do this before removing any existing `FIREBASE_SERVICE_ACCOUNT_B64` value:

```powershell
gcloud config set project healthgrid-22146

$serviceAccount = gcloud run services describe healthgrid `
  --region asia-south1 `
  --format="value(spec.template.spec.serviceAccountName)"

if (-not $serviceAccount) {
  $projectNumber = gcloud projects describe healthgrid-22146 `
    --format="value(projectNumber)"
  $serviceAccount = "$projectNumber-compute@developer.gserviceaccount.com"
}

$serviceAccount

gcloud projects add-iam-policy-binding healthgrid-22146 `
  --member="serviceAccount:$serviceAccount" `
  --role="roles/datastore.user"
```

`roles/datastore.user` grants Firestore data read/write access without broad
project administration. Do not use Owner or Editor. An empty configured service
account means Cloud Run is using the project's default compute service account,
which the fallback above resolves.

## Post-deploy (both Cloud Run flows)

1. **Restrict the Maps key to the live domain** or the map stays blank:
   Cloud console → APIs & Services → Credentials → Maps JS key →
   *Website restrictions* → add `https://*.run.app/*` → Save.
2. Smoke-test the URL: map, click Seloo, approve a transfer, Copilot (EN + Hindi),
   `/field` voice update, flip the Flood Alert scenario.
   Also call `GET /api/health/firebase`; it should return
   `{ "ok": true, "projectId": "healthgrid-22146" }`.
3. Reseed to demo-perfect state before recording/judging:
   ```powershell
   npm run seed -- --demo-date <day>
   npx tsx --env-file=.env.local scripts/seed-ai-state.ts
   ```

After all read/write flows and the health endpoint pass, inspect logs and only
then remove the legacy override:

```powershell
gcloud run services logs read healthgrid `
  --region asia-south1 `
  --limit 100

gcloud run services update healthgrid `
  --region asia-south1 `
  --remove-env-vars FIREBASE_SERVICE_ACCOUNT_B64
```

---

# Path B — Firebase App Hosting (git-push alternative)

App Hosting is Google Cloud's managed Next.js host: it builds from GitHub, runs on
Cloud Run, keeps secrets in Secret Manager. Config lives in
[`apphosting.yaml`](../apphosting.yaml). Run commands from `C:\bwa\healthgrid` in PowerShell.

## 0. Merge the config to `main` (once)

App Hosting deploys from `main`, so merge the config PR first:
https://github.com/nishantr14/healthgrid/compare/main...deploy?expand=1
→ **Create pull request** → **Merge**.

## 1. Install the Firebase CLI

```powershell
npm install -g firebase-tools
firebase --version   # expect 13.x+
```

## 2. Log in (opens your browser — the one interactive step)

```powershell
firebase login
firebase use healthgrid-22146
```

## 3. Store runtime secrets in Secret Manager

The public Firebase/Maps keys are already in `apphosting.yaml`. The Gemini key is
required. The Firebase Base64 value is only a temporary override during the ADC
migration; keep it until the App Hosting service account has equivalent IAM.

```powershell
# Gemini API key (short). When prompted, paste the GEMINI_API_KEY value.
firebase apphosting:secrets:set GEMINI_API_KEY

# Gnani speech key (required: field voice has no fallback without it).
firebase apphosting:secrets:set GNANI_API_KEY

# Optional migration override; remove only after ADC is verified:
$encodedCredential = Get-Content .env.local | Where-Object { $_ -like 'FIREBASE_SERVICE_ACCOUNT_B64=*' }
($encodedCredential -replace '^FIREBASE_SERVICE_ACCOUNT_B64=','') | Out-File -NoNewline -Encoding ascii $env:TEMP\sa.txt
firebase apphosting:secrets:set FIREBASE_SERVICE_ACCOUNT_B64 --data-file $env:TEMP\sa.txt
Remove-Item $env:TEMP\sa.txt
```

Each command asks whether to grant the App Hosting backend access — answer **yes**.

> Tip: production quota lives on whichever `GEMINI_API_KEY` you store here. If you
> have a billing-enabled key on `healthgrid-22146`, use that one — it removes the
> free-tier quota risk during judging. The app also rotates through a model pool.

## 4. Create the backend (connects GitHub, picks the region)

```powershell
firebase apphosting:backends:create --project healthgrid-22146
```

Answer the prompts:
- **Region:** `asia-south1` (Mumbai — next to Firestore)
- **GitHub repo:** authorize, then pick `nishantr14/healthgrid`
- **Live branch:** `main`
- **Root directory:** `/`
- **Backend id:** `healthgrid`

It kicks off the first build automatically (~5–10 min) and prints your public URL,
e.g. `https://healthgrid--healthgrid-22146.asia-south1.hosted.app`.

Future deploys: just push to `main` — App Hosting rebuilds on its own.

## 5. Post-deploy (5 minutes, important)

1. **Restrict the Maps key to the live domain** so the map renders in production:
   Cloud console → APIs & Services → Credentials → the Maps JS key →
   *Website restrictions* → add `https://*.hosted.app/*` (and your custom domain
   if any) → Save.
2. **Smoke test the public URL:** map renders, click Seloo, approve a transfer,
   ask the Copilot (English + Hindi), open `/field`, do a voice update, flip the
   Flood Alert scenario.
3. **Reseed to demo-perfect state** right before recording/judging:
   ```powershell
   npm run seed -- --demo-date <recording day>
   npx tsx --env-file=.env.local scripts/seed-ai-state.ts
   ```

## Fallback: Cloud Run source deploy

If the App Hosting GitHub connection gives trouble, Cloud Run works too — but you
MUST pass the public keys as **build** env vars or the browser bundle ships blank:

```powershell
gcloud run deploy healthgrid --source . --region asia-south1 --allow-unauthenticated `
  --set-build-env-vars NEXT_PUBLIC_FIREBASE_API_KEY=...,NEXT_PUBLIC_FIREBASE_PROJECT_ID=healthgrid-22146,NEXT_PUBLIC_FIREBASE_APP_ID=...,NEXT_PUBLIC_MAPS_API_KEY=... `
  --set-env-vars GEMINI_MODEL=gemini-3.5-flash,GEMINI_FALLBACK_MODEL=gemini-3-flash-preview,GEMINI_API_KEY=...
```

(Needs the gcloud CLI installed and `gcloud auth login`. App Hosting avoids the
build-env-var footgun, which is why it's the recommended path.)
