import type { ChannelDeliveryResult, NotificationChannel, NotificationTimestamp, OperationalNotification, OperationalNotificationStatus } from "./types";

export function deriveNotificationStatus(
  channels: NotificationChannel[],
  channelStatus: Partial<Record<NotificationChannel, ChannelDeliveryResult>>,
  state: Pick<OperationalNotification, "read" | "acknowledged"> = { read: false, acknowledged: false },
): OperationalNotificationStatus {
  if (state.acknowledged) return "acknowledged";
  if (state.read) return "read";
  const results = channels.map((channel) => channelStatus[channel]?.state ?? "pending");
  if (results.some((result) => result === "pending")) return "created";
  const delivered = results.filter((result) => result === "delivered").length;
  if (delivered === results.length) return "delivered";
  if (delivered > 0) return "partially_delivered";
  return "failed";
}

export function acknowledgeNotificationState(
  notification: OperationalNotification,
  acknowledgedBy: string,
  at: NotificationTimestamp,
): OperationalNotification {
  if (notification.acknowledged) return notification;
  return {
    ...notification,
    read: true,
    readAt: notification.readAt ?? at,
    acknowledged: true,
    acknowledgedAt: at,
    acknowledgedBy,
    status: "acknowledged",
    updatedAt: at,
  };
}
