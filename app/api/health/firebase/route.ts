import { adminDb, adminProjectId } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    await adminDb().collection("facilities").limit(1).get();
    return Response.json({ ok: true, projectId: adminProjectId() });
  } catch (error) {
    console.error("Firebase Admin health check failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return Response.json({ ok: false, error: "Firebase Admin unavailable" }, { status: 500 });
  }
}
