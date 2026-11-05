export function env(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3-flash-preview";
// When the primary model's quota is exhausted mid-demo, degrade to a model
// with a separate (larger) free-tier bucket instead of failing.
export const GEMINI_FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL ?? "gemini-3.1-flash-lite";
