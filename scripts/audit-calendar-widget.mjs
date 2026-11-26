import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "evidence", "browser", "calendar-widget");
const pageUrl = "http://127.0.0.1:4174/calendar.html";
const viewports = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

async function launchEdge() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({
      executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      headless: true,
    });
  }
}

await mkdir(outputDirectory, { recursive: true });
const browser = await launchEdge();
const results = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    deviceScaleFactor: 1,
    locale: "zh-CN",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const localFailures = [];
  const badLocalResponses = [];
  const externalAttempts = [];

  await page.route("https://widgets.tradingview-widget.com/w/en/tv-economic-calendar.js**", async route => {
    externalAttempts.push(route.request().url());
    if (externalAttempts.length === 1) {
      await route.abort("failed");
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "text/javascript",
      body: `class TvEconomicCalendar extends HTMLElement{connectedCallback(){const root=this.attachShadow({mode:"open"});const test=document.createElement("div");test.dataset.testCalendar="ready";test.textContent="Calendar widget test";root.append(test)}}customElements.define("tv-economic-calendar",TvEconomicCalendar);`,
    });
  });
  page.on("requestfailed", request => {
    if (request.url().startsWith("http://127.0.0.1:4174/")) {
      localFailures.push({ url: request.url(), error: request.failure()?.errorText || "unknown" });
    }
  });
  page.on("response", response => {
    if (response.url().startsWith("http://127.0.0.1:4174/") && response.status() >= 400) {
      badLocalResponses.push({ url: response.url(), status: response.status() });
    }
  });

  const response = await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(
    () => document.querySelector("[data-economic-calendar]")?.dataset.state === "error",
    { timeout: 8000 },
  );
  const retryButton = page.locator("[data-calendar-retry]");
  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });

  const measurements = await page.evaluate(() => {
    const region = document.querySelector("[data-economic-calendar]");
    const status = region?.querySelector("[data-calendar-status]");
    const link = status?.querySelector("a");
    const rect = region?.getBoundingClientRect();
    return {
      state: region?.dataset.state,
      statusVisible: Boolean(status && !status.hidden && getComputedStyle(status).display !== "none"),
      statusTitle: status?.querySelector("[data-calendar-title]")?.textContent?.trim(),
      fallbackLink: link?.href,
      fallbackLinkVisible: Boolean(link && link.getBoundingClientRect().width > 0),
      regionHeight: Math.round(rect?.height || 0),
      bodyTextLength: document.body?.innerText?.replace(/\s+/g, " ").trim().length || 0,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      legacyMqlScriptPresent: [...document.scripts].some(script => script.src.includes("c.mql5.com/js/widgets/calendar")),
      tradingViewModulePresent: [...document.scripts].some(script =>
        script.type === "module" && script.src.includes("/w/en/tv-economic-calendar.js"),
      ),
      customElementPresent: Boolean(document.querySelector("tv-economic-calendar")),
    };
  });

  const screenshot = path.join(outputDirectory, `calendar-${viewport.name}-fallback.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  await retryButton.click();
  await page.waitForFunction(
    () => document.querySelector("[data-economic-calendar]")?.dataset.state === "ready",
    { timeout: 8000 },
  );
  const readyState = await page.evaluate(() => ({
    state: document.querySelector("[data-economic-calendar]")?.dataset.state,
    statusHidden: document.querySelector("[data-calendar-status]")?.hidden,
    customElementDefined: Boolean(customElements.get("tv-economic-calendar")),
    renderedContentPresent: Boolean(document.querySelector("tv-economic-calendar")?.shadowRoot?.childElementCount),
  }));

  const result = {
    viewport: viewport.name,
    status: response?.status() ?? null,
    externalAttempts: externalAttempts.length,
    ...measurements,
    readyState,
    noHorizontalOverflow: measurements.documentWidth <= measurements.viewportWidth,
    localFailures,
    badLocalResponses,
    screenshot: path.relative(projectRoot, screenshot),
  };
  results.push(result);
  console.log(`${viewport.name}: ${JSON.stringify(result)}`);

  await context.close();
}

await browser.close();
await writeFile(path.join(outputDirectory, "calendar-widget-audit.json"), `${JSON.stringify(results, null, 2)}\n`);

const failures = results.filter(result =>
  result.status !== 200
  || result.state !== "error"
  || !result.statusVisible
  || !result.fallbackLinkVisible
  || result.regionHeight < 200
  || result.bodyTextLength < 150
  || result.legacyMqlScriptPresent
  || !result.tradingViewModulePresent
  || !result.customElementPresent
  || result.externalAttempts < 2
  || result.readyState.state !== "ready"
  || !result.readyState.statusHidden
  || !result.readyState.customElementDefined
  || !result.readyState.renderedContentPresent
  || !result.noHorizontalOverflow
  || result.localFailures.length > 0
  || result.badLocalResponses.length > 0,
);

console.log(`Calendar widget fallback audit: ${results.length - failures.length}/${results.length} viewports pass.`);
if (failures.length) process.exitCode = 1;
