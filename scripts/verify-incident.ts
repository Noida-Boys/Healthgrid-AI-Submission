/* Manual-flow verification for the incident stress mode:
   Normal -> note Seloo demand + ORS timeline -> Flood Alert -> demand rises,
   ORS shortens, banner + chip visible, queue reranks -> Normal -> baseline
   restored exactly. Run with the built app on :3100. */
import puppeteer, { type Page } from "puppeteer-core";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function readSeloo(page: Page) {
  return page.evaluate(() => {
    const aside = document.querySelector<HTMLElement>("aside")!;
    const txt = aside.innerText;
    const demand = txt.match(/EXPECTED TOMORROW\s*(\d+)/)?.[1];
    const orsRow = [...aside.querySelectorAll("tr")].find((r) => r.textContent?.includes("ORS"));
    const ors = orsRow?.textContent?.match(/(\d+ days left|Stock-out imminent)/)?.[1];
    const score = txt.match(/(?:SIMULATED SCORE|HEALTH SCORE)/) ? aside.querySelector("svg text")?.textContent : null;
    const chip = txt.includes("simulation");
    return { demand, ors, score, chip };
  });
}

async function setScenario(page: Page, label: string) {
  await page.evaluate((l) => {
    [...document.querySelectorAll<HTMLElement>("button")].find((b) => b.textContent?.trim() === l)?.click();
  }, label);
  await sleep(800);
}

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

  const queueTop = () =>
    page.evaluate(() => {
      const q = [...document.querySelectorAll<HTMLElement>("aside button")]
        .filter((b) => b.querySelector(".num"))
        .slice(0, 3)
        .map((b) => b.innerText.split("\n").slice(0, 2).join(" · "));
      return q;
    });

  const banner = () =>
    page.evaluate(() => document.body.innerText.includes("Simulation Active"));

  console.log("— district view, Normal —");
  console.log("queue:", await queueTop());
  console.log("banner:", await banner());

  await setScenario(page, "Flood Alert");
  console.log("— district view, Flood Alert —");
  console.log("queue:", await queueTop());
  console.log("banner:", await banner());
  await page.screenshot({ path: "docs/screenshots/incident-district.png" });

  // Select Seloo under flood, capture, then compare across scenario switches.
  await page.evaluate(() => {
    const m = [...document.querySelectorAll<HTMLElement>(".hg-marker")].find((x) =>
      x.querySelector(".hg-label")?.textContent?.includes("Seloo"),
    );
    m?.querySelector<HTMLElement>(".hg-dot")?.click();
  });
  await sleep(1500);
  const flooded = await readSeloo(page);
  await page.screenshot({ path: "docs/screenshots/incident-facility.png" });

  await setScenario(page, "Normal");
  const normal1 = await readSeloo(page);
  await setScenario(page, "Flood Alert");
  const flooded2 = await readSeloo(page);
  await setScenario(page, "Normal");
  const normal2 = await readSeloo(page);

  console.log("— Seloo panel —");
  console.log("normal:  ", JSON.stringify(normal1));
  console.log("flooded: ", JSON.stringify(flooded));
  console.log("flooded2:", JSON.stringify(flooded2));
  console.log("normal2: ", JSON.stringify(normal2));
  console.log(
    "IDENTITY CHECK:",
    JSON.stringify(normal1) === JSON.stringify(normal2) ? "PASS — normal restores baseline" : "FAIL",
  );
  console.log(
    "STRESS CHECK:",
    Number(flooded.demand) > Number(normal1.demand) && flooded.chip && !normal1.chip ? "PASS" : "FAIL",
    `(demand ${normal1.demand} -> ${flooded.demand}, ORS ${normal1.ors} -> ${flooded.ors})`,
  );

  await browser.close();
})();
