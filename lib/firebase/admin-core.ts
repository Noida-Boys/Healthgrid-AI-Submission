import {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
  type App,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

const DEFAULT_PROJECT_ID = "healthgrid-22146";
const INVALID_SERVICE_ACCOUNT_MESSAGE =
  "FIREBASE_SERVICE_ACCOUNT_B64 is present but is not valid Base64-encoded service-account JSON.";

let app: App | null = null;
let db: Firestore | null = null;

function resolveProjectId(): string {
  return (
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    process.env.FIREBASE_PROJECT_ID ||
    DEFAULT_PROJECT_ID
  );
}

function decodeServiceAccount(encoded: string): ServiceAccount {
  try {
    const compact = encoded.replace(/\s/g, "");
    if (!compact || compact.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(compact)) {
      throw new Error(INVALID_SERVICE_ACCOUNT_MESSAGE);
    }

    const decoded = Buffer.from(compact, "base64");
    const supplied = compact.replace(/=+$/, "");
    const canonical = decoded.toString("base64").replace(/=+$/, "");
    if (supplied !== canonical) {
      throw new Error(INVALID_SERVICE_ACCOUNT_MESSAGE);
    }

    const parsed: unknown = JSON.parse(decoded.toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(INVALID_SERVICE_ACCOUNT_MESSAGE);
    }
    return parsed as ServiceAccount;
  } catch {
    throw new Error(INVALID_SERVICE_ACCOUNT_MESSAGE);
  }
}

function createAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const projectId = resolveProjectId();
  const encoded = process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  const credential = encoded ? cert(decodeServiceAccount(encoded)) : applicationDefault();

  return initializeApp({ credential, projectId });
}

function adminApp(): App {
  app ??= createAdminApp();
  return app;
}

/** Lazily initializes Firestore so imports and production builds never resolve credentials. */
export function adminDb(): Firestore {
  db ??= getFirestore(adminApp());
  return db;
}

export function adminProjectId(): string {
  return adminApp().options.projectId ?? resolveProjectId();
}
