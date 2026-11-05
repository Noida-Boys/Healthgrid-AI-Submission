/* Records the field voice moment on the current Gnani flow for the pitch video.
   Chrome's fake mic plays the Hindi line; real Prisma + Gemini parse it.
   Stops BEFORE Confirm, so nothing is written to Firestore.
   Usage: npx tsx scripts/pitch-video/record-voice.ts <out.webm> */
import path from "path";
import puppeteer from "puppeteer-core";

const OUT = process.argv[2] as `${string}.webm`;
const FFMPEG = `${process.env.LOCALAPPDATA}\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-8.1.2-full_build\\bin\\ffmpeg.exe`;
const WAV = path.resolve("docs/demo/hindi-line.wav");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: [
      "--no-sandbox",
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-audio-capture=${WAV}`,
      "--autoplay-policy=no-user-gesture-required",
    ],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1080, height: 1920 });
  await page.goto("http://localhost:3000/field", { waitUntil: "networkidle2", timeout: 90_000 });
  await page.evaluate(() => localStorage.setItem("hg-lang", "hi"));
  await page.reload({ waitUntil: "networkidle2" });
  await page.addStyleTag({ content: "nextjs-portal{display:none!important} html{zoom:2}" });
  await sleep(1500);

  const mic = await page.waitForSelector('button[aria-label="दबाकर बोलें"]', { timeout: 30_000 });
  if (!mic) throw new Error("mic button not found");
  await mic.evaluate((el) => el.closest("section")?.scrollIntoView({ block: "start" }));
  await page.evaluate(() => window.scrollBy(0, -16));
  await sleep(600);
  const label = await page.evaluate(() => document.querySelector("section .text-\\[10px\\]")?.textContent);
  console.log("voice label:", label);

  const rec = await page.screencast({ path: OUT, ffmpegPath: FFMPEG });
  await sleep(1200);
  const box = await mic.boundingBox();
  if (!box) throw new Error("mic has no box");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await sleep(5200);
  await page.mouse.up();
  const t0 = Date.now();
  await page.waitForFunction(
    () => /पुष्टि|Confirm/.test(document.body.innerText) || /फिर से|Try again/.test(document.body.innerText),
    { timeout: 60_000 },
  );
  console.log("result after ms:", Date.now() - t0);
  await sleep(4000);
  await rec.stop();
  const card = await page.evaluate(() => document.querySelector("section")?.parentElement?.innerText ?? "");
  console.log(card.slice(0, 500));
  await page.screenshot({ path: OUT.replace(".webm", ".png") as `${string}.png` });
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
