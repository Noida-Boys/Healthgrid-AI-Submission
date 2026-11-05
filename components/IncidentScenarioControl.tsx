"use client";

import { INCIDENTS, incidentEffects } from "@/lib/engine/incident";
import type { IncidentScenario } from "@/lib/engine/types";

const ORDER: IncidentScenario[] = ["normal", "heavy_rain", "flood_alert", "heatwave"];

/** Scenario picker + simulation banner for the command center. The scenario
    lives in dashboard state only — a lens over forecasts, never persisted. */
export default function IncidentScenarioControl({
  scenario,
  onChange,
}: {
  scenario: IncidentScenario;
  onChange: (s: IncidentScenario) => void;
}) {
  const fx = incidentEffects(scenario);
  const active = scenario !== "normal";

  return (
    <div className="shrink-0 border-b border-line bg-surface-1">
      <div className="flex items-center gap-3 px-4 h-9">
        <span className="rail-label">Stress scenario</span>
        <div className="flex rounded border border-line overflow-hidden">
          {ORDER.map((s) => (
            <button
              key={s}
              onClick={() => onChange(s)}
              className={`px-2.5 py-1 text-[11px] transition-colors ${
                scenario === s
                  ? s === "normal"
                    ? "bg-surface-2 text-ink-1"
                    : "bg-at-risk-dim text-[var(--status-at-risk)] font-medium"
                  : "text-ink-2 hover:bg-surface-2 hover:text-ink-1"
              }`}
            >
              {INCIDENTS[s].label}
            </button>
          ))}
        </div>
        <span className="text-ink-2 text-[11px] font-medium ml-auto hidden md:block">
          Simulation lens over forecasts — no data is modified
        </span>
      </div>

      {active && (
        <div
          className="flex items-baseline gap-2 px-4 py-1.5 border-t"
          style={{ background: "var(--status-at-risk-dim)", borderColor: "color-mix(in srgb, var(--status-at-risk) 40%, transparent)" }}
        >
          <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--status-at-risk)" }}>
            {fx.label} Simulation Active
          </span>
          <span className="text-ink-2 text-[11px]">{fx.description}</span>
        </div>
      )}
    </div>
  );
}
