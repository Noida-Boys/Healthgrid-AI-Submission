export type NotificationChannel = "in_app" | "whatsapp" | "sms";
export type DispatchState = "pending" | "delivered" | "failed" | "skipped";
export type NotificationPriority = "critical" | "high" | "medium" | "low";
export type OperationalNotificationStatus = "created" | "partially_delivered" | "delivered" | "read" | "acknowledged" | "failed";

export interface FirestoreTimestampLike {
  seconds: number;
  nanoseconds: number;
  toDate?: () => Date;
}

export type NotificationTimestamp = FirestoreTimestampLike | Date | string | number;

export interface ChannelDeliveryResult {
  channel: NotificationChannel;
  state: DispatchState;
  attemptedAt?: NotificationTimestamp;
  deliveredAt?: NotificationTimestamp;
  providerMessageId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface OperationalNotification {
  id: string;
  facilityId: string;
  facilityName: string;
  title: string;
  report: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  channelStatus: Partial<Record<NotificationChannel, ChannelDeliveryResult>>;
  status: OperationalNotificationStatus;
  read: boolean;
  readAt?: NotificationTimestamp;
  acknowledged: boolean;
  acknowledgedAt?: NotificationTimestamp;
  acknowledgedBy?: string;
  createdAt: NotificationTimestamp | null;
  createdBy: string;
  updatedAt: NotificationTimestamp | null;
}

export interface ChannelDispatchInput {
  notificationId: string;
  facilityId: string;
  report: string;
  recipient?: string;
}

export interface NotificationChannelAdapter {
  readonly channel: NotificationChannel;
  send(input: ChannelDispatchInput): Promise<ChannelDeliveryResult>;
}
