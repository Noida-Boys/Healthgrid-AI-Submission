"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import LanguageGate from "@/components/field/LanguageGate";
import VoiceUpdate from "@/components/field/VoiceUpdate";
import ScoreRing from "@/components/facility/ScoreRing";
import FieldNotificationInbox from "@/components/notifications/FieldNotificationInbox";
import { useFacilities } from "@/hooks/useFacilities";
import { LANGS, STRINGS, type Lang } from "@/lib/field-i18n";
import type { FieldUpdate } from "@/app/api/actions/update-facility/route";
import type { Facility, FacilityStatus } from "@/lib/engine/types";

const STATUS_COLOR: Record<FacilityStatus, string> = {
  healthy: "var(--status-healthy)",
  at_risk: "var(--status-at-risk)",
  critical: "var(--status-critical)",
};

// The stored language, read via useSyncExternalStore so hydration stays clean
// and the linter's no-setState-in-effect rule holds.
const langSubscribe = (cb: () => void) => {
  window.addEventListener("hg-lang", cb);
  return () => window.removeEventListener("hg-lang", cb);
};
const readLang = () => (localStorage.getItem("hg-lang") as Lang) || null;

export default function FieldPage() {
  const { facilities, loading } = useFacilities();
  const [facilityId, setFacilityId] = useState("seloo-phc");
  const lang = useSyncExternalStore(langSubscribe, readLang, () => null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const facility = useMemo(() => facilities.find((f) => f.id === facilityId) ?? null, [facilities, facilityId]);
  const t = STRINGS[lang ?? "hi"];

  function pickLang(l: Lang) {
    localStorage.setItem("hg-lang", l);
    window.dispatchEvent(new Event("hg-lang"));
  }

  async function apply(updates: FieldUpdate[]) {
    setSaving(true);
    const res = await fetch("/api/actions/update-facility", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ facilityId, updates, source: "manual" }),
    });
    setSaving(false);
    const body = await res.json();
    setToast(res.ok ? `${t.savedScore} ${body.healthScore}` : t.updateFailed);
    setTimeout(() => setToast(""), 3000);
  }

  if (!lang) return <LanguageGate onPick={pickLang} />;

  if (loading || !facility) {
    return <div className="min-h-dvh field-ambient flex items-center justify-center text-ink-3 text-sm">{t.loading}</div>;
  }

  const color = STATUS_COLOR[facility.status];

  return (
    <div className="min-h-dvh field-ambient">
      {/* App bar */}
      <header className="sticky top-0 z-10 border-b border-line bg-surface-0/85 backdrop-blur">
        <div className="mx-auto w-full max-w-lg px-4 h-12 flex items-center justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="wordmark text-[15px] font-semibold text-ink-1">HealthGrid</span>
            <span className="wordmark text-[15px] font-semibold text-accent">AI</span>
            <span className="rail-label ml-1.5">Field</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded border border-line overflow-hidden">
              {LANGS.map((l) => (
                <button
                  key={l.code}
                  onClick={() => pickLang(l.code)}
                  className={`px-2 py-1 text-[11px] ${
                    lang === l.code ? "bg-surface-2 text-ink-1" : "text-ink-3 hover:text-ink-2"
                  }`}
                >
                  {l.native}
                </button>
              ))}
            </div>
            <Link href="/" className="text-ink-3 text-xs hover:text-ink-2">
              {t.commandCenter} →
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-lg px-4 py-4 flex flex-col gap-3 pb-10">
        {/* Facility identity */}
        <section className="rounded-md border border-line bg-surface-1 p-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <select
              value={facilityId}
              onChange={(e) => setFacilityId(e.target.value)}
              aria-label="Facility"
              className="w-full max-w-[220px] -ml-1 rounded border border-transparent hover:border-line bg-transparent text-ink-1 text-[17px] font-semibold py-0.5 focus:border-line"
            >
              {facilities.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
            <div className="text-ink-3 text-xs mt-0.5">
              {t.fieldTag} · {facility.block}
            </div>
            <div
              className="inline-flex items-center gap-1.5 mt-2 px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              {t.beds} {facility.beds.occupied}/{facility.beds.total} · {t.doctors} {facility.staff.doctorsPresentToday}/
              {facility.staff.doctorsSanctioned}
            </div>
          </div>
          <div className="shrink-0 flex flex-col items-center">
            <ScoreRing score={facility.healthScore} color={color} />
            <div className="rail-label">{t.score}</div>
          </div>
        </section>

        <FieldNotificationInbox facilityId={facilityId} />

        {/* Voice — the centerpiece */}
        <VoiceUpdate facility={facility} lang={lang} t={t} />

        {/* Quick updates */}
        <div className="rail-label px-1 mt-1">{t.quickUpdates}</div>

        <StockUpdater facility={facility} t={t} onApply={apply} disabled={saving} />

        <div className="grid grid-cols-2 gap-3">
          <Stepper
            label={t.bedsOccupied}
            value={facility.beds.occupied}
            max={facility.beds.total}
            saveLabel={t.save}
            onSave={(v) => apply([{ field: "beds", value: v }])}
            disabled={saving}
          />
          <Stepper
            label={t.doctorsPresent}
            value={facility.staff.doctorsPresentToday}
            max={facility.staff.doctorsSanctioned}
            saveLabel={t.save}
            onSave={(v) => apply([{ field: "doctors", value: v }])}
            disabled={saving}
          />
        </div>

        <section className="rounded-md border border-line bg-surface-1 p-4">
          <div className="rail-label mb-2.5">{t.tests}</div>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(facility.tests).map(([name, available]) => (
              <button
                key={name}
                disabled={saving}
                onClick={() => apply([{ field: "test", testName: name, value: !available }])}
                className={`px-3 py-2.5 rounded-md text-xs border text-left transition-colors ${
                  available ? "border-line text-ink-2 bg-surface-2 hover:border-ink-3" : "border-critical/60 text-critical bg-critical-dim"
                }`}
              >
                <span className="font-medium">{name}</span>
                <span className="block text-[10px] mt-0.5 opacity-75">
                  {available ? `${t.available} · ${t.tapIfDown}` : `${t.down} · ${t.tapWhenRestored}`}
                </span>
              </button>
            ))}
          </div>
        </section>
      </main>

      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 rounded-md border border-line bg-surface-2 px-4 py-2.5 text-xs text-ink-1 shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function StockUpdater({
  facility,
  t,
  onApply,
  disabled,
}: {
  facility: Facility;
  t: (typeof STRINGS)["en"];
  onApply: (u: FieldUpdate[]) => void;
  disabled: boolean;
}) {
  const meds = Object.values(facility.inventory);
  const [medicineId, setMedicineId] = useState(meds[0]?.medicineId ?? "");
  const selected = meds.find((m) => m.medicineId === medicineId);
  const [value, setValue] = useState<string>("");

  return (
    <section className="rounded-md border border-line bg-surface-1 p-4">
      <div className="rail-label mb-2.5">{t.medicineStock}</div>
      <div className="flex gap-2">
        <select
          value={medicineId}
          onChange={(e) => {
            setMedicineId(e.target.value);
            setValue("");
          }}
          className="flex-1 min-w-0 rounded-md border border-line bg-surface-2 px-2.5 py-3 text-xs text-ink-1"
        >
          {meds.map((m) => (
            <option key={m.medicineId} value={m.medicineId}>
              {m.name} ({m.currentStock} {m.unit})
            </option>
          ))}
        </select>
        <input
          type="number"
          inputMode="numeric"
          min={0}
          placeholder={String(selected?.currentStock ?? "")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="num w-24 rounded-md border border-line bg-surface-2 px-2.5 py-3 text-sm text-ink-1 placeholder:text-ink-3"
        />
        <button
          disabled={disabled || value === ""}
          onClick={() => {
            onApply([{ field: "stock", medicineId, value: Number(value) }]);
            setValue("");
          }}
          className="px-4 py-3 rounded-md text-sm font-semibold bg-accent/15 text-accent border border-accent/50 hover:bg-accent/25 disabled:opacity-40"
        >
          {t.save}
        </button>
      </div>
    </section>
  );
}

function Stepper({
  label,
  value,
  max,
  saveLabel,
  onSave,
  disabled,
}: {
  label: string;
  value: number;
  max: number;
  saveLabel: string;
  onSave: (v: number) => void;
  disabled: boolean;
}) {
  const [v, setV] = useState<number | null>(null);
  const current = v ?? value;
  return (
    <section className="rounded-md border border-line bg-surface-1 p-4">
      <div className="rail-label mb-2.5">{label}</div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setV(Math.max(0, current - 1))}
          className="w-10 h-10 rounded-md border border-line text-ink-1 hover:border-ink-3"
          aria-label="decrease"
        >
          −
        </button>
        <span className="num flex-1 text-center text-ink-1 text-lg">
          {current}<span className="text-ink-3 text-sm">/{max}</span>
        </span>
        <button
          onClick={() => setV(Math.min(max, current + 1))}
          className="w-10 h-10 rounded-md border border-line text-ink-1 hover:border-ink-3"
          aria-label="increase"
        >
          +
        </button>
      </div>
      {v !== null && v !== value && (
        <button
          disabled={disabled}
          onClick={() => {
            onSave(v);
            setV(null);
          }}
          className="w-full mt-2.5 py-2.5 rounded-md text-xs font-semibold bg-accent/15 text-accent border border-accent/50 hover:bg-accent/25"
        >
          {saveLabel}
        </button>
      )}
    </section>
  );
}
