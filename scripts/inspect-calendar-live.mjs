import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "evidence", "browser", "calendar-widget-live");
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
  const failedRequests = [];
  const badResponses = [];
  const tradingViewResponses = [];

  await page.addInitScript(() => {
    const nativeAttachShadow = Element.prototype.attachShadow;
    Element.prototype.attachShadow = function attachInspectableShadow(options) {
      return nativeAttachShadow.call(this, { ...options, mode: "open" });
    };
  });

  page.on("requestfailed", request => {
    failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "unknown" });
  });
  page.on("response", response => {
    if (response.url().includes("tradingview")) {
      tradingViewResponses.push({ url: response.url(), status: response.status() });
    }
    if (response.status() >= 400) badResponses.push({ url: response.url(), status: response.status() });
  });

  const response = await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  let waitError = null;
  let widgetFrame = null;
  try {
    const startedAt = Date.now();
    while (!widgetFrame && Date.now() - startedAt < 30000) {
      widgetFrame = page.frames().find(frame => frame.url().includes("/embed-widget/events/")) || null;
      if (!widgetFrame) await page.waitForTimeout(100);
    }
    if (!widgetFrame) throw new Error("TradingView calendar iframe was not created.");
    await widgetFrame.waitForFunction(
      () => (document.body?.innerText?.replace(/\s+/g, " ").trim().length || 0) > 100,
      { timeout: 30000 },
    );
    await page.waitForTimeout(2000);
  } catch (error) {
    waitError = error.message;
  }

  await page.addStyleTag({ content: "*,*::before,*::after{animation:none!important;transition:none!important}" });
  const measurements = await page.evaluate(() => {
    const region = document.querySelector("[data-economic-calendar]");
    const calendar = region?.querySelector("tv-economic-calendar");
    const status = region?.querySelector("[data-calendar-status]");
    const regionRect = region?.getBoundingClientRect();
    const calendarRect = calendar?.getBoundingClientRect();
    return {
      state: region?.dataset.state,
      statusHidden: status?.hidden,
      modulePresent: [...document.scripts].some(script =>
        script.type === "module" && script.src.includes("/w/en/tv-economic-calendar.js"),
      ),
      customElementDefined: Boolean(customElements.get("tv-economic-calendar")),
      shadowRootAccessible: Boolean(calendar?.shadowRoot),
      shadowText: calendar?.shadowRoot?.textContent?.replace(/\s+/g, " ").trim().slice(0, 500) || "",
      shadowElementCount: calendar?.shadowRoot?.querySelectorAll("*").length || 0,
      regionHeight: Math.round(regionRect?.height || 0),
      calendarWidth: Math.round(calendarRect?.width || 0),
      calendarHeight: Math.round(calendarRect?.height || 0),
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    };
  });
  const frameMeasurements = widgetFrame
    ? await widgetFrame.evaluate(() => ({
        widgetFrameUrl: location.href,
        widgetFrameText: document.body?.innerText?.replace(/\s+/g, " ").trim().slice(0, 1000) || "",
        widgetFrameElementCount: document.body?.querySelectorAll("*").length || 0,
      }))
    : { widgetFrameUrl: null, widgetFrameText: "", widgetFrameElementCount: 0 };

  const screenshot = path.join(outputDirectory, `calendar-${viewport.name}-live.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  const result = {
    viewport: viewport.name,
    status: response?.status() ?? null,
    ...measurements,
    ...frameMeasurements,
    noHorizontalOverflow: measurements.documentWidth <= measurements.viewportWidth,
    waitError,
    tradingViewResponses,
    failedRequests,
    badResponses,
    screenshot: path.relative(projectRoot, screenshot),
  };
  results.push(result);
  console.log(`${viewport.name}: ${JSON.stringify(result)}`);
  await context.close();
}

await browser.close();
await writeFile(
  path.join(outputDirectory, "calendar-widget-live.json"),
  `${JSON.stringify(results, null, 2)}\n`,
);

const failures = results.filter(result =>
  result.status !== 200
  || result.state !== "ready"
  || !result.statusHidden
  || !result.modulePresent
  || !result.customElementDefined
  || result.widgetFrameText.length < 100
  || result.widgetFrameElementCount < 20
  || result.regionHeight < 500
  || result.calendarWidth < 300
  || result.calendarHeight < 500
  || !result.noHorizontalOverflow
  || result.waitError
  || result.failedRequests.some(request =>
    request.url.includes("widgets.tradingview-widget.com")
    || request.url.startsWith("http://127.0.0.1:4174/"),
  )
  || result.badResponses.some(response =>
    response.url.includes("widgets.tradingview-widget.com")
    || response.url.startsWith("http://127.0.0.1:4174/"),
  ),
);

console.log(`Live TradingView calendar audit: ${results.length - failures.length}/${results.length} viewports pass.`);
if (failures.length) process.exitCode = 1;
