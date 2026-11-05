/* Field-screen design iteration shots. Run: npx tsx scripts/shoot-field.ts */
import { mkdirSync } from "fs";
import puppeteer from "puppeteer-core";

const OUT = "docs/screenshots";

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
  });
  const page = await browser.newPage();
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  // 1. Language gate (fresh storage), phone width.
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto("http://localhost:3000/field", { waitUntil: "networkidle2", timeout: 60_000 });
  await page.evaluate(() => localStorage.removeItem("hg-lang"));
  await page.reload({ waitUntil: "networkidle2" });
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/field-a-language-gate.png` });

  // 2. Pick Hindi -> main screen, phone.
  await page.evaluate(() => {
    [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("हिंदी"))?.click();
  });
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/04-field-screen.png` });

  // 3. Desktop width.
  await page.setViewport({ width: 1440, height: 860, deviceScaleFactor: 1.5 });
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/field-c-desktop.png` });

  await browser.close();
  console.log("done");
})();
