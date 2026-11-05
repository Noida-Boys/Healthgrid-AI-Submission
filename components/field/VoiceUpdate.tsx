"use client";

import { useRef, useState } from "react";
import type { Facility } from "@/lib/engine/types";
import type { FieldUpdate } from "@/app/api/actions/update-facility/route";
import type { FieldStrings, Lang } from "@/lib/field-i18n";
import { LANG_NAME } from "@/lib/field-i18n";
import { startWavRecording, type WavRecorder } from "@/lib/wav-recorder";

interface VoiceResult {
  updates: FieldUpdate[];
  confidence: number;
  transcript: string;
  echo: string;
  echoLang?: string;
}

type Phase = "idle" | "recording" | "processing" | "confirm" | "saving" | "done" | "retry" | "error";

function MicIcon({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0" />
      <path d="M12 18v3" />
    </svg>
  );
}

export default function VoiceUpdate({ facility, lang, t }: { facility: Facility; lang: Lang; t: FieldStrings }) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<VoiceResult | null>(null);
  const [error, setError] = useState("");
  const recorder = useRef<WavRecorder | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  async function startRecording() {
    if (recorder.current) return;
    try {
      recorder.current = await startWavRecording();
      setPhase("recording");
      // Hard stop at 30s (Gnani Prisma's per-request limit) so a stuck pointerup can't record forever.
      stopTimer.current = setTimeout(stopRecording, 29_500);
    } catch {
      setError(t.micDenied);
      setPhase("error");
    }
  }

  async function stopRecording() {
    const rec = recorder.current;
    if (!rec) return;
    recorder.current = null;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    setPhase("processing");
    void processAudio(await rec.stop());
  }

  /** Reads the confirmation aloud with Gnani Timbre. Best effort: the screen still shows it. */
  async function speak(text: string, language?: string) {
    try {
      const res = await fetch("/api/ai/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language }),
      });
      if (!res.ok) return;
      const url = URL.createObjectURL(await res.blob());
      player.current?.pause();
      player.current = new Audio(url);
      player.current.onended = () => URL.revokeObjectURL(url);
      await player.current.play();
    } catch {
      /* audio is a convenience, not a requirement */
    }
  }

  async function processAudio(blob: Blob) {
    // Browser-safe base64 (Buffer doesn't exist in client bundles).
    const bytes = new Uint8Array(await blob.arrayBuffer());
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    const audioBase64 = btoa(bin);
    try {
      const res = await fetch("/api/ai/voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64, mimeType: "audio/wav", facilityId: facility.id, lang: LANG_NAME[lang], langCode: lang }),
      });
      if (!res.ok) throw new Error();
      const data: VoiceResult = await res.json();
      setResult(data);
      const ok = data.updates.length > 0 && data.confidence >= 0.7;
      setPhase(ok ? "confirm" : "retry");
      if (ok && data.echo) void speak(data.echo, data.echoLang);
    } catch {
      setError(t.audioFailed);
      setPhase("error");
    }
  }

  async function confirm() {
    if (!result) return;
    setPhase("saving");
    const res = await fetch("/api/actions/update-facility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId: facility.id, updates: result.updates, source: "voice" }),
    });
    if (res.ok) {
      setPhase("done");
      setTimeout(() => setPhase("idle"), 4000);
    } else {
      setError(t.updateFailed);
      setPhase("error");
    }
  }

  const describe = (u: FieldUpdate) => {
    if (u.field === "stock") return { label: facility.inventory[u.medicineId ?? ""]?.name ?? u.medicineId, value: String(u.value) };
    if (u.field === "beds") return { label: t.bedsOccupied, value: String(u.value) };
    if (u.field === "doctors") return { label: t.doctorsPresent, value: String(u.value) };
    return { label: u.testName ?? "", value: u.value ? t.available : t.down };
  };

  return (
    <section className="rounded-md border border-line bg-surface-1 overflow-hidden">
      <div className="px-4 pt-3 pb-1 flex items-baseline justify-between">
        <div className="rail-label">{t.voiceTitle}</div>
        <div className="text-ink-3 text-[10px]">Gnani Prisma · Timbre</div>
      </div>

      {(phase === "idle" || phase === "recording") && (
        <div className="px-4 pb-5 pt-2 flex flex-col items-center text-center">
          <button
            onPointerDown={startRecording}
            onPointerUp={stopRecording}
            onPointerLeave={stopRecording}
            aria-label={t.holdToTalk}
            className={`relative w-24 h-24 rounded-full border flex items-center justify-center select-none touch-none transition-all duration-200 ${
              phase === "recording"
                ? "border-critical text-critical bg-critical-dim scale-110 shadow-[0_0_36px_-6px_var(--status-critical)]"
                : "border-accent/50 text-accent bg-accent/10 hover:bg-accent/20 shadow-[0_0_28px_-10px_var(--accent)]"
            }`}
          >
            <MicIcon />
            {phase === "recording" && (
              <span className="absolute inset-0 rounded-full border border-critical animate-ping opacity-40" aria-hidden />
            )}
          </button>
          <div className={`mt-4 text-sm font-medium ${phase === "recording" ? "text-critical" : "text-ink-1"}`}>
            {phase === "recording" ? t.listening : t.holdToTalk}
          </div>
          <div className="text-ink-3 text-xs mt-1">{t.voiceHint}</div>
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-xs text-ink-2">
            <span className="text-ink-3">“</span>
            {t.example}
            <span className="text-ink-3">”</span>
          </div>
        </div>
      )}

      {phase === "processing" && (
        <div className="px-4 pb-6 pt-2 flex flex-col items-center">
          <div className="w-24 h-24 rounded-full border border-line bg-surface-2 flex items-center justify-center text-ink-3">
            <MicIcon />
          </div>
          <div className="mt-4 text-ink-2 text-sm">{t.understanding}</div>
        </div>
      )}

      {(phase === "confirm" || phase === "retry") && result && (
        <div className="px-4 pb-4">
          <div className="rounded-md border border-line bg-surface-2 p-3">
            <div className="rail-label mb-1">{t.youSaid}</div>
            <p className="text-ink-2 text-[13px] leading-relaxed">“{result.transcript}”</p>

            {phase === "confirm" ? (
              <>
                <div className="mt-3 rounded border border-line bg-surface-1 divide-y divide-line">
                  {result.updates.map((u, i) => {
                    const d = describe(u);
                    return (
                      <div key={i} className="flex items-center justify-between px-3 py-2">
                        <span className="text-ink-2 text-xs">{d.label}</span>
                        <span className="num text-ink-1 text-sm">{d.value}</span>
                      </div>
                    );
                  })}
                </div>
                {result.echo && (
                  <button
                    onClick={() => speak(result.echo, result.echoLang)}
                    className="text-ink-3 text-xs mt-2 leading-relaxed text-left hover:text-ink-2"
                    aria-label="Play confirmation"
                  >
                    🔊 {result.echo}
                  </button>
                )}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={confirm}
                    className="flex-1 py-3 rounded-md text-sm font-semibold bg-accent/15 text-accent border border-accent/50 hover:bg-accent/25"
                  >
                    {t.confirm}
                  </button>
                  <button onClick={() => setPhase("idle")} className="px-4 py-3 rounded-md text-sm text-ink-3 border border-line hover:text-ink-2">
                    {t.cancel}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="mt-2 text-xs" style={{ color: "var(--status-at-risk)" }}>
                  {t.notUnderstood}
                </div>
                <button
                  onClick={() => setPhase("idle")}
                  className="w-full mt-3 py-3 rounded-md text-sm font-semibold bg-accent/15 text-accent border border-accent/50 hover:bg-accent/25"
                >
                  {t.tryAgain}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {phase === "saving" && <div className="px-4 pb-6 pt-2 text-center text-ink-2 text-sm">{t.saving}</div>}

      {phase === "done" && (
        <div className="px-4 pb-6 pt-2 text-center">
          <div className="text-sm font-semibold" style={{ color: "var(--status-healthy)" }}>
            ✓ {t.updated}
          </div>
          <div className="text-ink-3 text-xs mt-1">{t.updatedSub}</div>
        </div>
      )}

      {phase === "error" && (
        <div className="px-4 pb-4">
          <div className="rounded-md border border-line bg-surface-2 p-3">
            <div className="text-xs" style={{ color: "var(--status-critical)" }}>
              {error}
            </div>
            <button onClick={() => setPhase("idle")} className="w-full mt-2 py-2 rounded text-xs text-ink-2 border border-line hover:text-ink-1">
              {t.tryAgain}
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
