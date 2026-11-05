import type { ChannelDeliveryResult, NotificationChannelAdapter } from "../types";

export class SmsNotificationChannel implements NotificationChannelAdapter {
  readonly channel = "sms" as const;

  async send(): Promise<ChannelDeliveryResult> {
    return {
      channel: this.channel,
      state: "skipped",
      errorCode: "not_configured",
      errorMessage: "SMS channel is not configured",
    };
  }
}
