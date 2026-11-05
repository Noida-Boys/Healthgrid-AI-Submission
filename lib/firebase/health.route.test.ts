import { beforeEach, describe, expect, it, vi } from "vitest";

const healthMocks = vi.hoisted(() => ({
  adminDb: vi.fn(),
  adminProjectId: vi.fn(),
}));

vi.mock("@/lib/firebase/admin", () => healthMocks);

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("GET /api/health/firebase", () => {
  it("returns only readiness and the resolved project ID", async () => {
    const get = vi.fn().mockResolvedValue({ empty: false });
    healthMocks.adminDb.mockReturnValue({
      collection: vi.fn(() => ({ limit: vi.fn(() => ({ get })) })),
    });
    healthMocks.adminProjectId.mockReturnValue("healthgrid-22146");

    const { GET } = await import("@/app/api/health/firebase/route");
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, projectId: "healthgrid-22146" });
    expect(get).toHaveBeenCalledOnce();
  });

  it("returns a generic error without exposing credential details", async () => {
    healthMocks.adminDb.mockImplementation(() => {
      throw new Error("credential detail for server log only");
    });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const { GET } = await import("@/app/api/health/firebase/route");
    const response = await GET();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ ok: false, error: "Firebase Admin unavailable" });
    expect(errorLog).toHaveBeenCalledWith("Firebase Admin health check failed", {
      message: "credential detail for server log only",
    });
    errorLog.mockRestore();
  });
});
