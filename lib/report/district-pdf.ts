// District situation report as a PDF, generated server-side from the same
// deterministic engines the command center renders. Uses pdf-lib (pure JS,
// no runtime font/data files) so it works unchanged in the Cloud Run
// standalone build.

import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb, type RGB } from "pdf-lib";
import { computeRisk, type ScoreBreakdown } from "../engine/risk";
import { facilityForecast, type MedForecast } from "../engine/forecast";
import type { Facility, FacilityStatus } from "../engine/types";

const PAGE_W = 595.28; // A4 portrait
const PAGE_H = 841.89;
const MARGIN = 48;
const CONTENT_W = PAGE_W - MARGIN * 2;

const INK = rgb(0.13, 0.15, 0.17);
const INK_2 = rgb(0.38, 0.41, 0.45);
const INK_3 = rgb(0.55, 0.58, 0.62);
const LINE = rgb(0.85, 0.87, 0.89);
const FILL = rgb(0.955, 0.963, 0.97);
const ACCENT = rgb(0.05, 0.42, 0.65);

const STATUS_COLOR: Record<FacilityStatus, RGB> = {
  healthy: rgb(0.09, 0.55, 0.35),
  at_risk: rgb(0.78, 0.52, 0.04),
  critical: rgb(0.78, 0.16, 0.16),
};
const STATUS_LABEL: Record<FacilityStatus, string> = {
  healthy: "Healthy",
  at_risk: "At risk",
  critical: "Critical",
};

const fmtDays = (d: number) => (d === Infinity || d > 90 ? "90+" : d.toFixed(1));

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
}

function newPage(ctx: Ctx) {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGIN;
}

function ensure(ctx: Ctx, needed: number) {
  if (ctx.y - needed < MARGIN + 24) newPage(ctx);
}

function text(ctx: Ctx, s: string, opts: { x?: number; size?: number; bold?: boolean; color?: RGB } = {}) {
  const size = opts.size ?? 9;
  ctx.page.drawText(s, {
    x: opts.x ?? MARGIN,
    y: ctx.y - size,
    size,
    font: opts.bold ? ctx.bold : ctx.font,
    color: opts.color ?? INK,
  });
}

function line(ctx: Ctx, yOffset = 0, color: RGB = LINE) {
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y - yOffset },
    end: { x: PAGE_W - MARGIN, y: ctx.y - yOffset },
    thickness: 0.6,
    color,
  });
}

/** One table row: cells drawn at fixed column offsets. */
function row(
  ctx: Ctx,
  cells: { s: string; x: number; bold?: boolean; color?: RGB }[],
  opts: { size?: number; height?: number; fill?: RGB } = {},
) {
  const height = opts.height ?? 15;
  ensure(ctx, height);
  if (opts.fill) {
    ctx.page.drawRectangle({
      x: MARGIN - 4,
      y: ctx.y - height + 3,
      width: CONTENT_W + 8,
      height,
      color: opts.fill,
    });
  }
  for (const c of cells) {
    ctx.page.drawText(c.s, {
      x: MARGIN + c.x,
      y: ctx.y - (opts.size ?? 8.5) - 2,
      size: opts.size ?? 8.5,
      font: c.bold ? ctx.bold : ctx.font,
      color: c.color ?? INK,
    });
  }
  ctx.y -= height;
}

function sectionTitle(ctx: Ctx, label: string) {
  ensure(ctx, 40);
  ctx.y -= 6;
  text(ctx, label.toUpperCase(), { size: 8, bold: true, color: ACCENT });
  ctx.y -= 14;
  line(ctx);
  ctx.y -= 8;
}

function scoreBar(ctx: Ctx, label: string, value: number, max: number, x: number, width: number) {
  const h = 5;
  const frac = max ? value / max : 0;
  ctx.page.drawText(`${label}  ${value}/${max}`, {
    x,
    y: ctx.y - 8,
    size: 7.5,
    font: ctx.font,
    color: INK_2,
  });
  ctx.page.drawRectangle({ x, y: ctx.y - 18, width, height: h, color: FILL });
  if (frac > 0) {
    ctx.page.drawRectangle({
      x,
      y: ctx.y - 18,
      width: width * Math.min(1, frac),
      height: h,
      color: frac >= 0.8 ? STATUS_COLOR.healthy : frac >= 0.5 ? STATUS_COLOR.at_risk : STATUS_COLOR.critical,
    });
  }
}

interface FacilityReport {
  facility: Facility;
  breakdown: ScoreBreakdown;
  forecast: MedForecast[];
}

