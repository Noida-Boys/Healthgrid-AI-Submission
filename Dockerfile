# Cloud Run container for HealthGrid AI (Next.js standalone).
# Public NEXT_PUBLIC_* keys are baked at build time — they are client-side
# keys already shipped to every browser, so this is not a secret leak.
# GEMINI_API_KEY is injected as a Cloud Run runtime secret. Firebase Admin uses
# the attached Cloud Run service account through Application Default Credentials;
# FIREBASE_SERVICE_ACCOUNT_B64 remains an optional migration/local override.

FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyBhPGM0gCrDSrJFSd4DdRGUv9d-Eg2st8M
ENV NEXT_PUBLIC_FIREBASE_PROJECT_ID=healthgrid-22146
ENV NEXT_PUBLIC_FIREBASE_APP_ID=1:695183016887:web:f80ffb3026edbbad851e32
ENV NEXT_PUBLIC_MAPS_API_KEY=AIzaSyCty_KSGV2HG--ZYlKT_EZRKxw0wTpjMa0
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Cloud Run sends traffic to $PORT (default 8080); Next standalone honours it.
ENV PORT=8080
ENV HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 8080
CMD ["node", "server.js"]
