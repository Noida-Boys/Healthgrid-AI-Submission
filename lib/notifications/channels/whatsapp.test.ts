import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatsAppNotificationChannel } from "./whatsapp";

const input = { notificationId: "n1", facilityId: "f1", report: "Exact edited report", recipient: "+91 98765 43210" };

describe("WhatsAppNotificationChannel", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns normalized failures for missing configuration and recipient", async () => {
    await expect(new WhatsAppNotificationChannel({ token: "", phoneNumberId: "" }).send(input)).resolves.toMatchObject({ state: "failed", errorCode: "missing_token" });
    await expect(new WhatsAppNotificationChannel({ token: "secret", phoneNumberId: "phone" }).send({ ...input, recipient: undefined })).resolves.toMatchObject({ state: "failed", errorCode: "missing_recipient" });
  });

  it("returns the provider message id for an accepted message", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ messages: [{ id: "wamid.123" }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new WhatsAppNotificationChannel({ token: "secret", phoneNumberId: "phone" }).send(input);
    expect(result).toMatchObject({ state: "delivered", providerMessageId: "wamid.123" });
    expect(fetchMock.mock.calls[0][1].body).toContain("Exact edited report");
  });

  it("normalizes provider errors without returning the token", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 131000, message: "secret" } }), { status: 400 })));
    const result = await new WhatsAppNotificationChannel({ token: "top-secret-token", phoneNumberId: "phone" }).send(input);
    expect(result).toMatchObject({ state: "failed", errorCode: "provider_131000" });
    expect(result.errorMessage).toContain("secret");
    expect(JSON.stringify(result)).not.toContain("top-secret-token");
    expect(JSON.stringify(result)).not.toContain('"message":"secret"');
  });
});
