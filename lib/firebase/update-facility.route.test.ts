import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateDistrict } from "@/lib/data/generate";

const adminDbMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase/admin", () => ({ adminDb: adminDbMock }));

const originalCredential = process.env.FIREBASE_SERVICE_ACCOUNT_B64;

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.FIREBASE_SERVICE_ACCOUNT_B64;
});

afterEach(() => {
  if (originalCredential === undefined) delete process.env.FIREBASE_SERVICE_ACCOUNT_B64;
  else process.env.FIREBASE_SERVICE_ACCOUNT_B64 = originalCredential;
});

describe("POST /api/actions/update-facility", () => {
  it("attempts the Admin write without a Base64 credential override", async () => {
    const facility = structuredClone(generateDistrict("2026-07-04").facilities[0]);
    const transaction = {
      get: vi.fn().mockResolvedValue({ exists: true, data: () => facility }),
      set: vi.fn(),
      create: vi.fn(),
    };
    const db = {
      collection: vi.fn((name: string) => ({
        doc: vi.fn((id?: string) => ({ name, id })),
      })),
      runTransaction: vi.fn(async (callback: (tx: typeof transaction) => unknown) => callback(transaction)),
    };
    adminDbMock.mockReturnValue(db);

    const { POST } = await import("@/app/api/actions/update-facility/route");
    const response = await POST(
      new Request("http://localhost/api/actions/update-facility", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facilityId: facility.id,
          updates: [{ field: "beds", value: 1 }],
          source: "manual",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ ok: true });
    expect(adminDbMock).toHaveBeenCalledOnce();
    expect(transaction.set).toHaveBeenCalledOnce();
    expect(transaction.create).toHaveBeenCalled();
  });
});
