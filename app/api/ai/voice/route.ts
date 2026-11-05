import { Type } from "@google/genai";
import { GeminiUnavailable, generateWithFallback } from "@/lib/gemini";
import { getFacility } from "@/lib/server/data";
import { GNANI_LANG, transcribe } from "@/lib/gnani";

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    updates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          field: { type: Type.STRING, enum: ["stock", "beds", "doctors", "test"] },
          medicineId: { type: Type.STRING, description: "Required when field is 'stock'; one of the listed medicine ids" },
          testName: { type: Type.STRING, description: "Required when field is 'test'" },
          value: {
            type: Type.NUMBER,
            description:
              "The NEW TOTAL after this update (for 'test': 1 available, 0 down). Compute it from the current facility state when the speaker talks in relative terms.",
          },
        },
        required: ["field", "value"],
      },
    },
    confidence: { type: Type.NUMBER, description: "0-1: how certain you are the updates match the speech" },
    echo: { type: Type.STRING, description: "One-line confirmation of what will be updated, in the worker's chosen language" },
  },
  required: ["updates", "confidence", "echo"],
};

/** Speech → structured inventory update.
    Pipeline: Gnani Prisma (speech → text, Indic + code-mixed) → Gemini (text → structured JSON). NO database write happens here: the
    worker always confirms on screen before anything is applied. */
export async function POST(req: Request) {
  const { audioBase64, mimeType, facilityId, lang, langCode } = (await req.json()) as {
    audioBase64: string;
    mimeType: string;
    facilityId: string;
    lang?: string; // "Hindi" | "Marathi" | "English" — the worker's UI language
    langCode?: string; // "hi" | "mr" | "en"
  };
  if (!audioBase64 || !facilityId) return Response.json({ error: "audio and facilityId required" }, { status: 400 });
  // ~30s of opus audio stays well under this; longer means something is wrong.
  if (audioBase64.length > 2_000_000) return Response.json({ error: "audio too long" }, { status: 413 });

  const facility = await getFacility(facilityId);
  if (!facility) return Response.json({ error: "facility not found" }, { status: 404 });

  const system = `You convert a health worker's spoken update (Hindi, Marathi, English, or mixed; already transcribed to text by a speech model) at ${facility.name} into structured updates.

CURRENT FACILITY STATE (use this to resolve relative statements):
Medicines (id: name — current stock): ${Object.values(facility.inventory)
    .map((i) => `${i.medicineId}: ${i.name} — ${i.currentStock} ${i.unit}`)
    .join("; ")}.
Beds: ${facility.beds.occupied} occupied of ${facility.beds.total} total.
Doctors: ${facility.staff.doctorsPresentToday} present of ${facility.staff.doctorsSanctioned} sanctioned.
Tests: ${Object.entries(facility.tests)
    .map(([n, ok]) => `${n} (${ok ? "available" : "down"})`)
    .join("; ")}.

SEMANTICS — "value" is always the NEW TOTAL after the update:
- "X left / remaining / बचा है / बचे हैं / उरले आहेत / शिल्लक" → value = X.
- A medicine named with a bare number and no verb ("ORS 50", "पैरासिटामोल 100") is the stock remaining → value = X. Only subtract when the speaker explicitly says it was used.
- "X used / consumed / given / लग गए / इस्तेमाल हुए / खर्च हुए / वापरले" → value = current stock − X (never below 0).
- "X received / arrived / आ गए / मिले / आले" → value = current stock + X.
- "all beds full / occupied / सारे बेड भर गए / सगळे बेड भरले" → field "beds", value = total beds (${facility.beds.total}).
- "X beds empty / खाली" → field "beds", value = total beds − X. "half the beds ..." → compute from total.
- "only X doctor(s) came / X डॉक्टर आए" → field "doctors", value = X. "all/both doctors present" → value = ${facility.staff.doctorsSanctioned}.
- A test/machine "not working / down / खराब" → field "test", value = 0; "working / fixed / ठीक" → value = 1.
- Number words in any language are numbers ("दस" = 10, "बीस" = 20, "पन्नास" = 50).

RULES:
- Extract EVERY distinct update in the speech — one sentence often contains several (medicines AND beds AND doctors AND tests). Missing one is an error.
- Map spoken medicine names (e.g. "ओआरएस" → ors, "पैरासिटामोल" → paracetamol) to the listed ids only. Never invent an update that was not spoken.
- Write "echo" in ${lang || "Hindi"}; when you derived a value, show the arithmetic there (e.g. "Paracetamol: 80 used → 404 left").
- If the speech is not an inventory/beds/doctors/tests update, return empty updates with confidence 0. If a quantity is genuinely ambiguous, lower the confidence below 0.7.`;

  // 1. Speech → text with Gnani Prisma.
  let stt;
  try {
    const audio = new Blob([Buffer.from(audioBase64, "base64")], { type: mimeType || "audio/wav" });
    stt = await transcribe(audio);
  } catch (e) {
    console.error("gnani stt error:", e instanceof Error ? e.message : e);
    return Response.json({ error: "Could not hear the audio. Please try again." }, { status: 502 });
  }
  if (!stt.transcript) {
    return Response.json({ updates: [], confidence: 0, transcript: "", echo: "", stt: { model: "prisma" } });
  }

  // 2. Text → structured updates with Gemini.
  try {
    const res = await generateWithFallback({
      contents: `Transcript of the spoken update: """${stt.transcript}"""\n\nConvert it into structured JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: SCHEMA,
        systemInstruction: system,
        thinkingConfig: { thinkingBudget: 0 },
        abortSignal: AbortSignal.timeout(30_000),
      },
    });
    const text = res.text;
    if (!text) throw new GeminiUnavailable("empty");
    const parsed = JSON.parse(text);
    return Response.json({
      ...parsed,
      transcript: stt.transcript,
      echoLang: GNANI_LANG[langCode ?? "hi"] ?? "hi-IN",
      stt: { model: "gnani-prisma-v3", detectedLanguage: stt.detectedLanguage, latencyMs: stt.latencyMs },
    });
  } catch (e) {
    console.error("voice parse error:", e instanceof Error ? e.message : e);
    return Response.json({ error: "Could not understand the update. Please try again." }, { status: 502 });
  }
}
