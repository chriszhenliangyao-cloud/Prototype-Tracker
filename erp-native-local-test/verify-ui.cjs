const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const root = __dirname;
const entry = pathToFileURL(path.join(root, "index.html")).href;
const moduleKeys = ["forecast", "logistic", "shipment", "performance"];

(async () => {
  const installedChrome = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  const executablePath = process.env.PLAYWRIGHT_CHROME_PATH
    || (fs.existsSync(installedChrome) ? installedChrome : undefined);
  const browser = await chromium.launch({ headless: true, executablePath });
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  const errors = [];
  desktop.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  desktop.on("pageerror", (error) => errors.push(error.message));

  await desktop.goto(`${entry}#module=forecast`, { waitUntil: "load" });
  await desktop.waitForTimeout(400);
  const checks = [];

  for (const moduleKey of moduleKeys) {
    const startedAt = Date.now();
    await desktop.locator(`[data-module="${moduleKey}"]`).click();
    await desktop.waitForFunction((key) => {
      return window.location.hash === `#module=${key}`
        && document.querySelector(`[data-module="${key}"]`)?.classList.contains("active")
        && document.querySelector("#renderStatus")?.textContent === "已就绪";
    }, moduleKey);
    checks.push({
      module: moduleKey,
      switchMs: Date.now() - startedAt,
      tableRows: await desktop.locator("table tbody tr").count()
    });
    await desktop.screenshot({ path: path.join(root, `native-${moduleKey}.png`) });
  }

  await desktop.reload({ waitUntil: "load" });
  await desktop.waitForTimeout(300);
  const desktopState = await desktop.evaluate(() => ({
    title: document.title,
    activeModule: document.querySelector(".nav-item.active")?.getAttribute("data-module"),
    hash: window.location.hash,
    iframes: document.querySelectorAll("iframe").length,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await desktop.screenshot({ path: path.join(root, "native-platform-desktop.png") });

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const mobileErrors = [];
  mobile.on("console", (message) => {
    if (message.type() === "error") mobileErrors.push(message.text());
  });
  mobile.on("pageerror", (error) => mobileErrors.push(error.message));
  await mobile.goto(`${entry}#module=forecast`, { waitUntil: "load" });
  await mobile.waitForTimeout(300);
  const mobileState = await mobile.evaluate(() => ({
    sidebarDisplay: getComputedStyle(document.querySelector(".platform-sidebar")).display,
    mobilePickerDisplay: getComputedStyle(document.querySelector(".mobile-module-picker")).display,
    iframes: document.querySelectorAll("iframe").length,
    bodyWidth: document.body.scrollWidth,
    viewportWidth: window.innerWidth,
    horizontalBodyOverflow: document.body.scrollWidth > window.innerWidth
  }));
  await mobile.screenshot({ path: path.join(root, "native-platform-mobile.png") });

  await browser.close();

  const result = { checks, desktopState, mobileState, errors: [...errors, ...mobileErrors] };
  console.log(JSON.stringify(result, null, 2));
  if (result.errors.length || desktopState.iframes || mobileState.iframes || desktopState.horizontalBodyOverflow || mobileState.horizontalBodyOverflow) {
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
