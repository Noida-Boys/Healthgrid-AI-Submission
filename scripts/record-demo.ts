/* Records the demo video segments by driving the production app in Chrome.
   The Hindi voice moment is real: Chrome's fake microphone is fed the Gemini
   TTS wav, so the actual speech→Gemini→structured-update pipeline runs on
   camera. Run: npx tsx scripts/record-demo.ts */
import { mkdirSync } from "fs";
import path from "path";
import puppeteer, { type Page } from "puppeteer-core";

const BASE = "http://localhost:3100";
const OUT = "docs/demo";
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

async function clickByText(page: Page, selector: string, text: string) {
  const ok = await page.evaluate(
    (sel, t) => {
      const el = [...document.querySelectorAll<HTMLElement>(sel)].find((e) => e.textContent?.includes(t));
      if (el) el.click();
      return !!el;
    },
    selector,
    text,
  );
  if (!ok) throw new Error(`clickByText failed: ${selector} "${text}"`);
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

  // ---- Seg 1: the district at a glance ----
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 90_000 });
  await sleep(7000); // map tiles + insights settle before the tape rolls
  await record(page, "seg1.webm", async () => {
    await sleep(9000);
  });

  // ---- Seg 2: click Seloo -> the panel explains why ----
  await record(page, "seg2.webm", async () => {
    await sleep(500);
    await page.evaluate(() => {
      const m = [...document.querySelectorAll<HTMLElement>(".hg-marker")].find((x) =>
        x.querySelector(".hg-label")?.textContent?.includes("Seloo"),
      );
      m?.querySelector<HTMLElement>(".hg-dot")?.click();
      m?.click();
    });
    await sleep(2500);
    // Slow scroll through the panel: breakdown -> demand -> inventory.
    for (let i = 0; i < 5; i++) {
      await page.evaluate(() => document.querySelector("aside")?.scrollBy({ top: 150, behavior: "smooth" }));
      await sleep(1400);
    }
    await sleep(1200);
  });

  // ---- Seg 3: back to district -> approve the ORS transfer ----
  await page.evaluate(() => document.querySelector("aside")?.scrollTo({ top: 0 }));
  await clickByText(page, "aside button", "Back to district");
  await sleep(1500);
  await record(page, "seg3.webm", async () => {
    await sleep(1500);
    await clickByText(page, "aside button", "Approve transfer");
    await sleep(6500); // transaction executes; scores + ticker react
  });

  // ---- Seg 4: copilot ----
  await record(page, "seg4.webm", async () => {
    await clickByText(page, "header button", "Copilot");
    await sleep(1200);
    await clickByText(page, "div[aria-hidden='false'] button, .fixed button", "Why is Seloo critical?");
    // Wait for a model reply bubble to appear (up to 20s).
    await page
      .waitForFunction(() => document.querySelectorAll(".fixed .space-y-2 > div").length >= 2, { timeout: 20_000 })
      .catch(() => {});
    await sleep(6000); // reading time
  });
  await page.evaluate(() => {
    [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.getAttribute("aria-label") === "Close copilot")?.click();
  });

  // ---- Seg 5: the field worker speaks Hindi ----
  const field = await browser.newPage();
  await field.setViewport({ width: 1920, height: 1080 });
  await field.goto(`${BASE}/field`, { waitUntil: "networkidle2", timeout: 60_000 });
  await field.evaluate(() => localStorage.removeItem("hg-lang"));
  await field.reload({ waitUntil: "networkidle2" });
  await sleep(1500);
  await record(field, "seg5.webm", async () => {
    await sleep(2000);
    await clickByText(field, "button", "हिंदी"); // language-first onboarding, on camera
    await sleep(2500);
    const mic = await field.$('button[aria-label="दबाकर बोलें"]');
    if (!mic) throw new Error("mic button not found");
    const box = (await mic.boundingBox())!;
    await field.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await field.mouse.down(); // fake mic starts feeding the Gemini TTS wav
    await sleep(6000); // clip is 4.25s
    await field.mouse.up();
    // Wait for the confirmation card (Gemini parses the audio), then confirm.
    await field.waitForFunction(
      () => [...document.querySelectorAll("button")].some((b) => b.textContent?.includes("पुष्टि करें")),
      { timeout: 30_000 },
    );
    await sleep(3500); // let the viewer read the parsed updates
    await clickByText(field, "button", "पुष्टि करें");
    await sleep(3500); // "अपडेट हो गया"
  });

  // ---- Seg 6: the district reacted ----
  await page.bringToFront();
  await record(page, "seg6.webm", async () => {
    await sleep(2000);
    await page.evaluate(() => {
      const m = [...document.querySelectorAll<HTMLElement>(".hg-marker")].find((x) =>
        x.querySelector(".hg-label")?.textContent?.includes("Seloo"),
      );
      m?.querySelector<HTMLElement>(".hg-dot")?.click();
    });
    await sleep(6000); // panel shows the voice-updated stocks; ticker logs it
  });

  await browser.close();
  console.log("all segments done");
})();
