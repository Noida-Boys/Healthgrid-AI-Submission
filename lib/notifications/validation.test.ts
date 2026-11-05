import { describe, expect, it } from "vitest";
import { MAX_NOTIFICATION_REPORT_LENGTH, validateNotifyRequest } from "./validation";

describe("validateNotifyRequest", () => {
  it.each([
    [{ report: "Alert", channels: ["in_app"] }, "facilityId"],
    [{ facilityId: "f1", report: "   ", channels: ["in_app"] }, "report"],
    [{ facilityId: "f1", report: "Alert", channels: [] }, "channel"],
    [{ facilityId: "f1", report: "Alert", channels: ["email"] }, "unsupported"],
  ])("rejects invalid input", (payload, message) => {
    const result = validateNotifyRequest(payload);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it("enforces the maximum report length", () => {
    expect(validateNotifyRequest({ facilityId: "f1", report: "x".repeat(MAX_NOTIFICATION_REPORT_LENGTH + 1), channels: ["in_app"] }).ok).toBe(false);
  });

  it("preserves the administrator-edited report exactly", () => {
    const result = validateNotifyRequest({ facilityId: "f1", report: "  Edited report\n", channels: ["in_app"] });
    expect(result.ok && result.value.report).toBe("  Edited report\n");
  });
});
