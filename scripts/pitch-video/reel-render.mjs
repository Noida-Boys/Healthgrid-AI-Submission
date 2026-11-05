// Renders the vertical reel to silent.mp4 and writes timeline.json.
// Usage: node scripts/pitch-video/reel-render.mjs <reelWorkDir> [--stills t1,t2]
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from "fs";
import { spawn, execFileSync } from "child_process";
import { pathToFileURL, fileURLToPath } from "url";
import path from "path";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2]);
const stillsArg = process.argv.indexOf("--stills");
const FFDIR = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin`;
const dur = (f) => parseFloat(execFileSync(`${FFDIR}\\ffprobe.exe`, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());

const marks = JSON.parse(readFileSync(path.join(work, "levels.json"), "utf8"));
const copy = {
  l1: { dir: "x1", title: "English", said: "“ORS 50, paracetamol 100”", note: "Test voice: Gnani Timbre", hold: 1.15 },
  l2: { dir: "v2", title: "Hindi", said: "“ओआरएस 50 बचा है, पैरासिटामोल 100”", note: "Test voice: Gnani Timbre", hold: 1.15 },
  l3: { dir: "v3", title: "Marathi", said: "“ORS ची 50 पाकिटं उरली आहेत”", note: "Test voice: Gnani Timbre", hold: 1.15 },
  l4: { dir: "x4", title: "Marathi + English in one breath", said: "“ORS ची 50 पाकिटं उरली आहेत, all the beds are full, आणि आज फक्त one doctor आला”", note: "Test voice: Gnani Timbre", hold: 1.7 },
  l5: { dir: "v5", title: "…with a pressure cooker going off", said: "“ORS ची 20 पाकिटं उरली आहेत, आणि सगळे बेड भरले आहेत”", note: "Test voice: Gnani Timbre · Simulated cooker whistle", hold: 1.0 },
};

const readbackLen = dur(path.join(work, "audio", "l5-readback48.wav"));
const at = { level1: 2.3 };
let t = at.level1;
const levels = marks.map((m) => {
  const c = copy[m.id];
  const speech = dur(path.join(work, "audio", `${m.id}-speech.wav`));
  const toCard = speech + 0.4;
  const extra = m.id === "l5" ? 0.5 + readbackLen + 0.5 : c.hold;
  const len = toCard + extra;
  const frames = readdirSync(path.join(work, c.dir)).length;
  const lv = {
    id: m.id, dir: c.dir, title: c.title, said: c.said, note: c.note, start: t, len, speech, toCard,
    down: m.tDown / 1000 + 0.35, up: m.tUp / 1000, card: m.tCard / 1000 + 0.25, lastT: (frames - 1) / 30,
    readback: m.id === "l5" ? m.echo : null, echo: m.echo,
  };
  t += len;
  return lv;
});
at.map = t;
at.built = at.map + 5.7;
at.end = at.built + 3.1;
const total = at.end + 2.7;
at.total = total;
const TL = { at, total, levels, base: pathToFileURL(work).href, readbackLen };
writeFileSync(path.join(work, "timeline.json"), JSON.stringify(TL, null, 1));
console.log("total", total.toFixed(2), levels.map((l) => `${l.id}@${l.start.toFixed(1)}+${l.len.toFixed(1)}`).join(" "), "map", at.map.toFixed(1));

const browser = await puppeteer.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true, args: ["--no-sandbox", "--allow-file-access-from-files", "--disable-web-security", "--force-color-profile=srgb"], protocolTimeout: 300000 });
const page = await browser.newPage();
await page.setViewport({ width: 1080, height: 1920 });
await page.evaluateOnNewDocument((tl) => { window.__TL = tl; }, TL);
page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
await page.goto(pathToFileURL(path.join(here, "reel.html")).href, { waitUntil: "networkidle0", timeout: 120000 });
await page.evaluate(async () => {
  const faces = ["500 40px 'IBM Plex Sans'", "600 40px 'IBM Plex Sans'", "700 40px 'IBM Plex Sans'", "700 40px 'Source Serif 4'", "600 40px 'Source Serif 4'"];
  await Promise.all(faces.map((f) => document.fonts.load(f, "Abc→…·@+")));
  await Promise.all(["500 40px 'Noto Sans Devanagari'", "600 40px 'Noto Sans Devanagari'", "700 40px 'Noto Sans Devanagari'"].map((f) => document.fonts.load(f, "ओआरएस पाकिटं")));
  await document.fonts.ready;
});

if (stillsArg > 0) {
  const dir = path.join(work, "stills");
  mkdirSync(dir, { recursive: true });
  let i = 0;
  for (const s of process.argv[stillsArg + 1].split(",")) {
    await page.evaluate((x) => window.seek(x), parseFloat(s));
    await page.screenshot({ path: path.join(dir, `s${String(i++).padStart(2, "0")}.jpg`), type: "jpeg", quality: 82 });
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn(`${FFDIR}\\ffmpeg.exe`, ["-y", "-v", "error", "-f", "image2pipe", "-framerate", "30", "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p", path.join(work, "silent.mp4")], { stdio: ["pipe", "inherit", "inherit"] });
const n = Math.ceil(total * 30);
for (let i = 0; i < n; i++) {
  await page.evaluate((x) => window.seek(x), i / 30);
  const buf = await page.screenshot({ type: "jpeg", quality: 97 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("rendered", n, "frames");
