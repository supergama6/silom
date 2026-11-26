import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceDirectory = path.join(projectRoot, "evidence", "browser", "kos-calendar-source");
const sourceUrl = "https://www.kosmarkets.com/tools/economic-calendar";
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

await mkdir(evidenceDirectory, { recursive: true });
const browser = await launchEdge();
const results = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    deviceScaleFactor: 1,
    locale: "en-US",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();
  const failedRequests = [];
  const errors = [];
  page.on("requestfailed", request => failedRequests.push({
    url: request.url(),
    error: request.failure()?.errorText || "unknown",
  }));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });

  let response = null;
  let navigationError = null;
  try {
    response = await page.goto(sourceUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForTimeout(3500);
  } catch (error) {
    navigationError = error.message.split("\n")[0];
  }

  let geometry = null;
  for (let attempt = 0; attempt < 4 && !geometry; attempt += 1) {
    try {
      geometry = await page.evaluate(() => {
    const iframe = document.querySelector("iframe[title*=TradingView], iframe[src*=tradingview-widget]");
    const wrapper = iframe?.closest(".iframe");
    const rect = element => element?.getBoundingClientRect().toJSON() ?? null;
    const style = element => element ? {
      width: getComputedStyle(element).width,
      height: getComputedStyle(element).height,
      padding: getComputedStyle(element).padding,
    } : null;
    return {
      title: document.title,
      bodyText: document.body?.innerText?.replace(/\s+/g, " ").trim().slice(0, 500) || "",
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      iframeSource: iframe?.src ?? null,
      iframeTitle: iframe?.title ?? null,
      iframeRect: rect(iframe),
      wrapperRect: rect(wrapper),
      wrapperStyle: style(wrapper),
      hasEconomicCalendarRoute: location.pathname === "/tools/economic-calendar",
    };
      });
    } catch {
      await page.waitForTimeout(1000);
    }
  }
  geometry ??= { title: "", bodyText: "", document: { width: 0, height: 0 }, iframeSource: null, iframeTitle: null, iframeRect: null, wrapperRect: null, wrapperStyle: null, hasEconomicCalendarRoute: false };

  const screenshot = path.join(evidenceDirectory, `kos-calendar-${viewport.name}.png`);
  if (!navigationError && response?.status() === 200) {
    await page.screenshot({ path: screenshot, fullPage: true });
  }
  results.push({
    viewport: viewport.name,
    status: response?.status() ?? null,
    navigationError,
    ...geometry,
    screenshot: navigationError ? null : path.relative(projectRoot, screenshot),
    failedRequests,
    consoleErrors: errors,
  });
  console.log(JSON.stringify(results.at(-1)));
  await context.close();
}

await browser.close();
await writeFile(path.join(evidenceDirectory, "capture.json"), `${JSON.stringify(results, null, 2)}\n`);
