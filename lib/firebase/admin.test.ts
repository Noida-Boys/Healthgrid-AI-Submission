import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const firebaseMocks = vi.hoisted(() => ({
  applicationDefault: vi.fn(),
  cert: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  getFirestore: vi.fn(),
}));

vi.mock("firebase-admin/app", () => ({
  applicationDefault: firebaseMocks.applicationDefault,
  cert: firebaseMocks.cert,
  getApps: firebaseMocks.getApps,
  initializeApp: firebaseMocks.initializeApp,
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: firebaseMocks.getFirestore,
}));

const ENV_KEYS = [
  "FIREBASE_SERVICE_ACCOUNT_B64",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "FIREBASE_PROJECT_ID",
] as const;
const originalEnv = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const key of ENV_KEYS) delete process.env[key];

  firebaseMocks.getApps.mockReturnValue([]);
  firebaseMocks.applicationDefault.mockReturnValue({ kind: "adc" });
  firebaseMocks.cert.mockReturnValue({ kind: "cert" });
  firebaseMocks.initializeApp.mockImplementation((options) => ({ options }));
  firebaseMocks.getFirestore.mockReturnValue({ kind: "firestore" });
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("Firebase Admin credential resolution", () => {
  it("uses cert() when FIREBASE_SERVICE_ACCOUNT_B64 is present", async () => {
    const serviceAccount = {
      projectId: "healthgrid-22146",
      clientEmail: "local-test@example.invalid",
      privateKey: "not-a-real-key",
    };
    process.env.FIREBASE_SERVICE_ACCOUNT_B64 = Buffer.from(JSON.stringify(serviceAccount)).toString("base64");

    const { adminDb } = await import("./admin-core");
    expect(adminDb()).toEqual({ kind: "firestore" });
    expect(firebaseMocks.cert).toHaveBeenCalledWith(serviceAccount);
    expect(firebaseMocks.applicationDefault).not.toHaveBeenCalled();
    expect(firebaseMocks.initializeApp).toHaveBeenCalledWith({
      credential: { kind: "cert" },
      projectId: "healthgrid-22146",
    });
  });

  it("uses applicationDefault() when the Base64 override is absent", async () => {
    process.env.GOOGLE_CLOUD_PROJECT = "cloud-run-project";

    const { adminDb } = await import("./admin-core");
    adminDb();

    expect(firebaseMocks.applicationDefault).toHaveBeenCalledOnce();
    expect(firebaseMocks.cert).not.toHaveBeenCalled();
    expect(firebaseMocks.initializeApp).toHaveBeenCalledWith({
      credential: { kind: "adc" },
      projectId: "cloud-run-project",
    });
  });

  it("reuses an existing Admin app", async () => {
    const existing = { options: { projectId: "existing-project" } };
    firebaseMocks.getApps.mockReturnValue([existing]);

    const { adminDb, adminProjectId } = await import("./admin-core");
    adminDb();

    expect(firebaseMocks.initializeApp).not.toHaveBeenCalled();
    expect(firebaseMocks.applicationDefault).not.toHaveBeenCalled();
    expect(firebaseMocks.cert).not.toHaveBeenCalled();
    expect(firebaseMocks.getFirestore).toHaveBeenCalledWith(existing);
    expect(adminProjectId()).toBe("existing-project");
  });

  it.each([
    ["invalid Base64", "not@base64"],
    ["invalid JSON", Buffer.from("not json").toString("base64")],
  ])("reports a clear error for %s", async (_label, encoded) => {
    process.env.FIREBASE_SERVICE_ACCOUNT_B64 = encoded;
    const { adminDb } = await import("./admin-core");

    expect(() => adminDb()).toThrow(
      "FIREBASE_SERVICE_ACCOUNT_B64 is present but is not valid Base64-encoded service-account JSON.",
    );
    expect(firebaseMocks.initializeApp).not.toHaveBeenCalled();
  });

  it("uses the documented fallback project ID", async () => {
    const { adminDb } = await import("./admin-core");
    adminDb();

    expect(firebaseMocks.initializeApp).toHaveBeenCalledWith({
      credential: { kind: "adc" },
      projectId: "healthgrid-22146",
    });
  });
});
