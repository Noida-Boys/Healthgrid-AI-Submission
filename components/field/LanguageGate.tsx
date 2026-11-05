"use client";

import { LANGS, type Lang } from "@/lib/field-i18n";

/** First-run screen: the worker picks their language before anything else. */
export default function LanguageGate({ onPick }: { onPick: (lang: Lang) => void }) {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 field-ambient">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="wordmark text-[22px] font-semibold">
            <span className="text-ink-1">HealthGrid</span> <span className="text-accent">AI</span>
          </div>
          <div className="rail-label mt-1">Field · फील्ड</div>
        </div>

        <div className="text-center mb-6">
          <div className="text-ink-1 text-[17px] font-medium">अपनी भाषा चुनें</div>
          <div className="text-ink-3 text-xs mt-1">आपली भाषा निवडा · Choose your language</div>
        </div>

        <div className="space-y-3">
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => onPick(l.code)}
              className="w-full flex items-baseline justify-between rounded-md border border-line bg-surface-1 px-5 py-4 hover:border-accent hover:bg-surface-2 transition-colors"
            >
              <span className="text-ink-1 text-[17px] font-medium">{l.native}</span>
              <span className="text-ink-3 text-xs">{l.english}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
