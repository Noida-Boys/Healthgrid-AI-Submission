// Renders compose.html frame by frame to a silent MP4 and writes timeline.json.
// Usage: node scripts/pitch-video/render.mjs <workDir> [--stills t1,t2,...]
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "fs";
import { spawn, execFileSync } from "child_process";
import { pathToFileURL, fileURLToPath } from "url";
import path from "path";
import puppeteer from "puppeteer-core";

const here = path.dirname(fileURLToPath(import.meta.url));
const work = path.resolve(process.argv[2]);
const stillsArg = process.argv.indexOf("--stills");
const FFDIR = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin`;
const FPS = 30;

const dur = (f) => parseFloat(execFileSync(`${FFDIR}\\ffprobe.exe`, ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f]).toString());
const vo = (id) => dur(path.join(work, "vo48", `${id}.wav`));

// Beat sheet: id, seconds of silence before it starts.
const seq = [["hook", 0.7], ["problem", 0.55], ["reveal", 0.75], ["voice1", 0.6], ["hindi", 0.2], ["voice2", 0.35], ["command", 0.4], ["acts", 0.45], ["stress", 0.4], ["trust", 0.45], ["scale", 0.45], ["ask", 0.5], ["close", 0.5]];
const at = {};
let t = 0;
const lens = {};
for (const [id, gap] of seq) {
  t += gap;
  at[id] = t;
  lens[id] = id === "hindi" ? dur(path.join(work, "hindi48.wav")) : vo(id);
  t += lens[id];
}
at.end = t + 0.45;
at.total = at.end + 4.4;

const clips = {};
for (const c of ["f1", "f2", "f4", "f6", "f8", "voice"]) clips[c] = { frames: readdirSync(path.join(work, c)).length };
const TL = {
  at, lens, clips, total: at.total, hindiLen: lens.hindi,
  base: pathToFileURL(work).href,
  btn: { x: 1612, y: 339, w: 118, h: 32 },
};
writeFileSync(path.join(work, "timeline.json"), JSON.stringify(TL, null, 1));
console.log("total", at.total.toFixed(2), JSON.stringify(Object.fromEntries(Object.entries(at).map(([k, v]) => [k, +v.toFixed(2)]))));

const browser = await puppeteer.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
  args: ["--no-sandbox", "--allow-file-access-from-files", "--disable-web-security", "--force-color-profile=srgb"],
  protocolTimeout: 300000,
});
const page = await browser.newPage();
await page.setViewport({ width: 1920, height: 1080 });
await page.evaluateOnNewDocument((tl) => { window.__TL = tl; }, TL);
page.on("pageerror", (e) => console.error("PAGE ERROR", e.message));
await page.goto(pathToFileURL(path.join(here, "compose.html")).href, { waitUntil: "networkidle0", timeout: 120000 });
await page.evaluate(async () => {
  // font-display:block hides text until loaded, so load every face up front.
  const faces = ["400 40px 'Source Serif 4'", "600 40px 'Source Serif 4'", "700 40px 'Source Serif 4'", "400 40px 'IBM Plex Sans'", "500 40px 'IBM Plex Sans'", "600 40px 'IBM Plex Sans'"];
  await Promise.all(faces.map((f) => document.fonts.load(f, "Abc’→·~")));
  await Promise.all(["400 40px 'Noto Sans Devanagari'", "600 40px 'Noto Sans Devanagari'"].map((f) => document.fonts.load(f, "आज ओ आर एस स्टॉक")));
  await document.fonts.ready;
});

if (stillsArg > 0) {
  const dir = path.join(work, "stills");
  mkdirSync(dir, { recursive: true });
  for (const f of readdirSync(dir)) void f;
  const names = process.argv[stillsArg + 1].split(",");
  for (const n of names) {
    const m = /^([a-z0-9]+)([+-][\d.]+)?$/i.exec(n);
    const time = at[m[1]] + (m[2] ? parseFloat(m[2]) : 0);
    await page.evaluate((x) => window.seek(x), time);
    await page.screenshot({ path: path.join(dir, `${n.replace(/[+]/g, "_")}.jpg`), type: "jpeg", quality: 80 });
  }
  await browser.close();
  process.exit(0);
}

const ff = spawn(`${FFDIR}\\ffmpeg.exe`, ["-y", "-v", "error", "-f", "image2pipe", "-framerate", String(FPS), "-c:v", "mjpeg", "-i", "-", "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", path.join(work, "silent.mp4")], { stdio: ["pipe", "inherit", "inherit"] });
const total = Math.ceil(at.total * FPS);
const started = Date.now();
for (let i = 0; i < total; i++) {
  await page.evaluate((x) => window.seek(x), i / FPS);
  const buf = await page.screenshot({ type: "jpeg", quality: 97 });
  if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once("drain", r));
  if (i % 300 === 0) console.log(`frame ${i}/${total} ${((Date.now() - started) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
await new Promise((r) => ff.on("close", r));
await browser.close();
console.log("rendered", total, "frames in", ((Date.now() - started) / 1000).toFixed(0), "s");
