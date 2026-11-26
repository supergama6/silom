import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputRoot = path.join(projectRoot, "evidence", "browser", "audit");
await mkdir(outputRoot, { recursive: true });

async function launch() {
  const options = {
    headless: true,
    args: ["--disable-http2", "--disable-quic", "--no-proxy-server", "--host-resolver-rules=MAP www.silomcfd.com 104.21.22.140,EXCLUDE localhost"],
  };
  try { return await chromium.launch({ channel: "msedge", ...options }); }
  catch { return chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ...options }); }
}

const browser = await launch();
const report = { baseUrl: "http://127.0.0.1:4174/", tests: [] };

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "en-US" });
await desktop.goto(report.baseUrl, { waitUntil: "networkidle" });
await desktop.evaluate(() => document.fonts.ready);
const desktopInitial = await desktop.evaluate(() => ({
  header: document.querySelector("[data-site-header]").getBoundingClientRect().toJSON(),
  nav: document.querySelector(".site-header__nav").getBoundingClientRect().toJSON(),
  logo: document.querySelector(".site-header__logo img").getBoundingClientRect().toJSON(),
  documentWidth: document.documentElement.scrollWidth,
  fontLoaded: document.fonts.check("500 16px Rubik"),
}));
await desktop.locator(".site-header__item--dropdown").nth(0).hover();
await desktop.waitForTimeout(500);
const desktopDropdown = await desktop.locator(".site-header__item--dropdown").nth(0).locator(":scope > .site-header__submenu").evaluate((element) => ({
  opacity: getComputedStyle(element).opacity,
  visibility: getComputedStyle(element).visibility,
  rect: element.getBoundingClientRect().toJSON(),
}));
await desktop.screenshot({ path: path.join(outputRoot, "navbar-desktop-dropdown.png"), fullPage: false });
await desktop.locator(".site-header__trigger").nth(0).click();
const desktopClickState = await desktop.locator(".site-header__trigger").nth(0).getAttribute("aria-expanded");
await desktop.keyboard.press("Escape");
const desktopEscapeState = await desktop.locator(".site-header__trigger").nth(0).getAttribute("aria-expanded");
await desktop.evaluate(() => window.scrollTo(0, 300));
await desktop.waitForTimeout(550);
const sticky = await desktop.locator("[data-site-header]").evaluate((element) => ({
  className: element.className,
  position: getComputedStyle(element).position,
  top: element.getBoundingClientRect().top,
}));
report.tests.push({ name: "desktop navigation", initial: desktopInitial, dropdown: desktopDropdown, clickExpanded: desktopClickState, escapeExpanded: desktopEscapeState, sticky });

const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, locale: "en-US" });
await mobile.goto(report.baseUrl, { waitUntil: "networkidle" });
const mobileInitial = await mobile.evaluate(() => ({
  header: document.querySelector("[data-site-header]").getBoundingClientRect().toJSON(),
  logo: document.querySelector(".site-header__logo img").getBoundingClientRect().toJSON(),
  toggle: document.querySelector(".site-header__menu-toggle").getBoundingClientRect().toJSON(),
  documentWidth: document.documentElement.scrollWidth,
}));
await mobile.locator(".site-header__menu-toggle").click();
await mobile.waitForTimeout(500);
const drawerOpen = await mobile.evaluate(() => ({
  className: document.querySelector(".mobile-drawer").className,
  inert: document.querySelector(".mobile-drawer").inert,
  focus: document.activeElement.className,
  rect: document.querySelector(".mobile-drawer").getBoundingClientRect().toJSON(),
  overlay: getComputedStyle(document.querySelector(".mobile-drawer__overlay")).visibility,
}));
await mobile.locator(".mobile-nav__trigger").nth(0).click();
const topExpanded = await mobile.locator(".mobile-nav__trigger").nth(0).getAttribute("aria-expanded");
const topSubmenuVisible = await mobile.locator(".mobile-nav__trigger").nth(0).locator("xpath=following-sibling::ul").isVisible();
await mobile.locator(".mobile-nav__trigger").nth(1).click();
const nestedExpanded = await mobile.locator(".mobile-nav__trigger").nth(1).getAttribute("aria-expanded");
await mobile.locator("[data-mobile-language-trigger]").click();
await mobile.locator("[data-language='en']").last().click();
const language = await mobile.locator("[data-language-label]").last().textContent();
const translatedHome = await mobile.locator(".mobile-nav__list > li > a").first().textContent();
await mobile.screenshot({ path: path.join(outputRoot, "navbar-mobile-open.png"), fullPage: false });
await mobile.keyboard.press("Escape");
const drawerClosed = await mobile.evaluate(() => ({
  open: document.querySelector(".mobile-drawer").classList.contains("is-open"),
  inert: document.querySelector(".mobile-drawer").inert,
  focusRestored: document.activeElement === document.querySelector(".site-header__menu-toggle"),
}));
report.tests.push({ name: "mobile drawer", initial: mobileInitial, opened: drawerOpen, topExpanded, topSubmenuVisible, nestedExpanded, language, translatedHome, closed: drawerClosed });

await browser.close();
await writeFile(path.join(outputRoot, "navbar-audit.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
