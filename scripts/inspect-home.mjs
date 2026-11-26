import { chromium } from "playwright";

const edgePath = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const targets = [
  ["source", "https://www.silomcfd.com/"],
  ["local", "http://127.0.0.1:4174/"],
];
const viewports = [
  ["desktop", { width: 1440, height: 900 }],
  ["mobile", { width: 390, height: 844 }],
];

async function launchEdge() {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ executablePath: edgePath, headless: true });
  }
}

function roundedRect(element) {
  if (!element) return null;
  const { x, y, width, height, top, right, bottom, left } = element.getBoundingClientRect();
  return Object.fromEntries(
    Object.entries({ x, y, width, height, top, right, bottom, left }).map(([key, value]) => [key, Math.round(value * 1000) / 1000]),
  );
}

const browser = await launchEdge();
const report = {};

for (const [targetName, url] of targets) {
  report[targetName] = {};
  for (const [viewportName, viewport] of viewports) {
    const context = await browser.newContext({ viewport, locale: "en-US", reducedMotion: "reduce", deviceScaleFactor: 1 });
    const page = await context.newPage();
    await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((image) => image.complete ? null : new Promise((resolve) => {
        image.addEventListener("load", resolve, { once: true });
        image.addEventListener("error", resolve, { once: true });
      })));
      document.querySelectorAll(".wow").forEach((element) => {
        element.style.visibility = "visible";
        element.style.animation = "none";
      });
      scrollTo(0, 0);
    });

    report[targetName][viewportName] = await page.evaluate((targetName) => {
      const pick = (sourceSelector, localSelector) => document.querySelector(targetName === "source" ? sourceSelector : localSelector);
      const all = (sourceSelector, localSelector) => [...document.querySelectorAll(targetName === "source" ? sourceSelector : localSelector)];
      const rect = (element) => {
        if (!element) return null;
        const { x, y, width, height, top, right, bottom, left } = element.getBoundingClientRect();
        return Object.fromEntries(Object.entries({ x, y, width, height, top, right, bottom, left }).map(([key, value]) => [key, Math.round(value * 1000) / 1000]));
      };
      const style = (element) => {
        if (!element) return null;
        const computed = getComputedStyle(element);
        return Object.fromEntries([
          "display", "fontFamily", "fontSize", "fontWeight", "lineHeight", "color", "backgroundColor",
          "paddingTop", "paddingRight", "paddingBottom", "paddingLeft", "marginTop", "marginRight", "marginBottom", "marginLeft",
          "borderRadius", "gap", "rowGap", "columnGap",
        ].map((property) => [property, computed[property]]));
      };
      const selectors = {
        about: [".about-section", ".deposit-section"],
        aboutContainer: [".about-section .container", ".deposit-section__container"],
        aboutTitle: [".about-section .section-title h2", ".deposit-section__title"],
        aboutText: [".about-section .about-content > p", ".deposit-section__text"],
        services: [".service-section-4", ".services-section"],
        servicesContainer: [".service-section-4 .container", ".services-section__container"],
        servicesTitle: [".service-section-4 .section-title h2", ".services-section__title"],
        servicesSubtitle: [".service-section-4 .section-title h4", ".services-section__subtitle"],
        platform: [".service-section-4 + .about-section", ".platform-section"],
        platformContainer: [".service-section-4 + .about-section .container", ".platform-section__container"],
        platformContent: [".service-section-4 + .about-section .about-content", ".platform-section__content"],
        platformImage: [".digital-about-image img", ".platform-section__image img"],
        footer: ["footer.footer-section", ".site-footer"],
        footerContainer: ["footer.footer-section .container", ".site-footer__container"],
        footerWidgets: [".footer-widgets-wrapper", ".site-footer__widgets"],
        footerBottom: [".footer-bottom", ".site-footer__bottom"],
      };
      const result = {
        document: {
          width: document.documentElement.scrollWidth,
          height: document.documentElement.scrollHeight,
          viewportWidth: innerWidth,
        },
      };
      for (const [name, pair] of Object.entries(selectors)) {
        const element = pick(...pair);
        result[name] = { rect: rect(element), style: style(element) };
      }
      result.serviceCards = all(".service-box-items", ".service-card").map((element) => ({ rect: rect(element), style: style(element) }));
      result.footerColumns = all(".footer-widgets-wrapper .single-footer-widget", ".site-footer__column").map((element) => ({ rect: rect(element), style: style(element) }));
      result.content = {
        about: pick(".about-section .about-content", ".deposit-section__content")?.innerText.trim() ?? null,
        services: all(".service-box-items", ".service-card").map((element) => element.innerText.trim()),
        platform: pick(".service-section-4 + .about-section .about-content", ".platform-section__content")?.innerText.trim() ?? null,
        footerColumns: all(".footer-widgets-wrapper .single-footer-widget", ".site-footer__column").map((element) => element.innerText.trim()),
      };
      const detailSelectors = {
        serviceIcon: [".service-box-items .icon", ".service-card__icon"],
        serviceHeading: [".service-box-items .content h3", ".service-card__content h3"],
        serviceParagraph: [".service-box-items .content p", ".service-card__content p"],
        platformBadge: [".service-section-4 + .about-section .sub-content", ".platform-section .section-badge"],
        platformHeading: [".service-section-4 + .about-section h2", ".platform-section__title"],
        platformParagraph: [".service-section-4 + .about-section .about-content > p", ".platform-section__text"],
        platformLink: [".service-section-4 + .about-section .about-list li", ".platform-section__link"],
        footerRiskText: [".footer-content", ".site-footer__risk-text"],
        footerContactList: [".contact-info-area", ".site-footer__contact-list"],
        footerContactItems: [".contact-info-area .contact-items", ".site-footer__contact-item"],
      };
      result.details = Object.fromEntries(Object.entries(detailSelectors).map(([name, pair]) => {
        const elements = all(...pair);
        return [name, elements.length > 1
          ? elements.map((element) => ({ rect: rect(element), style: style(element) }))
          : { rect: rect(elements[0]), style: style(elements[0]) }];
      }));
      return result;
    }, targetName);
    await context.close();
  }
}

await browser.close();

const compact = Object.fromEntries(Object.entries(report).map(([targetName, target]) => [
  targetName,
  Object.fromEntries(Object.entries(target).map(([viewportName, viewport]) => [
    viewportName,
    Object.fromEntries(Object.entries(viewport).map(([name, value]) => {
      if (name === "document" || name === "content") return [name, value];
      if (name === "details") return [name, Object.fromEntries(Object.entries(value).map(([detailName, detail]) => [
        detailName,
        Array.isArray(detail) ? detail.map((item) => item.rect) : detail.rect,
      ]))];
      if (Array.isArray(value)) return [name, value.map((item) => item.rect)];
      return [name, value.rect];
    })),
  ])),
]));

const geometry = Object.fromEntries(Object.entries(compact).map(([targetName, target]) => [
  targetName,
  Object.fromEntries(Object.entries(target).map(([viewportName, viewport]) => [
    viewportName,
    Object.fromEntries(Object.entries(viewport).filter(([name]) => name !== "content" && name !== "details")),
  ])),
]));

const output = process.argv.includes("--details")
  ? Object.fromEntries(Object.entries(compact).map(([targetName, target]) => [
      targetName,
      Object.fromEntries(Object.entries(target).map(([viewportName, viewport]) => [viewportName, viewport.details])),
    ]))
  : geometry;

console.log(JSON.stringify(output, null, 2));
