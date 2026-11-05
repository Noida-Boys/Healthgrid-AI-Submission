/* Re-records only the copilot segment, waiting for the actual answer text. */
import puppeteer from "puppeteer-core";

const FFMPEG = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--window-size=1920,1080"],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
  await page.goto("http://localhost:3100", { waitUntil: "networkidle2", timeout: 90_000 });
  await sleep(6000);

  const rec = await page.screencast({ path: "docs/demo/seg4.webm", ffmpegPath: FFMPEG });
  await page.evaluate(() => {
    [...document.querySelectorAll<HTMLElement>("header button")].find((b) => b.textContent?.trim() === "Copilot")?.click();
  });
  await sleep(1500);
  await page.evaluate(() => {
    [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.includes("Why is Seloo critical?"))?.click();
  });
  // Wait until real answer text exists beyond the question (skeleton has none).
  // Generous timeout: free-tier per-minute limits make latency spiky.
  await page.waitForFunction(
    () => {
      const scroller = document.querySelector<HTMLElement>(".fixed .overflow-y-auto");
      return !!scroller && scroller.innerText.trim().length > "Why is Seloo critical?".length + 60;
    },
    { timeout: 90_000 },
  );
  await sleep(7000); // reading time
  await rec.stop();
  await browser.close();
  console.log("seg4 re-recorded");
})();
