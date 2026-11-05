/* Generates the HealthGrid AI pitch deck (docs/HealthGrid-Pitch.pptx).
   Run: NODE_PATH=$(npm root -g) node scripts/make-deck.js */
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const {
  FaClipboardList, FaHourglassHalf, FaUserSlash, FaMapMarkedAlt, FaBrain,
  FaMicrophone, FaCloudRain, FaShieldAlt, FaBolt, FaDatabase, FaMapMarkerAlt, FaFireAlt,
} = require("react-icons/fa");

// Product palette (no # per pptxgenjs rules)
const BG = "0A0E13";
const CARD = "141C26";
const CARD2 = "10161D";
const INK = "E8EDF2";
const MUT = "9FB0BF";
const FAINT = "5F7183";
const ACC = "4FA3A5";
const GREEN = "2FA36B";
const AMBER = "D9A03C";
const RED = "D9524A";
const LINE_C = "243040";

const SHOT = (n) => `docs/screenshots/${n}`;
const RATIO = 2160 / 1290; // dashboard screenshots

async function icon(Cmp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Cmp, { color, size: String(size) }));
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "HealthGrid AI";
  pres.title = "HealthGrid AI — Pitch";

  const dot = (slide, x, y, color) =>
    slide.addShape(pres.shapes.OVAL, { x, y, w: 0.12, h: 0.12, fill: { color } });

  const kicker = (slide, text, color = ACC) => {
    dot(slide, 0.55, 0.47, color);
    slide.addText(text.toUpperCase(), {
      x: 0.78, y: 0.32, w: 8, h: 0.4, fontSize: 12, bold: true, charSpacing: 3,
      color: FAINT, fontFace: "Arial", margin: 0, align: "left",
    });
  };

  const card = (slide, x, y, w, h, fill = CARD) =>
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.06, fill: { color: fill },
      line: { color: LINE_C, width: 1 },
    });

  // Pre-crop the hero to the map-only region so the slide-edge crop never
  // slices a card or ticker mid-content (QA fix).
  await sharp(SHOT("01-command-center.png")).extract({ left: 20, top: 130, width: 1440, height: 1040 }).png().toFile("docs/screenshots/hero-map.png");

  // ---------------- 1 · TITLE ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addImage({ path: SHOT("hero-map.png"), x: 5.35, y: 0, w: 4.65, h: 5.625, sizing: { type: "cover", w: 4.65, h: 5.625 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 5.35, y: 0, w: 0.35, h: 5.625, fill: { color: BG, transparency: 35 } });
    s.addText([
      { text: "HealthGrid ", options: { color: INK } },
      { text: "AI", options: { color: ACC } },
    ], { x: 0.55, y: 1.55, w: 4.6, h: 0.85, fontSize: 46, bold: true, fontFace: "Arial", margin: 0, align: "left" });
    s.addText("An AI command center for district public healthcare.", {
      x: 0.55, y: 2.45, w: 4.4, h: 0.85, fontSize: 19, color: MUT, fontFace: "Arial", margin: 0, align: "left",
    });
    s.addText("HMIS records what happened.\nHealthGrid decides what to do next.", {
      x: 0.55, y: 3.35, w: 4.4, h: 0.8, fontSize: 14, italic: true, color: ACC, fontFace: "Arial", margin: 0, align: "left",
    });
    s.addText("Build with AI · Code for Communities — Smart Health track\nNishant Rajpathak · Saatvik", {
      x: 0.55, y: 4.75, w: 4.5, h: 0.6, fontSize: 11, color: FAINT, fontFace: "Arial", margin: 0, align: "left",
    });
    s.addNotes("Open cold: 'This is a live district. Every dot is a health facility scored in real time. Two of them are in crisis — and the system already knows what to do about it.'");
  }

  // ---------------- 2 · PROBLEM ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    kicker(s, "The problem", RED);
    s.addText("India's primary healthcare runs blind between monthly reports", {
      x: 0.55, y: 0.8, w: 9, h: 0.95, fontSize: 28, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left",
    });
    const items = [
      { I: FaClipboardList, big: "25,000+", small: "PHCs track medicines, beds and staff on paper registers", c: AMBER },
      { I: FaHourglassHalf, big: "~30 days", small: "before facility data reaches the district through monthly HMIS reporting", c: AMBER },
      { I: FaUserSlash, big: "Too late", small: "stock-outs and staffing gaps are discovered after patients are turned away", c: RED },
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.55 + i * 3.08;
      card(s, x, 2.1, 2.85, 2.75);
      const ic = await icon(items[i].I, "#" + items[i].c);
      s.addShape(pres.shapes.OVAL, { x: x + 0.28, y: 2.42, w: 0.62, h: 0.62, fill: { color: CARD2 }, line: { color: LINE_C, width: 1 } });
      s.addImage({ data: ic, x: x + 0.43, y: 2.57, w: 0.32, h: 0.32 });
      s.addText(items[i].big, { x: x + 0.28, y: 3.25, w: 2.3, h: 0.6, fontSize: 30, bold: true, color: INK, fontFace: "Courier New", margin: 0, align: "left" });
      s.addText(items[i].small, { x: x + 0.28, y: 3.9, w: 2.35, h: 0.85, fontSize: 11.5, color: MUT, fontFace: "Arial", margin: 0, align: "left" });
    }
    s.addNotes("The data that could prevent stock-outs exists — it's just trapped at the facility on paper, and arrives at the district a month late as an aggregate.");
  }

  // ---------------- 3 · POSITIONING ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    kicker(s, "The insight");
    s.addText([
      { text: "HMIS records what happened.\n", options: { color: MUT } },
      { text: "HealthGrid decides what to do next.", options: { color: INK } },
    ], { x: 0.55, y: 0.85, w: 9, h: 1.5, fontSize: 30, bold: true, fontFace: "Arial", margin: 0, align: "left" });

    const boxes = [
      { t: "HMIS · DVDMS", d: "Existing systems of record — monthly reporting, drug logistics. Unchanged.", c: FAINT },
      { t: "HealthGrid AI", d: "The decision layer: live scores, forecasts, guarded transfer recommendations.", c: ACC },
      { t: "Same-day action", d: "One-click approved interventions with a full audit trail.", c: GREEN },
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.55 + i * 3.075; // row spans 0.55..9.45 — equal side margins (QA fix)
      card(s, x, 2.75, 2.75, 1.9, i === 1 ? CARD : CARD2);
      dot(s, x + 0.28, 3.06, boxes[i].c);
      s.addText(boxes[i].t, { x: x + 0.52, y: 2.92, w: 2.1, h: 0.4, fontSize: 15, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left" });
      s.addText(boxes[i].d, { x: x + 0.28, y: 3.42, w: 2.2, h: 1.1, fontSize: 11.5, color: MUT, fontFace: "Arial", margin: 0, align: "left" });
      if (i < 2) s.addText("→", { x: x + 2.72, y: 3.4, w: 0.35, h: 0.5, fontSize: 20, color: FAINT, fontFace: "Arial", align: "center", margin: 0 });
    }
    s.addText("No rip-and-replace: HealthGrid ingests the records districts already keep — and fills the real-time gap between reports from the frontline itself.", {
      x: 0.55, y: 4.95, w: 9, h: 0.5, fontSize: 12, italic: true, color: FAINT, fontFace: "Arial", margin: 0, align: "left",
    });
    s.addNotes("Judges reward solutions that plug into the existing stack. We are a lens and a decision layer, not a replacement HMIS.");
  }

  // ---------------- 4 · COMMAND CENTER ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    kicker(s, "The product · district command center");
    const w = 6.5, h = w / RATIO;
    s.addImage({ path: SHOT("01-command-center.png"), x: 0.55, y: 1.05, w, h });
    const feats = [
      { I: FaMapMarkerAlt, t: "Live digital twin", d: "15 facilities scored 0–100 on medicines, staffing, beds, surge, diagnostics.", c: GREEN },
      { I: FaBrain, t: "AI that explains & acts", d: "Root-cause analysis and guarded transfer plans — approved in one click.", c: ACC },
      { I: FaBolt, t: "Realtime, no refresh", d: "Every field update re-scores the district in seconds via Firestore sync.", c: AMBER },
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.05 + i * 1.35;
      const ic = await icon(feats[i].I, "#" + feats[i].c);
      s.addShape(pres.shapes.OVAL, { x: 7.25, y: y + 0.02, w: 0.5, h: 0.5, fill: { color: CARD }, line: { color: LINE_C, width: 1 } });
      s.addImage({ data: ic, x: 7.37, y: y + 0.14, w: 0.26, h: 0.26 });
      s.addText(feats[i].t, { x: 7.88, y, w: 1.75, h: 0.55, fontSize: 14, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left" });
      s.addText(feats[i].d, { x: 7.88, y: y + 0.42, w: 1.72, h: 0.85, fontSize: 10.5, color: MUT, fontFace: "Arial", margin: 0, align: "left" });
    }
    s.addNotes("This is a real screenshot, not a mockup. Wardha district, Maharashtra — real geography, synthetic-but-calibrated operational data, labeled as such.");
  }

  // ---------------- 5 · DEFENSIBLE AI ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    kicker(s, "Why the AI holds up under scrutiny");
    s.addText("Deterministic engines decide the numbers. Gemini does what LLMs are actually good at.", {
      x: 0.55, y: 0.8, w: 9, h: 0.8, fontSize: 22, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left",
    });
    card(s, 0.55, 1.85, 4.4, 2.8, CARD2);
    s.addText("DETERMINISTIC & TESTED", { x: 0.85, y: 2.05, w: 3.8, h: 0.35, fontSize: 11, bold: true, charSpacing: 2, color: GREEN, fontFace: "Arial", margin: 0, align: "left" });
    s.addText([
      { text: "Risk scoring — 5 weighted components, 0–100", options: { bullet: true, breakLine: true } },
      { text: "Burn-rate stock-out forecasts per medicine", options: { bullet: true, breakLine: true } },
      { text: "Transfer guardrails: donor keeps 14+ days, max 40%", options: { bullet: true, breakLine: true } },
      { text: "74 unit tests · reproducible seed & simulations", options: { bullet: true } },
    ], { x: 0.85, y: 2.5, w: 3.85, h: 2, fontSize: 12.5, color: MUT, fontFace: "Arial", paraSpaceAfter: 8, align: "left" });

    card(s, 5.15, 1.85, 4.4, 2.8, CARD2);
    s.addText("GEMINI, WHERE IT EXCELS", { x: 5.45, y: 2.05, w: 3.8, h: 0.35, fontSize: 11, bold: true, charSpacing: 2, color: ACC, fontFace: "Arial", margin: 0, align: "left" });
    s.addText([
      { text: "Grounded root-cause explanations — every claim cites data", options: { bullet: true, breakLine: true } },
      { text: "Structured transfer proposals, validated server-side", options: { bullet: true, breakLine: true } },
      { text: "Copilot with function calling over live engines", options: { bullet: true, breakLine: true } },
      { text: "Hindi / Marathi / English speech → structured updates", options: { bullet: true } },
    ], { x: 5.45, y: 2.5, w: 3.85, h: 2, fontSize: 12.5, color: MUT, fontFace: "Arial", paraSpaceAfter: 8, align: "left" });

    s.addText("Observe → Understand → Predict → Recommend → Approve → Execute → Monitor", {
      x: 0.3, y: 4.95, w: 9.4, h: 0.45, fontSize: 11.5, color: MUT, fontFace: "Courier New", align: "center", margin: 0,
    });
    s.addNotes("Anticipate the 'is the AI real?' question: predictions are our math, the LLM never invents a number, and nothing writes to the database without human confirmation.");
  }

  // ---------------- 6 · VOICE ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    kicker(s, "The frontline · voice-first field updates");
    const fh = 4.45, fw = fh * (780 / 1688);
    // Framed like a device so the dark screenshot reads as a phone (QA fix).
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: 7.35 - 0.12, y: 0.85 - 0.12, w: fw + 0.24, h: fh + 0.24, rectRadius: 0.12,
      fill: { color: CARD }, line: { color: LINE_C, width: 1.5 },
      shadow: { type: "outer", color: "000000", blur: 14, offset: 4, angle: 90, opacity: 0.5 },
    });
    s.addImage({ path: SHOT("04-field-screen.png"), x: 7.35, y: 0.85, w: fw, h: fh });
    s.addText("A health worker speaks.\nThe district reacts in seconds.", {
      x: 0.55, y: 0.95, w: 6.3, h: 1.1, fontSize: 26, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left",
    });
    card(s, 0.55, 2.2, 6.35, 1.05, CARD);
    const mic = await icon(FaMicrophone, "#" + ACC);
    s.addShape(pres.shapes.OVAL, { x: 0.85, y: 2.45, w: 0.55, h: 0.55, fill: { color: CARD2 }, line: { color: LINE_C, width: 1 } });
    s.addImage({ data: mic, x: 0.99, y: 2.59, w: 0.27, h: 0.27 });
    s.addText("“आज ओआरएस का स्टॉक 50 बचा है”", {
      x: 1.6, y: 2.38, w: 5.1, h: 0.45, fontSize: 16, bold: true, color: INK, fontFace: "Nirmala UI", margin: 0, align: "left",
    });
    s.addText("Gemini audio → structured update → worker confirms → live re-score", {
      x: 1.6, y: 2.83, w: 5.1, h: 0.35, fontSize: 10.5, color: FAINT, fontFace: "Arial", margin: 0, align: "left",
    });
    s.addText([
      { text: "Language-first onboarding: हिंदी · मराठी · English — whole UI localizes", options: { bullet: true, breakLine: true } },
      { text: "Handles mixed speech and maps medicine names to inventory ids", options: { bullet: true, breakLine: true } },
      { text: "Nothing is written without on-screen confirmation by the worker", options: { bullet: true, breakLine: true } },
      { text: "No forms. No paperwork. No English required.", options: { bullet: true, color: ACC } },
    ], { x: 0.55, y: 3.55, w: 6.4, h: 1.8, fontSize: 13, color: MUT, fontFace: "Arial", paraSpaceAfter: 9, align: "left" });
    s.addNotes("This is the emotional peak of the demo video — a real spoken Hindi sentence becoming a structured inventory update with the map reacting live.");
  }

  // ---------------- 7 · STRESS MODE ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    kicker(s, "New · weather & disaster stress mode", AMBER);
    const w = 6.2, h = w / RATIO;
    s.addImage({ path: SHOT("incident-facility.png"), x: 0.55, y: 1.05, w, h });
    const rows = [
      { I: FaCloudRain, t: "Flood Alert", d: "ORS ×1.8 · zinc ×1.7 · footfall +35% — outbreak-level diarrhoeal load", c: AMBER },
      { I: FaFireAlt, t: "Heatwave", d: "ORS ×1.9 · IV fluids ×1.6 — dehydration and heat stroke pattern", c: RED },
      { I: FaShieldAlt, t: "A reversible lens", d: "Forecasts, scores and the queue re-rank under stress. Switch back — baseline restores exactly. No data touched.", c: GREEN },
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.1 + i * 1.32;
      const ic = await icon(rows[i].I, "#" + rows[i].c);
      s.addShape(pres.shapes.OVAL, { x: 6.95, y: y, w: 0.5, h: 0.5, fill: { color: CARD }, line: { color: LINE_C, width: 1 } });
      s.addImage({ data: ic, x: 7.07, y: y + 0.12, w: 0.26, h: 0.26 });
      s.addText(rows[i].t, { x: 7.58, y: y - 0.03, w: 1.95, h: 0.4, fontSize: 14, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left" });
      s.addText(rows[i].d, { x: 7.58, y: y + 0.36, w: 1.95, h: 0.95, fontSize: 10.5, color: MUT, fontFace: "Arial", margin: 0, align: "left" });
    }
    s.addText("Multipliers follow WHO first-line response patterns — built to be replaced by live IMD weather signals.", {
      x: 0.55, y: 4.95, w: 9, h: 0.45, fontSize: 12, italic: true, color: FAINT, fontFace: "Arial", margin: 0, align: "left",
    });
    s.addNotes("Districts don't just need today's picture — they need to know what a flood does to next week's supply. This is preparedness planning with the same deterministic engines.");
  }

  // ---------------- 8 · IMPACT ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    kicker(s, "Measured impact — simulated, reproducible", GREEN);
    s.addText("One month, one district, existing stock only:", {
      x: 0.55, y: 0.85, w: 9, h: 0.6, fontSize: 22, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left",
    });
    const stats = [
      { big: "54 → 0", small: "projected facility-medicine stock-out days, next 30 days", c: GREEN },
      { big: "31", small: "guarded transfers between facilities", c: ACC },
      { big: "5,157", small: "units of existing district stock redistributed", c: ACC },
      { big: "₹0", small: "new medicine purchased", c: GREEN },
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.55 + i * 2.33;
      card(s, x, 1.75, 2.13, 2.4);
      s.addText(stats[i].big, { x: x + 0.2, y: 2.15, w: 1.75, h: 0.85, fontSize: i === 0 ? 30 : 36, bold: true, color: stats[i].c, fontFace: "Courier New", margin: 0, align: "left" });
      s.addText(stats[i].small, { x: x + 0.2, y: 3.05, w: 1.75, h: 0.95, fontSize: 11, color: MUT, fontFace: "Arial", margin: 0, align: "left" });
    }
    s.addText("Counterfactual simulation over the seeded 90-day history + 30-day projection, using the exact engines and guardrails that run in the product. Judges can reproduce it:  npx tsx scripts/impact-sim.ts", {
      x: 0.55, y: 4.55, w: 9, h: 0.8, fontSize: 12, color: FAINT, fontFace: "Arial", margin: 0, align: "left",
    });
    s.addNotes("The medicines to prevent every projected stock-out already exist inside the district. What's missing is visibility and coordination — that's the product.");
  }

  // ---------------- 9 · GOOGLE STACK ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    kicker(s, "Built on Google");
    s.addText("Gemini is the interface. Deterministic engines are the authority.", {
      x: 0.55, y: 0.8, w: 9, h: 0.7, fontSize: 22, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left",
    });
    const cells = [
      { t: "Gemini API", d: "Structured outputs · function calling · audio understanding · multilingual · TTS (demo narration)" },
      { t: "Cloud Firestore", d: "Realtime listeners power the live map — no polling, no refresh" },
      { t: "Google Maps Platform", d: "The district digital twin on real Wardha cartography, custom dark style" },
      { t: "Firebase", d: "Admin SDK transactions, security rules, hosting path" },
    ];
    for (let i = 0; i < 4; i++) {
      const x = 0.55 + (i % 2) * 4.63, y = 1.8 + Math.floor(i / 2) * 1.45;
      card(s, x, y, 4.35, 1.25, CARD2);
      dot(s, x + 0.28, y + 0.28, ACC);
      s.addText(cells[i].t, { x: x + 0.52, y: y + 0.14, w: 3.6, h: 0.4, fontSize: 14.5, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left" });
      s.addText(cells[i].d, { x: x + 0.52, y: y + 0.55, w: 3.6, h: 0.65, fontSize: 11, color: MUT, fontFace: "Arial", margin: 0, align: "left" });
    }
    s.addText("Next.js 16 · TypeScript · 74 unit tests · quota-aware Gemini model rotation", {
      x: 0.55, y: 4.95, w: 9, h: 0.4, fontSize: 11.5, color: MUT, fontFace: "Courier New", margin: 0, align: "left",
    });
    s.addNotes("Every Gemini capability the challenge highlights is used somewhere real: structured outputs everywhere, function calling in the copilot, audio understanding in voice, TTS in the demo video.");
  }

  // ---------------- 10 · CLOSE ----------------
  {
    const s = pres.addSlide();
    s.background = { color: BG };
    s.addImage({ path: SHOT("02-facility-panel.png"), x: -0.3, y: -0.55, w: 10.6, h: 10.6 / RATIO, transparency: 88 });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 10, h: 5.625, fill: { color: BG, transparency: 14 } });
    s.addText("From a health worker's voice\nto a district's decision — in seconds.", {
      x: 0.55, y: 1.35, w: 8.9, h: 1.6, fontSize: 32, bold: true, color: INK, fontFace: "Arial", margin: 0, align: "left",
    });
    s.addText("One district today. 36 in Maharashtra. The decision layer India's HMIS data has been waiting for.", {
      x: 0.55, y: 3.05, w: 8.5, h: 0.6, fontSize: 16, color: MUT, fontFace: "Arial", margin: 0, align: "left",
    });
    s.addText([
      { text: "HealthGrid ", options: { color: INK, bold: true } },
      { text: "AI", options: { color: ACC, bold: true } },
      { text: "   ·   github.com/nishantr14/healthgrid   ·   Nishant Rajpathak & Saatvik", options: { color: FAINT } },
    ], { x: 0.55, y: 4.75, w: 9, h: 0.45, fontSize: 13, fontFace: "Arial", margin: 0, align: "left" });
    s.addNotes("Close on the loop: observe, understand, predict, recommend, approve, execute, monitor. Thank the judges. Offer the live demo link.");
  }

  await pres.writeFile({ fileName: "docs/HealthGrid-Pitch.pptx" });
  console.log("WROTE docs/HealthGrid-Pitch.pptx");
})();
