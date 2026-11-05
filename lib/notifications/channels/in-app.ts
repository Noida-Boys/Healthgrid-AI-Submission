import type { ChannelDeliveryResult, NotificationChannelAdapter } from "../types";

export class InAppNotificationChannel implements NotificationChannelAdapter {
  readonly channel = "in_app" as const;

  async send(): Promise<ChannelDeliveryResult> {
    return { channel: this.channel, state: "delivered" };
  }
}
