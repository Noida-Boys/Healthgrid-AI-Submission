import { generateDistrictReport } from "@/lib/report/district-pdf";
import { getAllFacilities } from "@/lib/server/data";

// Always render from live Firestore state, never a cached build-time snapshot.
export const dynamic = "force-dynamic";

export async function GET() {
  const facilities = await getAllFacilities();
  if (facilities.length === 0) {
    return Response.json({ error: "No facility data available" }, { status: 503 });
  }

  const pdf = await generateDistrictReport(facilities);
  const date = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="healthgrid-wardha-report-${date}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
}
