"use client";

import type { Facility, FacilityStatus, IncidentScenario } from "@/lib/engine/types";
import { computeRisk } from "@/lib/engine/risk";
import { facilityForecast } from "@/lib/engine/forecast";
import { incidentEffects } from "@/lib/engine/incident";
import { demandForecast, type DemandPressure, type DemandTrend } from "@/lib/engine/demand";
import { useHistory } from "@/hooks/useHistory";
import ScoreRing from "@/components/facility/ScoreRing";
import Sparkline from "@/components/Sparkline";

const STATUS_LABEL: Record<FacilityStatus, string> = {
  healthy: "Healthy",
  at_risk: "At risk",
  critical: "Critical",
};
const STATUS_COLOR: Record<FacilityStatus, string> = {
  healthy: "var(--status-healthy)",
  at_risk: "var(--status-at-risk)",
  critical: "var(--status-critical)",
};

export default function FacilityPanel({ facility, scenario }: { facility: Facility; scenario?: IncidentScenario }) {
  const history = useHistory(facility.id, 30);
  const fx = incidentEffects(scenario);
  const stressed = fx.footfall !== 1;
  const breakdown = computeRisk(facility, scenario);
  const forecasts = facilityForecast(facility, scenario);
  const demand = demandForecast(facility, scenario);
  const displayScore = stressed ? breakdown.total : facility.healthScore;
  const displayStatus = stressed ? breakdown.status : facility.status;
  const color = STATUS_COLOR[displayStatus];
  const occupancyPct = facility.beds.total ? Math.round((facility.beds.occupied / facility.beds.total) * 100) : 0;

  return (
    <div className="rounded border border-line bg-surface-1">
      {/* Identity + score */}
      <div className="flex items-start justify-between p-3 border-b border-line">
        <div>
          <div className="text-ink-1 text-[15px] font-semibold">{facility.name}</div>
          <div className="text-ink-3 text-xs mt-0.5">
            {facility.type} · {facility.block} block
          </div>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <span
              className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-xs font-medium"
              style={{ color, background: `color-mix(in srgb, ${color} 16%, transparent)` }}
            >
              <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: color }} />
              {STATUS_LABEL[displayStatus]}
            </span>
            {stressed && (
              <span
                className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium"
                style={{ color: "var(--status-at-risk)", background: "var(--status-at-risk-dim)" }}
              >
                {fx.label} · simulation
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-center">
          <ScoreRing score={displayScore} color={color} />
          <div className="rail-label">{stressed ? "Simulated score" : "Health score"}</div>
        </div>
      </div>

      {/* Score breakdown */}
      <div className="p-3 border-b border-line">
        <div className="rail-label mb-2">Score breakdown</div>
        {(
          [
            ["Medicines", breakdown.medicine, 40],
            ["Staffing", breakdown.staffing, 25],
            ["Bed capacity", breakdown.beds, 15],
            ["Patient surge", breakdown.surge, 10],
            ["Diagnostics", breakdown.tests, 10],
          ] as const
        ).map(([label, value, max]) => (
          <div key={label} className="flex items-center gap-2 py-1">
            <span className="text-ink-2 text-xs w-24 shrink-0">{label}</span>
            <div className="flex-1 h-1 rounded-full bg-surface-2">
              <div
                className="h-1 rounded-full"
                style={{
                  width: `${(value / max) * 100}%`,
                  background: value / max < 0.45 ? "var(--status-critical)" : value / max < 0.75 ? "var(--status-at-risk)" : "var(--ink-3)",
                }}
              />
            </div>
            <span className="num text-ink-2 text-xs w-12 text-right">
              {value}/{max}
            </span>
          </div>
        ))}
      </div>

      {/* Operations strip */}
      <div className="grid grid-cols-3 divide-x divide-line border-b border-line">
        <Metric label="Patients today" value={String(facility.patients.todayCount)} sub={trendText(facility.patients.trend7dPct)} subColor={facility.patients.trend7dPct > 15 ? "var(--status-critical)" : "var(--ink-3)"} />
        <Metric label="Doctors" value={`${facility.staff.doctorsPresentToday}/${facility.staff.doctorsSanctioned}`} sub={`${Math.round(facility.staff.attendanceRate7d * 100)}% attendance 7d`} />
        <Metric label="Beds" value={`${facility.beds.occupied}/${facility.beds.total}`} sub={`${occupancyPct}% occupied`} subColor={occupancyPct > 85 ? "var(--status-at-risk)" : "var(--ink-3)"} />
      </div>

      <div className="p-3 border-b border-line bg-surface-2/40">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="rail-label">Patient demand forecast</div>
          <span className="num text-[10px] text-ink-3">
            {stressed && (
              <span className="mr-2 font-medium" style={{ color: "var(--status-at-risk)" }}>
                footfall adjusted +{Math.round((fx.footfall - 1) * 100)}%
              </span>
            )}
            {Math.round(demand.confidence * 100)}% confidence
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded border border-line bg-surface-1 p-2">
            <div className="text-[10px] uppercase tracking-wide text-ink-3">Expected tomorrow</div>
            <div className="num text-xl text-ink-1 mt-0.5">{demand.predictedTomorrow.toLocaleString("en-IN")}</div>
            <div className="text-[10px] text-ink-3">patients</div>
          </div>
          <div className="rounded border border-line bg-surface-1 p-2">
            <div className="text-[10px] uppercase tracking-wide text-ink-3">Expected next 7 days</div>
            <div className="num text-xl text-ink-1 mt-0.5">{demand.predicted7DayTotal.toLocaleString("en-IN")}</div>
            <div className="text-[10px] text-ink-3">patient visits</div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2">
          <DemandBadge label={demand.trend} kind={demand.trend} />
          <DemandBadge label={`${demand.pressure} pressure`} kind={demand.pressure} />
        </div>
        <ul className="mt-2 space-y-1">
          {demand.reasons.map((reason) => <li key={reason} className="text-[11px] leading-relaxed text-ink-2">• {reason}</li>)}
        </ul>
      </div>

      {/* Inventory */}
      <div className="p-3 border-b border-line">
        <div className="rail-label mb-2">Medicine inventory</div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-ink-3">
              <th className="text-left font-normal pb-1.5">Medicine</th>
              <th className="text-right font-normal pb-1.5">Stock</th>
              <th className="text-right font-normal pb-1.5">30d use</th>
              <th className="text-right font-normal pb-1.5">Supply</th>
            </tr>
          </thead>
          <tbody>
            {forecasts.map((fc) => {
              const item = facility.inventory[fc.medicineId];
              const usage = history.map((d) => d.consumption[fc.medicineId] ?? 0);
              return (
                <tr key={fc.medicineId} className="border-t border-line h-9 hover:bg-surface-2/60 transition-colors">
                  <td className="text-ink-1 pr-2">{fc.name}</td>
                  <td className="num text-ink-2 text-right">
                    {item.currentStock.toLocaleString("en-IN")} <span className="text-ink-3">{item.unit}</span>
                  </td>
                  <td className="text-right pl-2">
                    <Sparkline values={usage} />
                  </td>
                  <td className="text-right pl-2">
                    <DaysBadge daysLeft={fc.daysLeft} severity={fc.severity} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Diagnostics */}
      <div className="p-3">
        <div className="rail-label mb-2">Diagnostics</div>
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(facility.tests).map(([name, available]) => (
            <span
              key={name}
              className="px-1.5 py-0.5 rounded text-xs"
              style={
                available
                  ? { color: "var(--ink-2)", background: "var(--surface-2)" }
                  : { color: "var(--status-critical)", background: "var(--status-critical-dim)" }
              }
            >
              {name}
              {!available && " · down"}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DemandBadge({ label, kind }: { label: string; kind: DemandPressure | DemandTrend }) {
  const color = kind === "critical" || kind === "rising" ? "var(--status-critical)" : kind === "high" || kind === "moderate" ? "var(--status-at-risk)" : kind === "falling" ? "var(--status-healthy)" : "var(--ink-2)";
  return <span className="capitalize px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ color, background: `color-mix(in srgb, ${color} 14%, transparent)` }}>{label}</span>;
}

function Metric({ label, value, sub, subColor = "var(--ink-3)" }: { label: string; value: string; sub: string; subColor?: string }) {
  return (
    <div className="p-3">
      <div className="rail-label">{label}</div>
      <div className="num text-ink-1 text-[17px] mt-1">{value}</div>
      <div className="text-xs mt-0.5" style={{ color: subColor }}>
        {sub}
      </div>
    </div>
  );
}

function trendText(pct: number): string {
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct}% vs prev 7d`;
}

function DaysBadge({ daysLeft, severity }: { daysLeft: number; severity: "ok" | "warning" | "critical" }) {
  const color =
    severity === "critical" ? "var(--status-critical)" : severity === "warning" ? "var(--status-at-risk)" : "var(--ink-3)";
  const text = !isFinite(daysLeft)
    ? "ample"
    : daysLeft < 1
      ? "Stock-out imminent"
      : `${Math.floor(daysLeft)} days left`;
  return (
    <span
      className="num inline-block px-1.5 py-0.5 rounded text-xs whitespace-nowrap"
      style={{ color, background: severity === "ok" ? "transparent" : `color-mix(in srgb, ${color} 16%, transparent)` }}
    >
      {text}
    </span>
  );
}
