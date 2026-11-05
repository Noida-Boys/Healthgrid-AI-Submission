import { env } from "./config";

/* Gnani AI (Vachana) speech APIs.
   STT: Prisma v3.0  POST /stt/v3              (multipart, WAV/MP3/OGG/FLAC/AAC/M4A, max 30s)
   TTS: Timbre v3.0  POST /api/v1/tts/inference (JSON in, WAV out)
   Docs: https://docs.gnani.ai/api/introduction/quick-start */

const BASE = process.env.GNANI_BASE_URL ?? "https://api.vachana.ai";
export const STT_MODEL = process.env.GNANI_STT_MODEL ?? "prisma-v3.0";
export const TTS_MODEL = process.env.GNANI_TTS_MODEL ?? "timbre-v3.0";

export class GnaniUnavailable extends Error {}

export const GNANI_LANG: Record<string, string> = { hi: "hi-IN", mr: "mr-IN", en: "en-IN" };

// Timbre v3.0 voices speak all 10 languages, so one voice per gender covers hi/mr/en.
const TTS_VOICE = process.env.GNANI_TTS_VOICE ?? "Shivani";

export interface SttResult {
  transcript: string;
  detectedLanguage?: string;
  latencyMs?: number;
}

/** Prisma STT. `indic-auto` lets the model pick the language, which handles
    a worker switching between Hindi, Marathi and English mid-sentence. */
export async function transcribe(audio: Blob, opts: { languageCode?: string; timeoutMs?: number } = {}): Promise<SttResult> {
  const form = new FormData();
  form.append("audio_file", audio, "update.wav");
  form.append("model", STT_MODEL);
  form.append("language_code", opts.languageCode ?? "indic-auto");
  form.append("format", "transcribe"); // numbers come back as digits: "50", not "पचास"

  const res = await fetch(`${BASE}/stt/v3`, {
    method: "POST",
    headers: { "X-API-Key-ID": env("GNANI_API_KEY") },
    body: form,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20_000),
  });
  if (!res.ok) throw new GnaniUnavailable(`stt ${res.status}: ${await res.text().catch(() => "")}`);
  const data = (await res.json()) as {
    success?: boolean;
    transcript?: string;
    detected_language_code?: string;
    end_to_end_latency?: number;
  };
  if (data.success === false || typeof data.transcript !== "string") throw new GnaniUnavailable("stt: no transcript");
  return {
    transcript: data.transcript.trim(),
    detectedLanguage: data.detected_language_code,
    latencyMs: data.end_to_end_latency != null ? Math.round(data.end_to_end_latency * 1000) : undefined,
  };
}

/** Timbre TTS. Returns a WAV the browser can play directly. */
export async function synthesize(text: string, opts: { language?: string; voice?: string; timeoutMs?: number } = {}): Promise<ArrayBuffer> {
  const res = await fetch(`${BASE}/api/v1/tts/inference`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-API-Key-ID": env("GNANI_API_KEY") },
    body: JSON.stringify({
      text,
      voice: opts.voice ?? TTS_VOICE,
      model: TTS_MODEL,
      language: opts.language ?? "hi-IN",
      speed: 1.0,
      audio_config: { sample_rate: 24000, num_channels: 1, sample_width: 2, encoding: "linear_pcm", container: "wav" },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
  });
  if (!res.ok) throw new GnaniUnavailable(`tts ${res.status}: ${await res.text().catch(() => "")}`);
  return res.arrayBuffer();
}