export async function generateDistrictReport(facilities: Facility[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle("HealthGrid AI - Wardha District Health Report");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const ctx: Ctx = { doc, page: doc.addPage([PAGE_W, PAGE_H]), y: PAGE_H - MARGIN, font, bold };

  const reports: FacilityReport[] = facilities
    .map((facility) => ({
      facility,
      breakdown: computeRisk(facility),
      forecast: facilityForecast(facility),
    }))
    .sort((a, b) => a.breakdown.total - b.breakdown.total);

  const counts = { healthy: 0, at_risk: 0, critical: 0 };
  let patientsToday = 0;
  let criticalMeds = 0;
  let warningMeds = 0;
  for (const r of reports) {
    counts[r.breakdown.status]++;
    patientsToday += r.facility.patients.todayCount;
    for (const m of r.forecast) {
      if (m.severity === "critical") criticalMeds++;
      else if (m.severity === "warning") warningMeds++;
    }
  }

  const now = new Date();
  const generated = now.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long", timeStyle: "short" });

  // ---- Cover / summary ----
  text(ctx, "HealthGrid AI", { size: 20, bold: true });
  ctx.y -= 24;
  text(ctx, "District Health Situation Report", { size: 12, color: INK_2 });
  ctx.y -= 20;
  text(ctx, `Wardha District, Maharashtra  ·  Generated ${generated} IST`, { size: 9, color: INK_3 });
  ctx.y -= 16;
  line(ctx);
  ctx.y -= 10;

  sectionTitle(ctx, "District summary");
  const stats: [string, string, RGB][] = [
    ["Facilities monitored", String(reports.length), INK],
    ["Healthy", String(counts.healthy), STATUS_COLOR.healthy],
    ["At risk", String(counts.at_risk), STATUS_COLOR.at_risk],
    ["Critical", String(counts.critical), STATUS_COLOR.critical],
    ["Patients today", patientsToday.toLocaleString("en-IN"), INK],
    ["Medicines <3 days supply", String(criticalMeds), STATUS_COLOR.critical],
    ["Medicines <7 days supply", String(warningMeds), STATUS_COLOR.at_risk],
  ];
  const colW = CONTENT_W / 4;
  stats.forEach(([label, value], i) => {
    const x = MARGIN + (i % 4) * colW;
    if (i % 4 === 0 && i > 0) ctx.y -= 34;
    ctx.page.drawText(value, { x, y: ctx.y - 14, size: 14, font: bold, color: stats[i][2] });
    ctx.page.drawText(label, { x, y: ctx.y - 26, size: 7.5, font, color: INK_2 });
  });
  ctx.y -= 44;

  // ---- District overview table ----
  sectionTitle(ctx, "All facilities, most urgent first");
  const cols = { name: 0, type: 118, block: 152, score: 222, status: 258, beds: 305, docs: 345, urgent: 392 };
  row(
    ctx,
    [
      { s: "Facility", x: cols.name, bold: true, color: INK_2 },
      { s: "Type", x: cols.type, bold: true, color: INK_2 },
      { s: "Block", x: cols.block, bold: true, color: INK_2 },
      { s: "Score", x: cols.score, bold: true, color: INK_2 },
      { s: "Status", x: cols.status, bold: true, color: INK_2 },
      { s: "Beds", x: cols.beds, bold: true, color: INK_2 },
      { s: "Doctors", x: cols.docs, bold: true, color: INK_2 },
      { s: "Most urgent stock", x: cols.urgent, bold: true, color: INK_2 },
    ],
    { size: 7.5, height: 14 },
  );
  reports.forEach((r, i) => {
    const f = r.facility;
    const worst = r.forecast[0];
    row(
      ctx,
      [
        { s: f.name, x: cols.name, bold: r.breakdown.status === "critical" },
        { s: f.type, x: cols.type },
        { s: f.block, x: cols.block },
        { s: String(r.breakdown.total), x: cols.score, bold: true },
        { s: STATUS_LABEL[r.breakdown.status], x: cols.status, color: STATUS_COLOR[r.breakdown.status], bold: true },
        { s: `${f.beds.occupied}/${f.beds.total}`, x: cols.beds },
        { s: `${f.staff.doctorsPresentToday}/${f.staff.doctorsSanctioned}`, x: cols.docs },
        { s: worst ? `${worst.name.slice(0, 17)} (${fmtDays(worst.daysLeft)}d)` : "-", x: cols.urgent },
      ],
      { fill: i % 2 ? FILL : undefined },
    );
  });
  ctx.y -= 6;
  text(ctx, "Scores: >=80 healthy · 60-79 at risk · <60 critical. Weights: medicines 40 · staffing 25 · beds 15 · surge 10 · diagnostics 10.", {
    size: 7,
    color: INK_3,
  });
  ctx.y -= 14;

  // ---- Per-facility detail ----
  for (const r of reports) {
    const f = r.facility;
    ensure(ctx, 150);
    ctx.y -= 10;
    line(ctx, 0, LINE);
    ctx.y -= 12;

    text(ctx, f.name, { size: 12, bold: true });
    const sc = STATUS_COLOR[r.breakdown.status];
    ctx.page.drawText(`${r.breakdown.total}  ${STATUS_LABEL[r.breakdown.status].toUpperCase()}`, {
      x: PAGE_W - MARGIN - 90,
      y: ctx.y - 12,
      size: 11,
      font: bold,
      color: sc,
    });
    ctx.y -= 15;
    text(ctx, `${f.type} · ${f.block} block · ${f.patients.todayCount} patients today (${f.patients.trend7dPct >= 0 ? "+" : ""}${f.patients.trend7dPct.toFixed(0)}% 7-day trend)`, {
      size: 8,
      color: INK_2,
    });
    ctx.y -= 16;

    // Score component bars
    const barW = (CONTENT_W - 4 * 12) / 5;
    const parts: [string, number, number][] = [
      ["Medicines", r.breakdown.medicine, 40],
      ["Staffing", r.breakdown.staffing, 25],
      ["Beds", r.breakdown.beds, 15],
      ["Surge", r.breakdown.surge, 10],
      ["Diagnostics", r.breakdown.tests, 10],
    ];
    parts.forEach(([label, v, max], i) => scoreBar(ctx, label, v, max, MARGIN + i * (barW + 12), barW));
    ctx.y -= 28;

    const testsDown = Object.entries(f.tests).filter(([, ok]) => !ok).map(([n]) => n);
    text(
      ctx,
      `Beds ${f.beds.occupied}/${f.beds.total} · Doctors ${f.staff.doctorsPresentToday}/${f.staff.doctorsSanctioned} (7d attendance ${(f.staff.attendanceRate7d * 100).toFixed(0)}%)` +
        (testsDown.length ? ` · Tests down: ${testsDown.join(", ")}` : " · All diagnostics operational"),
      { size: 8, color: INK_2 },
    );
    ctx.y -= 16;

    // Medicine forecast table
    const mc = { name: 0, stock: 170, burn: 250, days: 330, sev: 410 };
    row(
      ctx,
      [
        { s: "Medicine", x: mc.name, bold: true, color: INK_2 },
        { s: "Stock", x: mc.stock, bold: true, color: INK_2 },
        { s: "Burn/day", x: mc.burn, bold: true, color: INK_2 },
        { s: "Days left", x: mc.days, bold: true, color: INK_2 },
        { s: "Supply status", x: mc.sev, bold: true, color: INK_2 },
      ],
      { size: 7.5, height: 13 },
    );
    for (const m of r.forecast) {
      const item = f.inventory[m.medicineId];
      const sevColor = m.severity === "critical" ? STATUS_COLOR.critical : m.severity === "warning" ? STATUS_COLOR.at_risk : INK_2;
      row(
        ctx,
        [
          { s: m.name, x: mc.name, bold: m.severity === "critical" },
          { s: item ? `${item.currentStock} ${item.unit}` : "-", x: mc.stock },
          { s: m.burnRate.toFixed(1), x: mc.burn },
          { s: fmtDays(m.daysLeft), x: mc.days, bold: m.severity !== "ok" },
          {
            s: m.severity === "critical" ? "CRITICAL <3d" : m.severity === "warning" ? "Warning <7d" : "OK",
            x: mc.sev,
            color: sevColor,
            bold: m.severity === "critical",
          },
        ],
        { height: 13 },
      );
    }
    ctx.y -= 4;
  }

  // ---- Footer on every page ----
  const pages = doc.getPages();
  pages.forEach((p, i) => {
    p.drawLine({ start: { x: MARGIN, y: 34 }, end: { x: PAGE_W - MARGIN, y: 34 }, thickness: 0.5, color: LINE });
    p.drawText("HealthGrid AI · Wardha District command center", { x: MARGIN, y: 22, size: 7, font, color: INK_3 });
    p.drawText(`Page ${i + 1} of ${pages.length}`, { x: PAGE_W - MARGIN - 60, y: 22, size: 7, font, color: INK_3 });
  });

  return doc.save();
}
