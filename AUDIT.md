# Navbar Build, Audit, Refactor, and Acceptance

Audit date: 2026-11-20 (Asia/Shanghai)

## BUILD

The completed component uses semantic `header` and `nav` elements with BEM-style classes. It includes:

- the desktop primary menu, nested submenus, and language selector
- the responsive 300px mobile drawer and two-level accordion navigation
- local Rubik and Font Awesome assets collected from the public source site
- hover, click, Escape, overlay, resize, language, focus, and sticky-header behavior
- `aria-expanded`, `aria-hidden`, `inert`, focus transfer, and focus restoration

Final implementation: `index.html`, `styles.css`, and `script.js`.

## VISUAL & CODE AUDIT

### Visual differences found

- The first local build rendered the desktop menu at `619.125px`; the source measured `663.328125px`.
- The hand-drawn mobile hamburger differed visibly from the source Font Awesome glyph.
- Opening-state measurements initially sampled the 400-450ms transition instead of the settled frame.
- The drawer's animated `visibility` prevented immediate focus transfer to its close button.

### Interaction gaps found

- Hidden drawer content needed `inert` so it could not receive keyboard focus.
- Drawer opening needed explicit focus movement; closing needed focus restoration.
- Desktop dropdowns needed click and Escape support in addition to hover behavior.

### Code quality findings

- Shared color, spacing, timing, and shadow values were consolidated into CSS custom properties.
- Repeated navigation state is driven by data attributes and reusable event handlers.
- The source's jQuery-dependent behavior was reproduced with dependency-free JavaScript.

## REFACTOR & PERFECT

- Matched source header geometry: desktop `1440x108`, mobile `390x75`.
- Matched source logo geometry: desktop `(130, 31.5, 200, 45)`, mobile `(20, 15, 200, 45)`.
- Matched desktop nav geometry within subpixel rendering tolerance: source `x=447.3125, width=663.328125`; local `x=447.265625, width=663.484375`.
- Replaced the mobile hamburger with the source Font Awesome asset.
- Changed drawer visibility timing so it becomes focusable immediately and turns hidden only after closing animation.
- Added repeatable geometry, interaction, and pixel-diff scripts.

## Acceptance evidence

| Viewport | Source header | Local header | Different pixels | Similarity |
|---|---:|---:|---:|---:|
| Desktop 1440x900 | 1440x108 | 1440x108 | 236 / 155,520 | 99.8483% |
| Mobile 390x844 | 390x75 | 390x75 | 18 / 29,250 | 99.9385% |

All scripted behavior checks pass: dropdown hover, dropdown click, Escape close, sticky positioning, drawer open/close, overlay, two-level accordion, language switch, no horizontal overflow, focus transfer, hidden-state inertness, and focus restoration.

Residual pixels are limited to browser text and icon antialiasing in the fixed screenshot environment. Because nonzero pixel differences remain, this audit does not make a literal 100% pixel-identity claim.

## Preview blank-state repair

The first preview contained only the completed Navbar and an empty `component-stage`, so a successful HTTP response still appeared blank below the header. The placeholder was replaced with the source Hero and spread panel, and the inline Hero background image was downloaded locally.

- Desktop Hero geometry matches the source at `1440x500.796875` including title, summary, CTA, and panel coordinates.
- Mobile Hero geometry matches the source at `390x430.1875`; panel height differs by only `0.03125px` due to text rasterization.
- Independent Edge reports HTTP 200, zero console errors, zero failed requests, and no horizontal overflow at both audit viewports.

## Complete homepage repair and acceptance

The unfinished homepage was completed with all remaining public source sections:

- deposit/about content
- six-product service grid with the collected Flaticon font
- MT4 trading-platform content and source image
- risk, navigation and contact footer columns
- responsive footer stacking and working back-to-top control

### Geometry audit

| Viewport | Source height | Local height | Service cards | Footer |
|---|---:|---:|---|---:|
| Desktop 1440x900 | 3773px | 3773px | 6 x 414x264px | 748.281px |
| Mobile 390x844 | 4968px | 4968px | 366px wide; source heights matched | 1214.422px |

