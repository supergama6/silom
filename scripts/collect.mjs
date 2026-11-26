import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const evidenceRoot = path.join(projectRoot, "evidence", "direct");
const sourceRoot = path.join(evidenceRoot, "source");
const publicRoot = path.join(projectRoot, "public");
const origin = new URL("https://www.silomcfd.com/");
const maxPages = 120;
const maxAssets = 1200;
const userAgent = "Mozilla/5.0 (compatible; SilomWebCopyAudit/1.0; +local-reconstruction)";

const pageQueue = [origin.href];
const queuedPages = new Set(pageQueue);
const visitedPages = new Set();
const queuedAssets = new Set();
const assetQueue = [];
const manifests = [];
const routeRecords = [];
const assetRecords = [];
let disallowRules = [];

await mkdir(sourceRoot, { recursive: true });
await mkdir(publicRoot, { recursive: true });

function safeSegment(value) {
  return value.replace(/[<>:"|?*]/g, "_");
}

function routeFile(url) {
  const parsed = new URL(url);
  const pathname = decodeURIComponent(parsed.pathname);
  const normalized = pathname.endsWith("/") ? `${pathname}index.html` : pathname;
  const relative = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  const filename = relative || "index.html";
  return path.join(sourceRoot, "html", ...filename.split("/").map(safeSegment));
}

function assetFile(url) {
  const parsed = new URL(url);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith("/")) pathname += "index";
  const relative = pathname.replace(/^\/+/, "") || "asset";
  const parts = relative.split("/").map(safeSegment);
  if (parsed.search) {
    const last = parts.pop();
    const suffix = Buffer.from(parsed.search).toString("hex").slice(0, 12);
    parts.push(`${last}__${suffix}`);
  }
  return path.join(publicRoot, ...parts);
}

function externalAssetFile(url) {
  const parsed = new URL(url);
  let pathname = decodeURIComponent(parsed.pathname);
  if (pathname.endsWith("/")) pathname += "index";
  const relative = pathname.replace(/^\/+/, "") || "asset";
  const parts = relative.split("/").map(safeSegment);
  if (parsed.search) {
    const last = parts.pop();
    const suffix = Buffer.from(parsed.search).toString("hex").slice(0, 12);
    parts.push(`${last}__${suffix}`);
  }
  return path.join(publicRoot, "external", safeSegment(parsed.hostname), ...parts);
}

function isAllowed(url) {
  const parsed = new URL(url);
  return !disallowRules.some((rule) => rule !== "/" && parsed.pathname.startsWith(rule));
}

function normalizeUrl(value, baseUrl) {
  if (!value || /^(?:data|blob|mailto|tel|javascript):/i.test(value)) return null;
  try {
    const parsed = new URL(value.trim(), baseUrl);
    parsed.hash = "";
    return parsed;
  } catch {
    return null;
  }
}

function extractAttributeUrls(html, baseUrl) {
  const results = [];
  const attrPattern = /\b(?:href|src|poster|data-src|data-background)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(attrPattern)) {
    const parsed = normalizeUrl(match[1], baseUrl);
    if (parsed) results.push(parsed);
  }
  const srcsetPattern = /\b(?:srcset|data-srcset)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(srcsetPattern)) {
    for (const candidate of match[1].split(",")) {
      const parsed = normalizeUrl(candidate.trim().split(/\s+/)[0], baseUrl);
      if (parsed) results.push(parsed);
    }
  }
  return results;
}

function extractCssUrls(css, baseUrl) {
  const results = [];
  const pattern = /(?:url\(\s*|@import\s+)["']?([^"')\s;]+)["']?\s*\)?/gi;
  for (const match of css.matchAll(pattern)) {
    const parsed = normalizeUrl(match[1], baseUrl);
    if (parsed) results.push(parsed);
  }
  return results;
}

function looksLikePage(url) {
  if (url.origin !== origin.origin) return false;
  if (!isAllowed(url)) return false;
  const extension = path.posix.extname(url.pathname).toLowerCase();
  return !extension || extension === ".html" || extension === ".htm" || url.pathname.endsWith("/");
}

function queuePage(url) {
  const href = url.href;
  if (queuedPages.size >= maxPages || queuedPages.has(href) || visitedPages.has(href)) return;
  queuedPages.add(href);
  pageQueue.push(href);
}

function queueAsset(url) {
  if (queuedAssets.size >= maxAssets || queuedAssets.has(url.href)) return;
  queuedAssets.add(url.href);
  assetQueue.push(url.href);
}

