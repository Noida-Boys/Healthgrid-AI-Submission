import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { deriveNotificationStatus } from "./status";
import type {
  ChannelDeliveryResult,
  NotificationChannel,
  NotificationPriority,
  OperationalNotification,
  OperationalNotificationStatus,
} from "./types";

export interface CreateNotificationInput {
  facilityId: string;
  facilityName: string;
  title: string;
  report: string;
  priority: NotificationPriority;
  channels: NotificationChannel[];
  createdBy: string;
}

export interface NotificationActionState {
  id: string;
  status: OperationalNotificationStatus;
  read: boolean;
  acknowledged: boolean;
}

export interface NotificationRepository {
  create(input: CreateNotificationInput): Promise<string>;
  updateChannelResult(id: string, result: ChannelDeliveryResult): Promise<OperationalNotificationStatus>;
  getById(id: string): Promise<OperationalNotification | null>;
  markRead(id: string): Promise<NotificationActionState | null>;
  acknowledge(id: string, acknowledgedBy: string): Promise<NotificationActionState | null>;
}

function initialChannelStatus(channels: NotificationChannel[]): Partial<Record<NotificationChannel, ChannelDeliveryResult>> {
  return Object.fromEntries(channels.map((channel) => [channel, { channel, state: "pending" }])) as Partial<
    Record<NotificationChannel, ChannelDeliveryResult>
  >;
}

function sanitizedResult(result: ChannelDeliveryResult): Record<string, unknown> {
  return {
    channel: result.channel,
    state: result.state,
    attemptedAt: FieldValue.serverTimestamp(),
    ...(result.state === "delivered" ? { deliveredAt: FieldValue.serverTimestamp() } : {}),
    ...(result.providerMessageId ? { providerMessageId: result.providerMessageId.slice(0, 300) } : {}),
    ...(result.errorCode ? { errorCode: result.errorCode.slice(0, 100) } : {}),
    ...(result.errorMessage ? { errorMessage: result.errorMessage.slice(0, 300) } : {}),
  };
}

function actionState(notification: OperationalNotification): NotificationActionState {
  return {
    id: notification.id,
    status: notification.status,
    read: notification.read,
    acknowledged: notification.acknowledged,
  };
}

export class FirestoreNotificationRepository implements NotificationRepository {
  async create(input: CreateNotificationInput): Promise<string> {
    const db = adminDb();
    const ref = db.collection("notifications").doc();
    await ref.create({
      id: ref.id,
      ...input,
      channelStatus: initialChannelStatus(input.channels),
      status: "created",
      read: false,
      acknowledged: false,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    return ref.id;
  }

  async updateChannelResult(id: string, result: ChannelDeliveryResult): Promise<OperationalNotificationStatus> {
    const db = adminDb();
    return db.runTransaction(async (transaction) => {
      const ref = db.collection("notifications").doc(id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("notification not found");
      const current = snapshot.data() as OperationalNotification;
      const channelStatus = { ...current.channelStatus, [result.channel]: result };
      const status = deriveNotificationStatus(current.channels, channelStatus, current);
      transaction.update(ref, {
        [`channelStatus.${result.channel}`]: sanitizedResult(result),
        status,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return status;
    });
  }

  async getById(id: string): Promise<OperationalNotification | null> {
    const snapshot = await adminDb().collection("notifications").doc(id).get();
    return snapshot.exists ? ({ ...snapshot.data(), id: snapshot.id } as OperationalNotification) : null;
  }

  async markRead(id: string): Promise<NotificationActionState | null> {
    const db = adminDb();
    return db.runTransaction(async (transaction) => {
      const ref = db.collection("notifications").doc(id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return null;
      const current = { ...snapshot.data(), id: snapshot.id } as OperationalNotification;
      if (current.read) return actionState(current);
      const status = current.acknowledged ? "acknowledged" : "read";
      transaction.update(ref, {
        read: true,
        readAt: FieldValue.serverTimestamp(),
        status,
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { id, status, read: true, acknowledged: current.acknowledged };
    });
  }

  async acknowledge(id: string, acknowledgedBy: string): Promise<NotificationActionState | null> {
    const db = adminDb();
    return db.runTransaction(async (transaction) => {
      const ref = db.collection("notifications").doc(id);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) return null;
      const current = { ...snapshot.data(), id: snapshot.id } as OperationalNotification;
      if (current.acknowledged) return actionState(current);
      transaction.update(ref, {
        read: true,
        ...(!current.read ? { readAt: FieldValue.serverTimestamp() } : {}),
        acknowledged: true,
        acknowledgedAt: FieldValue.serverTimestamp(),
        acknowledgedBy,
        status: "acknowledged",
        updatedAt: FieldValue.serverTimestamp(),
      });
      return { id, status: "acknowledged", read: true, acknowledged: true };
    });
  }
}
