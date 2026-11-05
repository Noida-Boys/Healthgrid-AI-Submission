import { GnaniUnavailable, synthesize } from "@/lib/gnani";

/** Text → speech with Gnani Timbre. Reads the confirmation back to the worker
    so they can check the update without reading the screen. */
export async function POST(req: Request) {
  const { text, language } = (await req.json()) as { text?: string; language?: string };
  if (!text?.trim()) return Response.json({ error: "text required" }, { status: 400 });
  if (text.length > 600) return Response.json({ error: "text too long" }, { status: 413 });

  try {
    const wav = await synthesize(text.trim(), { language });
    return new Response(wav, { headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("gnani tts error:", e instanceof GnaniUnavailable ? e.message : e);
    return Response.json({ error: "speech unavailable" }, { status: 502 });
  }
}
