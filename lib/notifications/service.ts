import type { Facility } from "@/lib/engine/types";
import { InAppNotificationChannel } from "./channels/in-app";
import { SmsNotificationChannel } from "./channels/sms";
import { WhatsAppNotificationChannel } from "./channels/whatsapp";
import type { NotificationRepository } from "./repository";
import { FirestoreNotificationRepository } from "./repository";
import type {
  ChannelDeliveryResult,
  NotificationChannel,
  NotificationChannelAdapter,
  NotificationPriority,
  OperationalNotificationStatus,
} from "./types";

export interface DispatchNotificationInput {
  facility: Facility;
  report: string;
  channels: NotificationChannel[];
  priority: NotificationPriority;
  createdBy: string;
}

export interface DispatchNotificationResult {
  notificationId: string;
  status: OperationalNotificationStatus;
  channels: Partial<Record<NotificationChannel, ChannelDeliveryResult>>;
}

type ContactFacility = Facility & Partial<Record<"whatsappNumber" | "fieldWorkerPhone" | "contactPhone" | "phone", string>>;

export function resolveWhatsAppRecipient(facility: Facility): string | undefined {
  const contact = facility as ContactFacility;
  return contact.whatsappNumber ?? contact.fieldWorkerPhone ?? contact.contactPhone ?? contact.phone ?? process.env.WHATSAPP_DEMO_RECIPIENT;
}

export class NotificationService {
  private readonly adapters: Map<NotificationChannel, NotificationChannelAdapter>;

  constructor(
    private readonly repository: NotificationRepository,
    adapters: NotificationChannelAdapter[],
  ) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.channel, adapter]));
  }

  async dispatch(input: DispatchNotificationInput): Promise<DispatchNotificationResult> {
    const notificationId = await this.repository.create({
      facilityId: input.facility.id,
      facilityName: input.facility.name,
      title: `HealthGrid operational alert — ${input.facility.name}`,
      report: input.report,
      priority: input.priority,
      channels: input.channels,
      createdBy: input.createdBy,
    });
    const results: Partial<Record<NotificationChannel, ChannelDeliveryResult>> = {};
    let status: OperationalNotificationStatus = "created";
    for (const channel of input.channels) {
      const adapter = this.adapters.get(channel);
      let result: ChannelDeliveryResult;
      if (!adapter) {
        result = { channel, state: "failed", errorCode: "adapter_unavailable", errorMessage: `${channel} adapter is unavailable` };
      } else {
        try {
          result = await adapter.send({
            notificationId,
            facilityId: input.facility.id,
            report: input.report,
            ...(channel === "whatsapp" ? { recipient: resolveWhatsAppRecipient(input.facility) } : {}),
          });
        } catch {
          result = { channel, state: "failed", errorCode: "dispatch_error", errorMessage: `${channel} delivery could not be completed` };
        }
      }
      results[channel] = result;
      status = await this.repository.updateChannelResult(notificationId, result);
    }
    return { notificationId, status, channels: results };
  }
}

export function createNotificationService(): NotificationService {
  return new NotificationService(new FirestoreNotificationRepository(), [
    new InAppNotificationChannel(),
    new WhatsAppNotificationChannel(),
    new SmsNotificationChannel(),
  ]);
}