Desktop service, platform, footer-column and footer-bottom geometry matches the source measurements. Mobile measurements differ by at most 0.03125px from text-layout raster rounding.

### Full-page visual audit

| Viewport | Different pixels | Total pixels | Similarity |
|---|---:|---:|---:|
| Desktop | 34,004 | 5,433,120 | 99.3741% |
| Mobile | 38,544 | 1,937,520 | 98.0107% |

The remaining pixel differences are concentrated in browser text/icon rasterization and the source page's own 1468px desktop horizontal overflow. The local copy intentionally avoids that overflow and remains 1440px wide.

### Functional QA

- Both audit viewports return HTTP 200.
- Console errors: 0.
- Failed requests: 0.
- Horizontal overflow: none.
- Back-to-top reaches `scrollY = 0` on desktop and mobile.
- Existing dropdown, drawer, Escape, focus, language and sticky-header tests continue to pass.

## Non-home blank-page repair and acceptance

The blank internal routes were HTTP 404 responses rather than hidden page content: only the custom homepage existed at the clone root. The repair generated all 18 public non-home routes whose source responses are valid, while leaving source-side 404 routes such as `project.html`, `faq.html`, and `service-details.html` ungenerated.

### Repair work

- Added a repeatable page builder that preserves the completed custom homepage.
- Rewrote source-site CSS, JavaScript, image, and Cloudflare helper paths to local `/public` assets.
- Disabled the source preloader as a defensive fallback so a JavaScript failure cannot leave a permanent white overlay.
- Fixed the source template's 27px desktop and 6px mobile horizontal overflow.
- Changed external image collection from filename-only storage to full URL-path storage, preventing same-name article images from overwriting each other.
- Localized 44 public CDN images and both runtime language bundles.
- Kept TradingView market widgets and installer links as live third-party dependencies.

### Browser acceptance

Independent headless Microsoft Edge checked every non-home page at `1440x900` and `390x844`, for 36 total page/viewport combinations.

| Check | Result |
|---|---:|
| HTTP 200 | 36 / 36 |
| Visible page body, header, and footer | 36 / 36 |
| Broken images | 0 |
| Visible preloaders | 0 |
| Horizontal overflow | 0 |
| Failed local requests | 0 |
| Local responses with status >= 400 | 0 |
| Minimum visible text | 120 characters |
| Minimum document height | 1194px |

Representative full-page screenshots cover article, account, product listing, product detail, MT4 platform, market analysis, calendar, about, and contact families in both viewports. Live TradingView and MQL5 content can still vary or fail when the preview environment blocks their external networks; this does not affect the locally reconstructed page shell or content.

## Calendar provider replacement

Replaced the source MQL5 calendar script with TradingView's public Economic Calendar Web Component: `tv-economic-calendar.js` plus `<tv-economic-calendar>`. With no filter attributes, TradingView supplies its current default all-country and all-importance view in a light theme. A local status panel includes a retry control and direct TradingView link; if the module is unavailable, the panel fills the widget area so the calendar page does not collapse into a blank section.

The public module URL returned HTTP 200 and its exported custom element name and supported filters were inspected before implementation. TradingView remains a live third-party dependency, so its module, iframe, and event API must be reachable in the visitor's browser.

Independent Playwright Microsoft Edge validation covers both failure/retry behavior and the live component at `1440x900` and `390x844`. The controlled failure audit returned HTTP 200, displayed the retry/link fallback, stayed within the viewport, and transitioned to ready after a mocked reload. The live audit loaded the TradingView module, custom element, cross-origin calendar iframe, event-data API, and responsive desktop/mobile tables without failed requests or horizontal overflow. The MQL5 and legacy TradingView embed scripts are absent. Evidence: `evidence/browser/calendar-widget/calendar-widget-audit.json`, `evidence/browser/calendar-widget-live/calendar-widget-live.json`, and their screenshots.
