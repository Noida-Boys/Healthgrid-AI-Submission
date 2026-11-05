import { describe, expect, it } from "vitest";
import type { Facility } from "@/lib/engine/types";
import type { CreateNotificationInput, NotificationRepository } from "./repository";
import { NotificationService } from "./service";
import { deriveNotificationStatus } from "./status";
import type { ChannelDeliveryResult, NotificationChannel, OperationalNotification, OperationalNotificationStatus } from "./types";

class MemoryRepository implements NotificationRepository {
  created: CreateNotificationInput[] = [];
  results: Partial<Record<NotificationChannel, ChannelDeliveryResult>> = {};

  async create(input: CreateNotificationInput) {
    this.created.push(input);
    return "notification-1";
  }

  async updateChannelResult(_id: string, result: ChannelDeliveryResult): Promise<OperationalNotificationStatus> {
    this.results[result.channel] = result;
    return deriveNotificationStatus(this.created[0].channels, this.results);
  }

  async getById(): Promise<OperationalNotification | null> {
    return null;
  }

  async markRead() {
    return null;
  }

  async acknowledge() {
    return null;
  }
}

const facility: Facility = {
  id: "f1",
  name: "Seloo PHC",
  type: "PHC",
  lat: 0,
  lng: 0,
  block: "Seloo",
  staff: { doctorsSanctioned: 1, doctorsPresentToday: 1, attendanceRate7d: 1 },
  beds: { total: 1, occupied: 0 },
  patients: { todayCount: 1, avg7d: 1, trend7dPct: 0 },
  tests: {},
  inventory: {},
  healthScore: 40,
  status: "critical",
  lastUpdated: 1,
  lastUpdateSource: "seed",
};

describe("NotificationService", () => {
  it("persists once and returns partial success when WhatsApp fails", async () => {
    const repository = new MemoryRepository();
    const service = new NotificationService(repository, [
      { channel: "in_app", send: async () => ({ channel: "in_app", state: "delivered" }) },
      { channel: "whatsapp", send: async () => ({ channel: "whatsapp", state: "failed", errorMessage: "Not configured" }) },
    ]);
    const result = await service.dispatch({
      facility,
      report: "Edited report",
      channels: ["in_app", "whatsapp"],
      priority: "critical",
      createdBy: "district-admin-demo",
    });
    expect(repository.created).toHaveLength(1);
    expect(repository.created[0]).toMatchObject({ facilityId: "f1", report: "Edited report" });
    expect(result.status).toBe("partially_delivered");
    expect(result.channels.whatsapp).toMatchObject({ state: "failed" });
    expect(JSON.stringify(result)).not.toContain("token");
  });
});
