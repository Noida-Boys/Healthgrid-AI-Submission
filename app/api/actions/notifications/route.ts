import { FirestoreNotificationRepository } from "@/lib/notifications/repository";

type NotificationAction = "read" | "acknowledge";

interface NotificationActionRequest {
  notificationId?: unknown;
  action?: unknown;
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && !value.includes("/");
}

function validAction(value: unknown): value is NotificationAction {
  return value === "read" || value === "acknowledge";
}

export async function POST(request: Request) {
  let body: NotificationActionRequest;
  try {
    body = (await request.json()) as NotificationActionRequest;
  } catch {
    return Response.json({ success: false, error: "invalid request body" }, { status: 400 });
  }

  if (!validId(body.notificationId)) {
    return Response.json({ success: false, error: "invalid notification id" }, { status: 400 });
  }
  if (!validAction(body.action)) {
    return Response.json({ success: false, error: "invalid notification action" }, { status: 400 });
  }

  try {
    const repository = new FirestoreNotificationRepository();
    const state = body.action === "read"
      ? await repository.markRead(body.notificationId)
      : await repository.acknowledge(body.notificationId, "field-worker-demo");

    if (!state) {
      return Response.json({ success: false, error: "notification not found" }, { status: 404 });
    }
    return Response.json({ success: true, ...state });
  } catch (error) {
    console.error("Notification update failed", {
      action: body.action,
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ success: false, error: "Notification could not be updated" }, { status: 500 });
  }
}
