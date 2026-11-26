import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(projectRoot, "evidence", "direct", "kos-calendar");
const sourceUrl = new URL("https://www.kosmarkets.com/tools/economic-calendar");
const userAgent = "Mozilla/5.0 (compatible; KOSCalendarWidgetReference/1.0)";

await mkdir(outputDirectory, { recursive: true });

async function collect(url, localName) {
  const response = await fetch(url, { headers: { "user-agent": userAgent } });
  const body = Buffer.from(await response.arrayBuffer());
  const localPath = path.join(outputDirectory, localName);

  if (response.ok) await writeFile(localPath, body);

  return {
    sourceUrl: url.href,
    localPath: response.ok ? path.relative(projectRoot, localPath) : null,
    contentType: response.headers.get("content-type"),
    status: response.status,
    bytes: body.byteLength,
    error: response.ok ? null : `HTTP ${response.status}`,
  };
}

const htmlRecord = await collect(sourceUrl, "economic-calendar.html");
if (htmlRecord.status < 200 || htmlRecord.status >= 300) {
  throw new Error(`Unable to collect reference page: ${htmlRecord.error}`);
}
const html = await (await import("node:fs/promises")).readFile(
  path.join(outputDirectory, "economic-calendar.html"),
  "utf8",
);

const bundlePaths = new Set();
const initialStylesheets = new Set();
for (const match of html.matchAll(/(?:src|href)=["']([^"']+\.(?:js|css))(?:\?[^"']*)?["']/gi)) {
  const url = new URL(match[1], sourceUrl);
  if (url.origin !== sourceUrl.origin) continue;
  if (url.pathname.endsWith(".js")) bundlePaths.add(url.href);
  else initialStylesheets.add(url.href);
}

const mainScriptUrl = [...bundlePaths].find(url => new URL(url).pathname.endsWith(".js"));
if (!mainScriptUrl) throw new Error("The reference HTML did not expose its application JavaScript bundle.");

const mainScriptRecord = await collect(new URL(mainScriptUrl), path.basename(new URL(mainScriptUrl).pathname));
if (mainScriptRecord.status < 200 || mainScriptRecord.status >= 300) {
  throw new Error(`Unable to collect the application bundle: ${mainScriptRecord.error}`);
}
const mainScript = await (await import("node:fs/promises")).readFile(
  path.join(outputDirectory, path.basename(new URL(mainScriptUrl).pathname)),
  "utf8",
);

const lazyBundlePaths = new Set(
  [...mainScript.matchAll(/"(assets\/EconomicCalendarView-[^"?]+\.(?:js|css))"/g)]
    .map(match => new URL(`/${match[1]}`, sourceUrl.origin)),
);

const stylesheetRecords = [];
for (const url of initialStylesheets) {
  const record = await collect(new URL(url), path.basename(new URL(url).pathname));
  stylesheetRecords.push(record);
}

const lazyBundleRecords = [];
for (const url of lazyBundlePaths) {
  const record = await collect(url, path.basename(url.pathname));
  lazyBundleRecords.push(record);
}

const economicCalendarScript = lazyBundleRecords.find(record => record.localPath?.endsWith(".js"));
const componentText = economicCalendarScript
  ? await (await import("node:fs/promises")).readFile(path.join(projectRoot, economicCalendarScript.localPath), "utf8")
  : "";
const iframeSrcMatch = componentText.match(/src:"(https:\/\/www\.tradingview-widget\.com\/embed-widget\/events\/[^"]+)"/);
let iframeConfig = null;
if (iframeSrcMatch) {
  const iframeUrl = new URL(iframeSrcMatch[1]);
  try {
    iframeConfig = JSON.parse(decodeURIComponent(iframeUrl.hash.slice(1)));
  } catch {
    iframeConfig = null;
  }
}

const report = {
  sourceUrl: sourceUrl.href,
  sourcePage: "KOSMarkets economic-calendar public SPA route",
  targetLanguage: "en (TradingView embed locale from the source component)",
  collectionMethod: "Direct Node.js fetch before independent Playwright Edge inspection",
  excluded: ["login-only content", "private account data", "backend API payloads"],
  resources: [htmlRecord, mainScriptRecord, ...stylesheetRecords, ...lazyBundleRecords],
  widgetObservation: {
    iframeOrigin: "https://www.tradingview-widget.com",
    iframePath: "/embed-widget/events/",
    iframeSrc: iframeSrcMatch?.[1] ?? null,
    iframeConfig,
  },
};

await writeFile(
  path.join(outputDirectory, "manifest.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
console.log(JSON.stringify(report, null, 2));
