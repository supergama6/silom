import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, "..");
const sourceDirectory = path.join(
  projectRoot,
  "evidence",
  "direct",
  "source",
  "html",
);

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

const localAssetPrefixes = ["assets", "images", "js", "cdn-cgi"];
const localAssetPattern = localAssetPrefixes.join("|");
const externalImageOrigin = "https://tmgm-cdn.oss-cn-hongkong.aliyuncs.com/";
const localExternalImageRoot = "public/external/tmgm-cdn.oss-cn-hongkong.aliyuncs.com/";
const cloneSafetyStyles = `
        <style id="local-clone-safety">
            html,
            body { overflow-x: clip; }
            #preloader,
            .preloader { display: none !important; }
            .wow { visibility: visible; }
        </style>`;
const calendarStyles = `
        <style id="tradingview-calendar-styles">
            .economic-calendar { position: relative; min-height: 680px; margin: 0 auto; }
            .economic-calendar__frame { width: 100%; height: 680px; overflow: hidden; }
            .economic-calendar__frame tv-economic-calendar { display: block; width: 100%; height: 100%; }
            .economic-calendar__status {
                position: absolute; inset: 0; z-index: 2; display: flex; flex-direction: column;
                align-items: center; justify-content: center; gap: 12px; padding: 32px;
                color: #202735; text-align: center; background: #f7f9fc;
                border: 1px solid #e5eaf2; border-radius: 12px;
            }
            .economic-calendar__status[hidden] { display: none; }
            .economic-calendar__status strong { font-size: 22px; }
            .economic-calendar__status p { max-width: 560px; margin: 0; color: #687386; line-height: 1.7; }
            .economic-calendar__actions { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 12px; }
            .economic-calendar__link, .economic-calendar__retry {
                display: inline-flex; align-items: center; justify-content: center; min-height: 44px;
                padding: 10px 18px; color: #fff; font: inherit; font-weight: 600; text-decoration: none;
                background: #214f91; border: 1px solid #214f91; border-radius: 6px; cursor: pointer;
                transition: background-color .2s ease, border-color .2s ease;
            }
            .economic-calendar__retry { color: #214f91; background: #fff; }
            .economic-calendar__link:hover, .economic-calendar__retry:hover { color: #fff; background: #183c70; border-color: #183c70; }
            .economic-calendar__credit { margin: 12px 0 0; color: #748094; font-size: 13px; text-align: right; }
            .economic-calendar__credit a { color: #214f91; }
            .economic-calendar[data-state="error"] .economic-calendar__frame { visibility: hidden; }
            @media (max-width: 767px) {
                .economic-calendar { min-height: 620px; }
                .economic-calendar__frame { height: 620px; }
                .economic-calendar__status { padding: 24px 18px; }
                .economic-calendar__status strong { font-size: 19px; }
                .economic-calendar__credit { text-align: center; }
            }
        </style>`;
const calendarMarkup = `
                    <div class="economic-calendar" data-economic-calendar data-state="loading">
                        <script type="module" src="https://widgets.tradingview-widget.com/w/en/tv-economic-calendar.js" onerror="this.closest('[data-economic-calendar]').dataset.state='module-error'"></script>
                        <div class="economic-calendar__frame">
                            <tv-economic-calendar aria-label="TradingView 财经日历"></tv-economic-calendar>
                        </div>
                        <div class="economic-calendar__status" data-calendar-status role="status" aria-live="polite">
                            <strong data-calendar-title>正在加载财经日历</strong>
                            <p data-calendar-message>正在连接 TradingView。若日历无法加载，仍可通过下方链接查看原始财经日历。</p>
                            <div class="economic-calendar__actions">
                                <a class="economic-calendar__link" href="https://www.tradingview.com/economic-calendar/" target="_blank" rel="noopener noreferrer">在 TradingView 打开财经日历</a>
                                <button class="economic-calendar__retry" type="button" data-calendar-retry>重新加载</button>
                            </div>
                        </div>
                    </div>
                    <p class="economic-calendar__credit">财经日历由 <a href="https://www.tradingview.com/economic-calendar/" target="_blank" rel="noopener noreferrer">TradingView</a> 提供</p>`;

function localizeAssets(html) {
  let result = html;

  result = result.replaceAll(externalImageOrigin, localExternalImageRoot);

  // Local copies preserve the source directory structure below /public.
  result = result.replace(
    new RegExp(
      `(?:https?:)?//(?:www\\.)?silomcfd\\.com/(${localAssetPattern})/`,
      "gi",
    ),
    "public/$1/",
  );
  result = result.replace(
    new RegExp(`([\"'(=])/(?:\\./)?(${localAssetPattern})/`, "gi"),
    "$1public/$2/",
  );
  result = result.replace(
    new RegExp(`([\"'(=])(?:\\./)?(${localAssetPattern})/`, "gi"),
    "$1public/$2/",
  );

  return result;
}

function replaceCalendarWidget(html) {
  const sourceWidget = /<script type="text\/javascript" src="https:\/\/c\.mql5\.com\/js\/widgets\/calendar\/widget\.js\?6">[\s\S]*?<\/script>\s*<div id="economicCalendarWidget"><\/div>\s*<script type="text\/javascript">[\s\S]*?new economicCalendar\([\s\S]*?<\/script>/;
  if (!sourceWidget.test(html)) {
    throw new Error("Could not locate the original MQL5 calendar widget markup.");
  }
  return html.replace(sourceWidget, calendarMarkup);
}

function makePageSafe(html, { calendar = false } = {}) {
  let localizedHtml = localizeAssets(html);

  if (calendar) localizedHtml = replaceCalendarWidget(localizedHtml);

  if (!localizedHtml.includes("</head>")) {
    throw new Error("Source page does not contain a closing </head> tag.");
  }

  const headStyles = calendar ? `${cloneSafetyStyles}\n${calendarStyles}` : cloneSafetyStyles;
  localizedHtml = localizedHtml.replace("</head>", `${headStyles}\n    </head>`);

  if (calendar) {
    localizedHtml = localizedHtml.replace(
      "</body>",
      '    <script src="public/js/calendar-widget.js" defer></script>\n    </body>',
    );
  }

  return localizedHtml;
}

for (const page of pages) {
  const sourcePath = path.join(sourceDirectory, page);
  const outputPath = path.join(projectRoot, page);
  const sourceHtml = await readFile(sourcePath, "utf8");
  const outputHtml = makePageSafe(sourceHtml, { calendar: page === "calendar.html" });

  await writeFile(outputPath, outputHtml, "utf8");
  console.log(`${page}: ${Buffer.byteLength(outputHtml)} bytes`);
}

const languageScriptPath = path.join(projectRoot, "public", "js", "switch-language.js");
const languageScript = await readFile(languageScriptPath, "utf8");
const localizedLanguageScript = languageScript.replace(
  /filePath:\s*"(?:public\/)?i18n\/"/,
  'filePath: "public/i18n/"',
);
if (localizedLanguageScript === languageScript && !languageScript.includes('filePath: "public/i18n/"')) {
  throw new Error("Unable to localize the language bundle path.");
}
await writeFile(languageScriptPath, localizedLanguageScript, "utf8");

console.log(`Generated ${pages.length} non-home pages. Homepage was not modified.`);
