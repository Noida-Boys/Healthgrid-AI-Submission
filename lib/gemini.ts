import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { GEMINI_FALLBACK_MODEL, GEMINI_MODEL, env } from "./config";

let client: GoogleGenAI | null = null;

export function genai(): GoogleGenAI {
  if (!client) client = new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") });
  return client;
}

export class GeminiUnavailable extends Error {}

function isTransient(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return (
    msg.includes("429") ||
    msg.includes("404") ||
    msg.includes("NOT_FOUND") ||
    msg.includes("no longer available") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota") ||
    msg.includes("503") ||
    msg.includes("UNAVAILABLE") ||
    msg.includes("high demand") ||
    msg.includes("overloaded")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Every flash-tier model has its own free-tier quota bucket; rotating
    through them survives any single bucket running dry. Env-overridable:
    GEMINI_MODEL_POOL="model-a,model-b". */
const MODEL_POOL: string[] = [
  ...new Set(
    (process.env.GEMINI_MODEL_POOL?.split(",").map((m) => m.trim()).filter(Boolean) ?? [
      GEMINI_MODEL,
      GEMINI_FALLBACK_MODEL,
      "gemini-3.5-flash",
      "gemini-3-flash-preview",
    ]),
  ),
];

// A model that just failed transiently sits out briefly so consecutive
// requests don't hammer an exhausted bucket.
const coolingUntil = new Map<string, number>();
const COOLDOWN_MS = 5 * 60_000;

/** generateContent with resilience: walks the model pool, skipping models in
    cooldown, marking exhausted/overloaded buckets as it goes. The demo must
    survive free-tier weather. */
export async function generateWithFallback(
  params: Omit<GenerateContentParameters, "model">,
): Promise<GenerateContentResponse> {
  const now = Date.now();
  const available = MODEL_POOL.filter((m) => (coolingUntil.get(m) ?? 0) <= now);
  const candidates = available.length > 0 ? available : MODEL_POOL; // all cooling: try anyway
  let lastError: unknown;

  for (const [i, model] of candidates.entries()) {
    try {
      return await genai().models.generateContent({ model, ...params });
    } catch (e) {
      lastError = e;
      if (!isTransient(e)) throw e;
      coolingUntil.set(model, Date.now() + COOLDOWN_MS);
      console.warn(`gemini: ${model} unavailable, rotating (${i + 1}/${candidates.length})`);
      if (i < candidates.length - 1) await sleep(800);
    }
  }
  throw lastError;
}

/** One retry, hard timeout, JSON-schema-constrained output. Throws
    GeminiUnavailable so routes can serve their deterministic fallback. */
export async function generateStructured<T>(opts: {
  prompt: string;
  schema: object;
  system?: string;
  timeoutMs?: number;
}): Promise<T> {
  const attempt = async (): Promise<T> => {
    const res = await generateWithFallback({
      contents: opts.prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: opts.schema,
        systemInstruction: opts.system,
        abortSignal: AbortSignal.timeout(opts.timeoutMs ?? 25_000),
      },
    });
    const text = res.text;
    if (!text) throw new Error("empty response");
    return JSON.parse(text) as T;
  };

  try {
    return await attempt();
  } catch {
    try {
      return await attempt();
    } catch (e) {
      throw new GeminiUnavailable(e instanceof Error ? e.message : String(e));
    }
  }
}
