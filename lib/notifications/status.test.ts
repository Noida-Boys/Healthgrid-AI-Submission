import { describe, expect, it } from "vitest";
import { acknowledgeNotificationState, deriveNotificationStatus } from "./status";
import type { OperationalNotification } from "./types";

describe("deriveNotificationStatus", () => {
  it("derives delivery combinations and acknowledgement precedence", () => {
    expect(deriveNotificationStatus(["in_app"], { in_app: { channel: "in_app", state: "delivered" } })).toBe("delivered");
    expect(
      deriveNotificationStatus(
        ["in_app", "whatsapp"],
        { in_app: { channel: "in_app", state: "delivered" }, whatsapp: { channel: "whatsapp", state: "failed" } },
      ),
    ).toBe("partially_delivered");
    expect(deriveNotificationStatus(["whatsapp"], { whatsapp: { channel: "whatsapp", state: "failed" } })).toBe("failed");
    expect(deriveNotificationStatus(["whatsapp"], {}, { read: true, acknowledged: true })).toBe("acknowledged");
  });
});

describe("acknowledgeNotificationState", () => {
  const notification: OperationalNotification = {
    id: "n1",
    facilityId: "f1",
    facilityName: "Facility",
    title: "Alert",
    report: "Report",
    priority: "high",
    channels: ["in_app"],
    channelStatus: { in_app: { channel: "in_app", state: "delivered" } },
    status: "delivered",
    read: false,
    acknowledged: false,
    createdAt: 1,
    createdBy: "admin",
    updatedAt: 1,
  };

  it("sets read state, is idempotent, and preserves immutable fields", () => {
    const first = acknowledgeNotificationState(notification, "worker", 2);
    const repeated = acknowledgeNotificationState(first, "other-worker", 3);
    expect(first).toMatchObject({ read: true, acknowledged: true, acknowledgedBy: "worker", status: "acknowledged" });
    expect(repeated).toBe(first);
    expect(first.report).toBe(notification.report);
    expect(first.facilityId).toBe(notification.facilityId);
    expect(first.channelStatus).toEqual(notification.channelStatus);
  });
});
