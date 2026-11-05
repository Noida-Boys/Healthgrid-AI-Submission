import type { NotificationChannel } from "./types";

export const MAX_NOTIFICATION_REPORT_LENGTH = 4000;
const SUPPORTED_CHANNELS = new Set<NotificationChannel>(["in_app", "whatsapp", "sms"]);

export interface NotifyRequest {
  facilityId: string;
  report: string;
  channels: NotificationChannel[];
}

export type NotifyValidationResult = { ok: true; value: NotifyRequest } | { ok: false; status: 400; error: string };

export function validateNotifyRequest(payload: unknown): NotifyValidationResult {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { ok: false, status: 400, error: "Request body must be an object" };
  }
  const input = payload as Record<string, unknown>;
  if (typeof input.facilityId !== "string" || !input.facilityId.trim()) {
    return { ok: false, status: 400, error: "facilityId is required" };
  }
  if (typeof input.report !== "string" || !input.report.trim()) {
    return { ok: false, status: 400, error: "report is required" };
  }
  if (input.report.length > MAX_NOTIFICATION_REPORT_LENGTH) {
    return { ok: false, status: 400, error: `report must be ${MAX_NOTIFICATION_REPORT_LENGTH} characters or fewer` };
  }
  if (!Array.isArray(input.channels) || input.channels.length === 0) {
    return { ok: false, status: 400, error: "at least one channel is required" };
  }
  if (input.channels.some((channel) => typeof channel !== "string" || !SUPPORTED_CHANNELS.has(channel as NotificationChannel))) {
    return { ok: false, status: 400, error: "channels contains an unsupported channel" };
  }
  if (input.channels.includes("sms")) return { ok: false, status: 400, error: "SMS channel is not configured" };
  return {
    ok: true,
    value: {
      facilityId: input.facilityId.trim(),
      report: input.report,
      channels: [...new Set(input.channels as NotificationChannel[])],
    },
  };
}
