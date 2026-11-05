/* Records the FULL end-to-end demo (~4 min) — every capability including the
   incident stress mode. Same technique as record-demo.ts: production app on
   :3100, Gemini TTS wav as the fake microphone for the real Hindi voice beat.
   Run: npx tsx scripts/record-demo-full.ts */
import { mkdirSync } from "fs";
import path from "path";
import puppeteer, { type Page } from "puppeteer-core";

const BASE = "http://localhost:3100";
const OUT = "docs/demo/full";
const FFMPEG = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe`;
const WAV = path.resolve("docs/demo/hindi-line.wav");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function record(page: Page, file: string, action: () => Promise<void>) {
  const rec = await page.screencast({ path: `${OUT}/${file}` as `${string}.webm`, ffmpegPath: FFMPEG });
  try {
    await action();
  } finally {
    await rec.stop();
  }
  console.log("recorded", file);
}

async function clickText(page: Page, sel: string, text: string, exact = false) {
  const ok = await page.evaluate(
    (s, t, ex) => {
      const el = [...document.querySelectorAll<HTMLElement>(s)].find((e) =>
        ex ? e.textContent?.trim() === t : e.textContent?.includes(t),
      );
      el?.click();
      return !!el;
    },
    sel,
    text,
    exact,
  );
  if (!ok) throw new Error(`click failed: ${sel} "${text}"`);
}

async function clickSeloo(page: Page) {
  await page.evaluate(() => {
    const m = [...document.querySelectorAll<HTMLElement>(".hg-marker")].find((x) =>
      x.querySelector(".hg-label")?.textContent?.includes("Seloo"),
    );
    m?.querySelector<HTMLElement>(".hg-dot")?.click();
  });
}

async function scrollAside(page: Page, steps: number, px = 170, pause = 1300) {
  for (let i = 0; i < steps; i++) {
    await page.evaluate((d) => document.querySelector("aside")?.scrollBy({ top: d, behavior: "smooth" }), px);
    await sleep(pause);
  }
}

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: [
      "--window-size=1920,1080",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${WAV}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // ---- 1. The district at a glance (12s) ----
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 90_000 });
  await sleep(7000);
  await record(page, "f1.webm", async () => sleep(12000).then(() => {}));

  // ---- 2. Click Seloo -> panel deep dive (18s) ----
  await record(page, "f2.webm", async () => {
    await sleep(600);
    await clickSeloo(page);
    await sleep(2600);
    await scrollAside(page, 6);
    await sleep(1500);
  });

  // ---- 3. Back to district: intervention queue + AI analysis (16s) ----
  await page.evaluate(() => document.querySelector("aside")?.scrollTo({ top: 0 }));
  await clickText(page, "aside button", "Back to district");
  await sleep(1200);
  await record(page, "f3.webm", async () => {
    await sleep(2500);
    await scrollAside(page, 5, 180, 1500);
    await sleep(2000);
    await page.evaluate(() => document.querySelector("aside")?.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(1500);
  });

  // ---- 4. Approve the ORS transfer (11s) ----
  await record(page, "f4.webm", async () => {
    await sleep(2000);
    await clickText(page, "aside button", "Approve transfer");
    await sleep(7500);
  });

  // ---- 5. Copilot: English then Hindi (long, waits for real answers) ----
  await record(page, "f5.webm", async () => {
    await clickText(page, "header button", "Copilot", true);
    await sleep(1500);
    await clickText(page, ".fixed button", "Why is Seloo critical?");
    await page
      .waitForFunction(
        () => {
          const sc = document.querySelector<HTMLElement>(".fixed .overflow-y-auto");
          return !!sc && sc.innerText.trim().length > 120;
        },
        { timeout: 90_000 },
      )
      .catch(() => {});
    await sleep(7000);
    // Hindi follow-up, typed on camera.
    await page.type(".fixed input", "कौन सी दवाइयाँ खत्म होने वाली हैं?", { delay: 45 });
    await sleep(600);
    const before = await page.evaluate(
      () => document.querySelector<HTMLElement>(".fixed .overflow-y-auto")!.innerText.length,
    );
    await clickText(page, ".fixed button", "Send", true);
    await page
      .waitForFunction(
        (n) => {
          const sc = document.querySelector<HTMLElement>(".fixed .overflow-y-auto");
          return !!sc && sc.innerText.length > n + 80;
        },
        { timeout: 90_000 },
        before + 40, // question echoes immediately; wait for more than that
      )
      .catch(() => {});
    await sleep(8000);
  });
  await page.evaluate(() => {
    [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.getAttribute("aria-label") === "Close copilot")?.click();
  });
  await sleep(800);

  // ---- 6. Incident stress mode (38s) ----
  await record(page, "f6.webm", async () => {
    await sleep(1500);
    await clickText(page, "button", "Flood Alert", true);
    await sleep(5000); // banner + queue absorb
    await clickSeloo(page);
    await sleep(3000);
    await scrollAside(page, 3, 200, 1500); // chip, simulated score, adjusted demand, shortened supply
    await sleep(2500);
    await clickText(page, "button", "Heatwave", true);
    await sleep(4500);
    await clickText(page, "button", "Normal", true);
    await sleep(3500); // baseline restored on camera
    await page.evaluate(() => document.querySelector("aside")?.scrollTo({ top: 0 }));
    await clickText(page, "aside button", "Back to district");
    await sleep(1500);
  });

  // ---- 7. Field worker: language gate + Hindi voice (35s) ----
  const field = await browser.newPage();
  await field.setViewport({ width: 1920, height: 1080 });
  await field.goto(`${BASE}/field`, { waitUntil: "networkidle2", timeout: 60_000 });
  await field.evaluate(() => localStorage.removeItem("hg-lang"));
  await field.reload({ waitUntil: "networkidle2" });
  await sleep(1500);
  await record(field, "f7.webm", async () => {
    await sleep(2500);
    await clickText(field, "button", "हिंदी");
    await sleep(3000);
    const mic = await field.$('button[aria-label="दबाकर बोलें"]');
    const box = (await mic!.boundingBox())!;
    await field.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await field.mouse.down();
    await sleep(6000);
    await field.mouse.up();
    await field.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("पुष्टि करें")),
      { timeout: 45_000 },
    );
    await sleep(4000);
    await clickText(field, "button", "पुष्टि करें");
    await sleep(4000);
  });

  // ---- 8. The district reacted (12s) ----
  await page.bringToFront();
  await record(page, "f8.webm", async () => {
    await sleep(2500);
    await clickSeloo(page);
    await sleep(8000);
  });

  await browser.close();
  console.log("all full-demo segments done");
})();
