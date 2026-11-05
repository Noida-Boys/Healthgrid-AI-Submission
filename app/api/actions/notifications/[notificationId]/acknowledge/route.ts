import { FirestoreNotificationRepository } from "@/lib/notifications/repository";

function validId(value: string): boolean {
  return value.length > 0 && value.length <= 200 && !value.includes("/");
}

export async function POST(_request: Request, context: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await context.params;
  if (!validId(notificationId)) return Response.json({ success: false, error: "invalid notification id" }, { status: 400 });
  try {
    const state = await new FirestoreNotificationRepository().acknowledge(notificationId, "field-worker-demo");
    if (!state) return Response.json({ success: false, error: "notification not found" }, { status: 404 });
    return Response.json({ success: true, ...state });
  } catch (error) {
    console.error("Notification acknowledgement failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ success: false, error: "Notification could not be acknowledged" }, { status: 500 });
  }
}
