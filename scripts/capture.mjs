import { chromium } from "playwright";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const mode = process.argv[2] || "source";
const baseUrl = mode === "source" ? "https://www.silomcfd.com/" : "http://127.0.0.1:4174/";
const outputRoot = path.join(projectRoot, "evidence", "browser", mode);
const edgeUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36 Edg/142.0.0.0";
const viewports = [
  { name: "desktop", width: 1440, height: 900, isMobile: false },
  { name: "mobile", width: 390, height: 844, isMobile: true },
];

async function launchEdge() {
  const launchOptions = {
    headless: true,
    args: [
      "--disable-http2",
      "--disable-quic",
      "--no-proxy-server",
      "--host-resolver-rules=MAP www.silomcfd.com 104.21.22.140,EXCLUDE localhost",
    ],
  };
  try {
    return await chromium.launch({ channel: "msedge", ...launchOptions });
  } catch {
    return chromium.launch({
      executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
      ...launchOptions,
    });
  }
}

async function navigate(page, target) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await page.goto(target, { waitUntil: attempt === 1 ? "networkidle" : "domcontentloaded", timeout: 90000 });
    } catch (error) {
      lastError = error;
      console.warn(`navigation attempt ${attempt} failed: ${target} (${error.message.split("\n")[0]})`);
      await page.waitForTimeout(1500 * attempt);
    }
  }
  throw lastError;
}

const routeManifest = JSON.parse(await readFile(path.join(projectRoot, "evidence", "direct", "routes.json"), "utf8"));
const sourceOrigin = new URL("https://www.silomcfd.com/");
const uniquePaths = [...new Set(routeManifest.filter((route) => route.status === 200).map((route) => new URL(route.finalUrl || route.sourceUrl).pathname))];
const selectedPaths = uniquePaths.slice(0, Number(process.env.CAPTURE_LIMIT || 40));
const browser = await launchEdge();
const results = [];
await mkdir(outputRoot, { recursive: true });

for (const viewport of viewports) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: 1,
    isMobile: viewport.isMobile,
    locale: "en-US",
    userAgent: edgeUserAgent,
    reducedMotion: "reduce",
    colorScheme: "light",
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const failedRequests = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText }));

  for (const pathname of selectedPaths) {
    const target = new URL(pathname, baseUrl).href;
    const slug = pathname === "/" ? "home" : pathname.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";
    const response = await navigate(page, target);
    await page.evaluate(async () => {
      await document.fonts?.ready;
      await Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      })));
    });
    await page.addStyleTag({ content: ".wow{visibility:visible!important;opacity:1!important;animation:none!important;transform:none!important}*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;caret-color:transparent!important}" });
    const screenshotPath = path.join(outputRoot, `${slug}-${viewport.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    const geometry = await page.evaluate(() => {
      const serialize = (element) => {
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          tag: element.tagName.toLowerCase(),
          className: element.className || "",
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 300),
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
          style: {
            display: style.display,
            position: style.position,
            color: style.color,
            backgroundColor: style.backgroundColor,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            padding: style.padding,
            margin: style.margin,
            borderRadius: style.borderRadius,
            boxShadow: style.boxShadow,
          },
        };
      };
      return {
        title: document.title,
        document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
        body: serialize(document.body),
        header: serialize(document.querySelector("header, .header-section, .header-main")),
        nav: serialize(document.querySelector("nav, .main-menu")),
        logo: serialize(document.querySelector("header img, .logo img")),
        main: serialize(document.querySelector("main")),
        hero: serialize(document.querySelector(".hero-section, .hero-wrapper, [class*=hero]")),
        footer: serialize(document.querySelector("footer, .footer-section")),
        headings: [...document.querySelectorAll("h1,h2")].slice(0, 12).map(serialize),
        links: [...document.querySelectorAll("a")].slice(0, 80).map((link) => ({ text: (link.textContent || "").trim().replace(/\s+/g, " "), href: link.href, className: link.className || "" })),
      };
    });

    results.push({
      mode,
      sourceOrigin: sourceOrigin.href,
      url: target,
      status: response?.status() ?? null,
      viewport,
      screenshot: path.relative(projectRoot, screenshotPath),
      geometry,
      consoleErrors: [...consoleErrors],
      failedRequests: [...failedRequests],
    });
    consoleErrors.length = 0;
    failedRequests.length = 0;
    console.log(`${mode} ${viewport.name} ${response?.status() ?? "?"} ${target}`);
  }
  await context.close();
}

await browser.close();
await writeFile(path.join(outputRoot, "capture.json"), `${JSON.stringify(results, null, 2)}\n`);
