# Silom CFD Web Copy Preflight

- Audit date: 2026-11-20 (Asia/Shanghai)
- Source origin: `https://www.silomcfd.com/`
- Local origin: `http://127.0.0.1:4174/`
- Workspace: `C:\Users\shuyi\OneDrive\Documents\ChatGPT\accounting\silomcfd-clone`
- Authorized scope: publicly reachable same-origin pages and their public static assets
- Included page families: to be finalized by the route inventory; the public home page and shared site shell are included
- Excluded routes: authenticated, paywalled, CAPTCHA-protected, or robots-disallowed routes; none observed in the initial home-page probe
- Site type: public multi-page site with JavaScript-enhanced interactions
- Access limits: no login, paywall, or CAPTCHA observed on the root page; `robots.txt` is saved and enforced by the collector
- Workspace isolation: confirmed; all source evidence, local assets, implementation, and audits stay under this directory
- Required collection stages: Node `fetch()` inventory first, then independently launched Playwright Microsoft Edge
- Script collection: available after network approval; initial root probe returned HTTP 200
- Independent Edge: available at `C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`
- Audit viewports: desktop `1440x900`, mobile `390x844`
- Browser settings: `en-US`, device scale factor 1, reduced motion enabled for deterministic screenshots
- Dynamic state: animations are frozen after page settling; cookie banners and third-party widgets are recorded if present
- Scope decision: full public same-origin route inventory, followed by representative rendered captures for every discovered page family
- Acceptance impact: pixel-accurate completion requires both collection stages plus source-versus-local desktop and mobile comparisons; HTTP success alone is insufficient

## Collection order

1. Direct public HTML, route, stylesheet, script, font, icon, and image inventory.
2. Independent Edge capture of rendered layout, computed navigation geometry, responsive state, and interactions.
3. Local implementation and repeated source-versus-local audits.
