// One-off: screenshots of the notification center + field inbox for the deck.
import puppeteer from "puppeteer-core";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const b = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--window-size=1600,1000", "--hide-scrollbars"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 2 });

  // Command center: select Seloo PHC, capture the notification center card.
  await p.goto("http://localhost:3000", { waitUntil: "networkidle2", timeout: 90_000 });
  await sleep(9000);
  await p.evaluate(() => {
    const markers = [...document.querySelectorAll<HTMLElement>(".hg-marker")];
    const seloo = markers.find((m) => m.textContent?.includes("Seloo") || m.title?.includes("Seloo")) ?? markers[0];
    seloo?.click();
  });
  await sleep(4000);
  const card = await p.$("section[aria-labelledby='notification-center-title']");
  if (card) {
    await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await sleep(500);
    await card.screenshot({ path: "docs/screenshots/notify-center.png" });
    console.log("notify-center.png OK");
  } else {
    console.log("notification center card NOT FOUND");
    await p.screenshot({ path: "docs/screenshots/notify-debug.png" });
  }

  // Field view: mobile-ish frame with the inbox visible.
  const f = await b.newPage();
  await f.setViewport({ width: 430, height: 900, deviceScaleFactor: 2 });
  await f.evaluateOnNewDocument(() => localStorage.setItem("hg-lang", "hi"));
  await f.goto("http://localhost:3000/field", { waitUntil: "networkidle2", timeout: 90_000 });
  await sleep(7000);
  await f.screenshot({ path: "docs/screenshots/field-inbox.png" });
  console.log("field-inbox.png OK");

  await b.close();
})();
