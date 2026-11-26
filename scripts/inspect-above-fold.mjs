import { chromium } from "playwright";

async function launch() {
  const options = {
    headless: true,
    args: ["--disable-http2", "--disable-quic", "--no-proxy-server", "--host-resolver-rules=MAP www.silomcfd.com 104.21.22.140,EXCLUDE localhost"],
  };
  try { return await chromium.launch({ channel: "msedge", ...options }); }
  catch { return chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ...options }); }
}

const selectors = {
  header: "header, [data-site-header]",
  hero: ".hero-section, .home-hero",
  heroContainer: ".hero-section .container, .home-hero__inner",
  heroTitle: ".hero-content h1, .home-hero__title",
  heroClient: ".hero-client, .home-hero__summary",
  heroButton: ".hero-button, .home-hero__actions",
  heroCta: ".hero-button .theme-btn, .home-hero__cta",
  brand: ".brand-section-2, .spread-panel",
  brandContainer: ".brand-section-2 .container-fluid, .spread-panel__outer",
  brandWrapper: ".brand-wrapper-2, .spread-panel__inner",
  brandTitle: ".brand-wrapper-2 h2, .spread-panel__title",
  brandItems: ".brand-items, .spread-panel__items",
};

const browser = await launch();
for (const viewport of [{ name: "desktop", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  for (const target of ["https://www.silomcfd.com/", "http://127.0.0.1:4174/"]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: 1, isMobile: viewport.name === "mobile", locale: "en-US", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36 Edg/142.0.0.0" });
    const page = await context.newPage();
    await page.goto(target, { waitUntil: "networkidle", timeout: 90000 });
    await page.evaluate(() => document.fonts.ready);
    const result = await page.evaluate((entries) => {
      const inspect = (selector) => {
        const element = document.querySelector(selector);
        if (!element) return null;
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return {
          rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left },
          text: (element.textContent || "").trim().replace(/\s+/g, " ").slice(0, 250),
          style: {
            display: style.display,
            position: style.position,
            color: style.color,
            backgroundColor: style.backgroundColor,
            backgroundImage: style.backgroundImage,
            backgroundPosition: style.backgroundPosition,
            backgroundSize: style.backgroundSize,
            fontFamily: style.fontFamily,
            fontSize: style.fontSize,
            fontWeight: style.fontWeight,
            lineHeight: style.lineHeight,
            padding: style.padding,
            margin: style.margin,
            gap: style.gap,
            borderRadius: style.borderRadius,
          },
        };
      };
      return Object.fromEntries(entries.map(([name, selector]) => [name, inspect(selector)]));
    }, Object.entries(selectors));
    console.log(JSON.stringify({ viewport: viewport.name, target, result }, null, 2));
    await context.close();
  }
}
await browser.close();
