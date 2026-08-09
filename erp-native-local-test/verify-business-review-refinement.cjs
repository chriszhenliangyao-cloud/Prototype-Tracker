const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

(async () => {
  const installedChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const browser = await chromium.launch({ headless: true, executablePath: fs.existsSync(installedChrome) ? installedChrome : undefined });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  const entry = pathToFileURL(path.join(__dirname, "business-review-refinement-concept.html")).href;
  const checks = [];
  for (const view of ["expense", "forecast"]) {
    await page.goto(`${entry}?view=${view}`, { waitUntil: "load" });
    checks.push(await page.evaluate((currentView) => ({
      view: currentView,
      activeTab: document.querySelector(".tab.active")?.textContent.trim(),
      panels: document.querySelectorAll(".panel").length,
      horizontalOverflow: document.body.scrollWidth > window.innerWidth,
      verticalOverflow: document.body.scrollHeight > window.innerHeight
    }), view));
    await page.screenshot({ path: path.join(__dirname, `business-review-refinement-${view}.png`) });
  }
  await browser.close();
  console.log(JSON.stringify({ checks, errors }, null, 2));
  if (errors.length || checks.some((check) => check.horizontalOverflow || check.verticalOverflow)) process.exitCode = 1;
})().catch((error) => { console.error(error); process.exitCode = 1; });
