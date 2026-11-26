import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "evidence", "browser", "pages-audit");
const baseUrl = "http://127.0.0.1:4174/";

const pages = [
  "cfds-vs-stock-trading.html",
  "is-cfd-trading-for-me.html",
  "benefits-of-trading-cfds.html",
  "how-to-use-macd-for-beginners.html",
  "best-trading-strategies-for-beginners.html",
  "trading-with-trend-lines-for-beginners.html",
  "everything-you-need-to-know-about-spot-trading.html",
  "trading-accounts.html",
  "markets.html",
  "forex.html",
  "precious-metal.html",
  "energies.html",
  "indices.html",
  "MetaTrader4.html",
  "market-analysis.html",
  "calendar.html",
  "about-us.html",
  "contact.html",
];

const screenshotPages = new Set([
  "cfds-vs-stock-trading.html",
  "trading-accounts.html",
  "markets.html",
  "forex.html",
  "MetaTrader4.html",
  "market-analysis.html",
  "calendar.html",
  "about-us.html",
  "contact.html",
]);

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

function isVisible(element) {
  if (!element) return false;
  const style = getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return style.display !== "none"
    && style.visibility !== "hidden"
    && Number(style.opacity) !== 0
    && rect.width > 0
    && rect.height > 0;
}

await mkdir(outputRoot, { recursive: true });
const browser = await launchEdge();
const report = [];

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.isMobile,
    deviceScaleFactor: 1,
    locale: "en-US",
    reducedMotion: "reduce",
    colorScheme: "light",
  });

  for (const pageName of pages) {
    const page = await context.newPage();
    const consoleErrors = [];
    const failedLocalRequests = [];
    const badLocalResponses = [];

    page.on("console", (message) => {
      if (message.type() === "error") consoleErrors.push(message.text());
    });
    page.on("requestfailed", (request) => {
      if (request.url().startsWith(baseUrl)) {
        failedLocalRequests.push({
          url: request.url(),
          error: request.failure()?.errorText || "unknown",
        });
      }
    });
    page.on("response", (resourceResponse) => {
      if (resourceResponse.url().startsWith(baseUrl) && resourceResponse.status() >= 400) {
        badLocalResponses.push({
          url: resourceResponse.url(),
          status: resourceResponse.status(),
        });
      }
    });

    const target = new URL(pageName, baseUrl).href;
    let response;
    let navigationError = null;
    try {
      response = await page.goto(target, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(1200);
      await page.evaluate(() => document.fonts?.ready);
    } catch (error) {
      navigationError = error.message.split("\n")[0];
    }

    const metrics = await page.evaluate(isVisibleFunction => {
      const visible = new Function(`return (${isVisibleFunction})`)();
      const bodyText = document.body?.innerText?.replace(/\s+/g, " ").trim() || "";
      const preloader = document.querySelector("#preloader, .preloader");
      const contentCandidates = [...document.querySelectorAll("main, section")];
      return {
        title: document.title,
        bodyTextLength: bodyText.length,
        bodyTextPreview: bodyText.slice(0, 180),
        scrollHeight: document.documentElement.scrollHeight,
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        headerVisible: visible(document.querySelector("header, .header-section, .header-main")),
        mainVisible: contentCandidates.some(visible),
        footerVisible: visible(document.querySelector("footer, .footer-section")),
        preloaderVisible: visible(preloader),
        imageCount: document.images.length,
        brokenImageCount: [...document.images].filter(image => image.complete && image.naturalWidth === 0).length,
      };
    }, isVisible.toString());

    if (screenshotPages.has(pageName) && !navigationError) {
      await page.addStyleTag({
        content: "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
      });
      await page.screenshot({
        path: path.join(outputRoot, `${pageName.replace(/\.html$/i, "")}-${viewport.name}.png`),
        fullPage: true,
      });
    }

    const result = {
      page: pageName,
      viewport: viewport.name,
      status: response?.status() ?? null,
      navigationError,
      ...metrics,
      noHorizontalOverflow: metrics.scrollWidth <= metrics.clientWidth,
      consoleErrors,
      failedLocalRequests,
      badLocalResponses,
    };
    report.push(result);
    console.log(
      `${viewport.name.padEnd(7)} ${String(result.status).padEnd(3)} ${pageName.padEnd(52)} text=${String(result.bodyTextLength).padStart(5)} height=${String(result.scrollHeight).padStart(5)} overflow=${!result.noHorizontalOverflow} preloader=${result.preloaderVisible}`,
    );
    await page.close();
  }

  await context.close();
}

await browser.close();
await writeFile(path.join(outputRoot, "pages-audit.json"), `${JSON.stringify(report, null, 2)}\n`);

const failures = report.filter(item =>
  item.status !== 200
  || item.navigationError
  || item.bodyTextLength < 100
  || item.scrollHeight <= 900
  || !item.headerVisible
  || !item.footerVisible
  || item.preloaderVisible
  || !item.noHorizontalOverflow
  || item.failedLocalRequests.length > 0
  || item.badLocalResponses.length > 0,
);

console.log(`Audited ${report.length} page/viewport combinations; ${failures.length} require review.`);
if (failures.length > 0) {
  console.log(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
}
