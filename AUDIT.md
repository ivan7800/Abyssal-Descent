# Abyssal Descent v1.4.2 — Button / Runtime Corrective Audit

## Root causes found

1. **Independent module startup race.** `main.js`, `v12.js`, `v13.js` and `v14.js` were loaded as separate module scripts. Extension layers used polling windows of only about 1–1.5 seconds. On a slow GitHub Pages/mobile/cold-cache load a layer could time out before its dependency initialized, so its listeners were never registered while the base UI still appeared.
2. **Stale Service Worker code mixing.** JavaScript/CSS used cache-first delivery. After an update, HTML could be fresh while listeners and presentation code came from an older cache.
3. **Overlay stacking collision.** The v1.4 title overlay and v1.2 Codex both used `z-index:1000`; their effective clickability depended on paint/insertion order.
4. **Fullscreen close race.** Fullscreen scheduled `renderSettings()` after 80 ms. Closing Options before that callback ran left `modal === null`, causing a real console `TypeError`.

## Corrections

- Added `bootstrap.js` and changed production to a single versioned module entry. It imports core → v1.2 → v1.3 → v1.4 sequentially and shows a visible bootstrap error if a layer fails.
- Added release-aware stale-worker/cache cleanup before the v1.4.2 bootstrap and versioned CSS/bootstrap URLs.
- Changed the v1.4.2 Service Worker to network-first for navigation and code assets, with cache fallback for offline use.
- Rotated cache to `abyssal-descent-v1.4.2-r1`.
- Made stacking explicit: title 900, Codex 1200, options/daily/achievements 1300, cinematic stage 1400, achievement toast 1500.
- Guarded the delayed fullscreen refresh so it only renders while the settings modal still exists.
- Added runtime tests for v1.2 buttons and expanded v1.3/v1.4 click-route tests.
- Added a release button matrix that exercises 48 individual actions.

## Result

`npm run check` passes end-to-end. Procedural generation remains 4000/4000 valid and boss balance/campaign content are unchanged.