async function request(url) {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": userAgent, accept: "*/*" },
      signal: controller.signal,
    });
    const body = Buffer.from(await response.arrayBuffer());
    return {
      ok: true,
      response,
      body,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    return { ok: false, error: String(error), durationMs: Date.now() - started };
  } finally {
    clearTimeout(timeout);
  }
}

const runtimeLocaleUrls = [
  new URL("/i18n/i18n_cn.json", origin).href,
  new URL("/i18n/i18n_en.json", origin).href,
];

if (process.argv.includes("--locales-only")) {
  for (const localeUrl of runtimeLocaleUrls) {
    const result = await request(localeUrl);
    if (!result.ok || !result.response.ok) {
      throw new Error(`Unable to collect ${localeUrl}: ${result.error || result.response.status}`);
    }
    const localPath = assetFile(result.response.url);
    await mkdir(path.dirname(localPath), { recursive: true });
    await writeFile(localPath, result.body);
    console.log(`[locale] ${result.response.status} ${localeUrl} -> ${path.relative(projectRoot, localPath)}`);
  }
  process.exit(0);
}

for (const localeUrl of runtimeLocaleUrls) queueAsset(new URL(localeUrl));

const robotsUrl = new URL("/robots.txt", origin).href;
const robotsResult = await request(robotsUrl);
if (robotsResult.ok) {
  const robotsText = robotsResult.body.toString("utf8");
  await writeFile(path.join(sourceRoot, "robots.txt"), robotsText);
  let applies = false;
  for (const rawLine of robotsText.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    if (!line) continue;
    const [key, ...rest] = line.split(":");
    const value = rest.join(":").trim();
    if (/^user-agent$/i.test(key)) applies = value === "*" || /SilomWebCopyAudit/i.test(value);
    if (applies && /^disallow$/i.test(key) && value) disallowRules.push(value);
  }
  manifests.push({
    sourceUrl: robotsUrl,
    localPath: path.relative(projectRoot, path.join(sourceRoot, "robots.txt")),
    status: robotsResult.response.status,
    contentType: robotsResult.response.headers.get("content-type"),
    bytes: robotsResult.body.length,
    durationMs: robotsResult.durationMs,
  });
}

while (pageQueue.length && visitedPages.size < maxPages) {
  const requestedUrl = pageQueue.shift();
  if (!isAllowed(requestedUrl)) continue;
  visitedPages.add(requestedUrl);
  const result = await request(requestedUrl);
  console.log(`[page ${visitedPages.size}/${maxPages}] ${result.ok ? result.response.status : "ERR"} ${requestedUrl}`);
  if (!result.ok) {
    routeRecords.push({ sourceUrl: requestedUrl, error: result.error, included: true });
    continue;
  }

  const finalUrl = result.response.url;
  const contentType = result.response.headers.get("content-type") || "";
  const localPath = routeFile(finalUrl);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, result.body);
  const record = {
    sourceUrl: requestedUrl,
    finalUrl,
    localPath: path.relative(projectRoot, localPath),
    status: result.response.status,
    contentType,
    bytes: result.body.length,
    durationMs: result.durationMs,
    included: true,
  };
  routeRecords.push(record);
  manifests.push(record);

  if (!contentType.includes("text/html")) continue;
  const html = result.body.toString("utf8");
  for (const candidate of extractAttributeUrls(html, finalUrl)) {
    if (looksLikePage(candidate)) queuePage(candidate);
    else queueAsset(candidate);
  }
  for (const candidate of extractCssUrls(html, finalUrl)) queueAsset(candidate);
}

let assetIndex = 0;
while (assetIndex < assetQueue.length) {
  const assetUrl = assetQueue[assetIndex];
  assetIndex += 1;
  const result = await request(assetUrl);
  console.log(`[asset ${assetIndex}/${assetQueue.length}] ${result.ok ? result.response.status : "ERR"} ${assetUrl}`);
  if (!result.ok) {
    assetRecords.push({ sourceUrl: assetUrl, error: result.error, included: false });
    continue;
  }
  const contentType = result.response.headers.get("content-type") || "";
  const sameOrigin = new URL(result.response.url).origin === origin.origin;
  const localPath = sameOrigin ? assetFile(result.response.url) : externalAssetFile(result.response.url);
  await mkdir(path.dirname(localPath), { recursive: true });
  await writeFile(localPath, result.body);
  const record = {
    sourceUrl: assetUrl,
    finalUrl: result.response.url,
    localPath: path.relative(projectRoot, localPath),
    status: result.response.status,
    contentType,
    bytes: result.body.length,
    durationMs: result.durationMs,
    included: sameOrigin,
  };
  assetRecords.push(record);
  manifests.push(record);
  if (contentType.includes("text/css")) {
    for (const candidate of extractCssUrls(result.body.toString("utf8"), result.response.url)) queueAsset(candidate);
  }
}

const report = {
  generatedAt: new Date().toISOString(),
  sourceOrigin: origin.href,
  limits: { maxPages, maxAssets },
  robots: { url: robotsUrl, disallowRules },
  summary: {
    pages: routeRecords.length,
    assets: assetRecords.length,
    successfulPages: routeRecords.filter((item) => item.status >= 200 && item.status < 400).length,
    successfulAssets: assetRecords.filter((item) => item.status >= 200 && item.status < 400).length,
  },
  routes: routeRecords,
  assets: assetRecords,
  manifest: manifests,
};

await writeFile(path.join(evidenceRoot, "manifest.json"), `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(evidenceRoot, "routes.json"), `${JSON.stringify(routeRecords, null, 2)}\n`);
console.log(JSON.stringify(report.summary, null, 2));
