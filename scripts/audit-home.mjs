import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "evidence", "browser", "audit");
await mkdir(outputRoot, { recursive: true });

async function launchEdge() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", headless: true });
  }
}

const browser = await launchEdge();
const report = [];

for (const viewport of [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
]) {
  const context = await browser.newContext({ viewport, isMobile: viewport.isMobile, locale: "en-US", reducedMotion: "reduce", deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));
  const response = await page.goto("http://127.0.0.1:4174/", { waitUntil: "networkidle", timeout: 60000 });
  await page.evaluate(() => document.fonts.ready);
  const initial = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    scrollHeight: document.documentElement.scrollHeight,
    footerHeight: document.querySelector(".site-footer").getBoundingClientRect().height,
  }));
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await page.waitForTimeout(50);
  const beforeScrollTop = await page.evaluate(() => window.scrollY);
  await page.locator("[data-scroll-top]").click();
  await page.waitForTimeout(1800);
  const afterScrollTop = await page.evaluate(() => window.scrollY);
  report.push({
    viewport: viewport.name,
    status: response?.status() ?? null,
    initial,
    beforeScrollTop,
    afterScrollTop,
    noHorizontalOverflow: initial.scrollWidth === initial.clientWidth,
    consoleErrors,
    failedRequests,
  });
  await context.close();
}

await browser.close();
await writeFile(path.join(outputRoot, "home-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
