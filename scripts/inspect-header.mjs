import { chromium } from "playwright";

async function launch() {
  const options = {
    headless: true,
    args: ["--disable-http2", "--disable-quic", "--no-proxy-server", "--host-resolver-rules=MAP www.silomcfd.com 104.21.22.140,EXCLUDE localhost"],
  };
  try { return await chromium.launch({ channel: "msedge", ...options }); }
  catch { return chromium.launch({ executablePath: "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe", ...options }); }
}

const browser = await launch();
for (const target of ["https://www.silomcfd.com/", "http://127.0.0.1:4174/"]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: "en-US", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/142 Safari/537.36 Edg/142.0.0.0" });
  const page = await context.newPage();
  await page.goto(target, { waitUntil: "networkidle", timeout: 90000 });
  await page.evaluate(() => document.fonts?.ready);
  const output = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll("header .main-menu > nav > ul > li, .site-header__nav > .site-header__menu > li")];
    return nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      const link = node.querySelector(":scope > a, :scope > button");
      const linkRect = link?.getBoundingClientRect();
      return {
        text: (link?.textContent || "").trim().replace(/\s+/g, " "),
        rect: { x: rect.x, width: rect.width, right: rect.right },
        link: linkRect ? { x: linkRect.x, width: linkRect.width, right: linkRect.right } : null,
        font: link ? getComputedStyle(link).fontFamily : null,
      };
    });
  });
  console.log(target, JSON.stringify(output, null, 2));
  await context.close();
}
await browser.close();
