# Replication Progress

| Component | Status | Fidelity | Evidence |
|---|---|---:|---|
| Direct route and asset inventory | Done | Verified | `evidence/direct/manifest.json` |
| Independent Edge source baseline | Done for home | Home desktop/mobile full-page captures verified | `evidence/browser/source/` |
| Global typography and design tokens | Done for home | Rubik, colors, spacing, cards, footer and responsive breakpoints implemented | `styles.css` |
| Navbar and responsive drawer | Done | Desktop 99.8483%; mobile 99.9385% measured pixel similarity | `evidence/browser/audit/` |
| Hero section | Done | Desktop and mobile geometry matched | `evidence/browser/local/` |
| Spread feature panel | Done | Desktop exact; mobile within 0.03px text raster tolerance | `evidence/browser/audit/above-fold-pixel-diff.json` |
| Deposit/about section | Done | Desktop exact; mobile within 0.03px raster rounding | `evidence/browser/local/` |
| Six-product service grid | Done | Card geometry exact at desktop and mobile | `evidence/browser/audit/home-audit.json` |
| Trading platform section | Done | Text and image geometry matched at desktop/mobile | `evidence/browser/local/` |
| Footer and back-to-top | Done | Three-column/stacked geometry exact; interaction verified | `evidence/browser/audit/home-audit.json` |
| Complete homepage | Done | Desktop 99.3741%; mobile 98.0107% measured full-page pixel similarity | `evidence/browser/audit/full-page-pixel-diff.json` |
| Internal page route generation | Done | 18/18 valid non-home routes return HTTP 200 | `scripts/build-pages.mjs` |
| Article pages | Done | Desktop/mobile visible-content and image QA passed | `evidence/browser/pages-audit/` |
| Accounts and product pages | Done | Desktop/mobile visible-content and image QA passed | `evidence/browser/pages-audit/` |
| MT4 platform page | Done | Desktop/mobile visible-content and image QA passed | `evidence/browser/pages-audit/` |
| Analysis and calendar pages | Done | TradingView `tv-economic-calendar` Web Component; live desktop/mobile data and retry/offline fallback verified | `evidence/browser/calendar-widget/`, `evidence/browser/calendar-widget-live/` |
| About and contact pages | Done | Desktop/mobile visible-content and image QA passed | `evidence/browser/pages-audit/` |
| Complete non-home route audit | Done | 36/36 page-viewport checks pass; 0 broken images, overflow, preloaders, or failed local resources | `evidence/browser/pages-audit/pages-audit.json` |
