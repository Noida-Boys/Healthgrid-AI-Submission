/* Records each reel level in the real field app: fake mic plays the level's WAV,
   the real browser recorder + Prisma + Gemini run. Stops BEFORE Confirm, so nothing is written to Firestore.
   Usage: npx tsx scripts/pitch-video/record-levels.ts <workDir> */
import { readFileSync, writeFileSync } from "fs";
import path from "path";
import puppeteer from "puppeteer-core";

const work = path.resolve(process.argv[2]);
const FFMPEG = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const only = process.argv[3]?.split(",");
const levels = ( JSON.parse(readFileSync(path.join(work, "audio/results.json"), "utf8")) as { id: string; code: string; seconds: number }[]).filter((l) => !only || only.includes(l.id));

const MIC_LABEL: Record<string, string> = { en: "Hold to talk", hi: "दबाकर बोलें", mr: "दाबून बोला" };

(async () => {
  const report: ({ id: string } & Record<string, unknown>)[] = [];
  for (const lv of levels) {
    const browser = await puppeteer.launch({
      executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      headless: true,
      args: ["--no-sandbox", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", `--use-file-for-fake-audio-capture=${path.join(work, "audio", `${lv.id}.wav`)}`, "--autoplay-policy=no-user-gesture-required"],
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1080, height: 1920 });
    let voiceBody: Record<string, unknown> | null = null;
    page.on("response", async (res) => {
      try {
        if (res.url().endsWith("/api/ai/voice")) voiceBody = await res.json();
      } catch {}
    });
    await page.goto("http://localhost:3000/field", { waitUntil: "networkidle2", timeout: 90_000 });
    await page.evaluate((c) => localStorage.setItem("hg-lang", c), lv.code);
    await page.reload({ waitUntil: "networkidle2" });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important} html{zoom:2} @keyframes hgtick{from{opacity:.2}to{opacity:.9}} body::after{content:'';position:fixed;right:0;bottom:0;width:3px;height:3px;background:#123;animation:hgtick .2s infinite alternate}" });
    await sleep(1500);

    const mic = await page.evaluateHandle(() => {
      const hold = [...document.querySelectorAll("button")].find((b) => b.className.includes("rounded-full") && b.getAttribute("aria-label"));
      return hold ?? null;
    });
    const el = mic.asElement() as import("puppeteer-core").ElementHandle<HTMLButtonElement> | null;
    if (!el) throw new Error(`mic not found (${lv.id}), expected ${MIC_LABEL[lv.code]}`);
    await el.evaluate((n) => n.closest("section")?.scrollIntoView({ block: "start" }));
    await page.evaluate(() => window.scrollBy(0, -60));
    await sleep(500);

    const t0 = Date.now();
    const rec = await page.screencast({ path: path.join(work, `${lv.id}.webm`) as `${string}.webm`, ffmpegPath: FFMPEG });
    await sleep(900);
    const box = await el.boundingBox();
    if (!box) throw new Error("mic has no box");
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const tDown = Date.now() - t0;
    await page.mouse.down();
    await sleep(lv.seconds * 1000 + Number(process.env.HOLD_EXTRA_MS ?? 500));
    await page.mouse.up();
    const tUp = Date.now() - t0;
    for (let i = 0; i < 600 && !voiceBody; i++) await sleep(100);
    const tCard = Date.now() - t0;
    await sleep(3500);
    await rec.stop();
    const hasConfirm = await page.evaluate(() => !!document.querySelector("section button.flex-1"));
    await browser.close();
    const b = voiceBody as Record<string, unknown> | null;
    report.push({ id: lv.id, tDown, tUp, tCard, hasConfirm, updates: b?.updates, confidence: b?.confidence, transcript: b?.transcript, echo: b?.echo });
    console.log(lv.id, hasConfirm ? "CARD" : "NO-CARD", "conf", b?.confidence, JSON.stringify(b?.updates), "|", b?.transcript);
  }
  const file = path.join(work, "levels.json");
  let prev: { id: string }[] = [];
  try { prev = JSON.parse(readFileSync(file, "utf8")); } catch {}
  const ids = new Set(report.map((r) => r.id));
  writeFileSync(file, JSON.stringify([...prev.filter((p) => !ids.has(p.id)), ...report].sort((a, b) => a.id.localeCompare(b.id)), null, 1));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
