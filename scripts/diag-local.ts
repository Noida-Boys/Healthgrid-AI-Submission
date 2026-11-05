import puppeteer from "puppeteer-core";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({
    executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    headless: true,
    args: ["--window-size=1600,1000"],
  });
  const p = await b.newPage();
  await p.setViewport({ width: 1600, height: 1000 });
  const errors: string[] = [];
  p.on("console", (m) => {
    if (m.type() === "error" || m.type() === "warn") errors.push(`[${m.type()}] ${m.text()}`);
  });
  p.on("pageerror", (e) => errors.push(`[pageerror] ${e instanceof Error ? e.message : String(e)}`));
  await p.goto("http://localhost:3000", { waitUntil: "networkidle2", timeout: 90_000 });
  await sleep(9000);
  const state = await p.evaluate(() => {
    const header = document.querySelector("header")?.innerText.replace(/\n/g, " ") ?? "";
    return {
      header: header.slice(0, 130),
      googleMapRendered: !!document.querySelector(".gm-style"),
      markers: document.querySelectorAll(".hg-marker").length,
      mapError: document.querySelector(".gm-err-message, .gm-err-title")?.textContent ?? null,
    };
  });
  console.log("STATE:", JSON.stringify(state, null, 1));
  console.log("CONSOLE ERRORS/WARNINGS:");
  const uniq = [...new Set(errors)].filter((e) => !e.includes("Fast Refresh")).slice(0, 10);
  uniq.forEach((e) => console.log("  " + e.slice(0, 200)));
  if (uniq.length === 0) console.log("  (none)");
  await p.screenshot({ path: "docs/screenshots/local-check.png" });
  await b.close();
})();
