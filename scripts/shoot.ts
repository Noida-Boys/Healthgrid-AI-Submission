/* Captures product screenshots for README + user guide.
   Run with the dev server up: npx tsx scripts/shoot.ts */
import { mkdirSync } from "fs";
import puppeteer from "puppeteer-core";

const OUT = "docs/screenshots";
const BASE = "http://localhost:3000";

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--force-device-scale-factor=1.5"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1.5 });

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // 1. Command center: map + insights rail.
  await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60_000 });
  await sleep(6000); // map tiles + firestore snapshots + insight cards
  await page.screenshot({ path: `${OUT}/01-command-center.png` });

  // 2. Facility panel: click the Seloo marker (or list fallback button).
  const clicked = await page.evaluate(() => {
    const markers = [...document.querySelectorAll<HTMLElement>(".hg-marker")];
    const seloo = markers.find((m) => m.querySelector(".hg-label")?.textContent?.includes("Seloo"));
    if (seloo) {
      seloo.click();
      return "marker";
    }
    const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Seloo"));
    btn?.click();
    return btn ? "list" : "none";
  });
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/02-facility-panel.png` });
  console.log("facility click via:", clicked);

  // 3. Copilot drawer (suggestion chips view — no API call).
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Copilot")?.click();
  });
  await sleep(700);
  await page.screenshot({ path: `${OUT}/03-copilot.png` });

  // 4. Field screen at phone width.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/field`, { waitUntil: "networkidle2", timeout: 60_000 });
  await sleep(3000);
  await page.screenshot({ path: `${OUT}/04-field-screen.png` });

  await browser.close();
  console.log("done ->", OUT);
})();
