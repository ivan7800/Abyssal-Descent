# Abyssal Descent v1.4.0 — Validation Report



## v1.4.0 Presentation Pass gate

The v1.4 layer is presentation-only and leaves the v1.3 campaign/runtime core unchanged. Automated checks verify the cinematic title hub, Resume/New Expedition navigation, Daily/Codex/Achievements/Options launchers, bilingual Act/guardian cards, Daily completion summary, responsive/reduced-motion presentation and the v1.4 service-worker cache set.

`npm run v14-runtime` boots the production presentation layer against a simulated browser/runtime, verifies the home hub mounts, enters and exits the original expedition-profile screen, and renders an Act transition. The full release gate still passes the unchanged **4,000 / 4,000** floor generation and deterministic boss-balance checks.

## v1.3.0 advanced-options / Daily Descent / achievements gate

The v1.3 product layer is additive to the existing four-act campaign and keeps the procedural generator and combat balance unchanged.

Automated checks verify:

- independent SFX and ambience settings clamp to safe `0..1` ranges;
- text scaling is constrained to 90–125%;
- custom gameplay bindings remain unique even when imported input contains collisions;
- the shared Daily Descent seed is derived from the **UTC** date and has stable `ABYSS-DAILY-YYYY-MM-DD` form;
- deterministic daily scoring rewards completion while accounting for bosses, kills, secrets, level, steps, damage and retreats;
- all 12 achievement rules unlock under the expected complete-run/Codex conditions;
- the production audio runtime contains distinct SFX and ambience buses;
- the v1.3 JS/CSS/meta assets are linked from the standalone Pages entry and precached by the service worker.

`npm run check` passes with the v1.3 gate included, including a simulated-DOM bootstrap test that mounts the v1.3 toolbar and opens the Settings, Daily Descent and Achievements panels. The release still validates **4,000 / 4,000** generated floors and the same deterministic boss-balance thresholds as v1.2.

A direct standalone typecheck of the modified `src/game/audio.ts` also passes. The full React/Phaser source-project `npm run typecheck` requires installed React/Phaser packages and is not part of the dependency-free Pages release gate.

## v1.2.0 PWA / portable-save / Codex gate

The shipping standalone build now includes a relative-scope PWA manifest, versioned service worker, two local PNG application icons, portable save export/import and persistent Codex metaprogression.

Automated checks verify:

- `manifest.webmanifest` uses `./` start/scope and `standalone` display mode;
- service-worker install/activate/cache markers and all required local assets are present;
- no runtime CDN/bare-import dependency is introduced;
- the starting expedition unlocks Act I and starting items in the Codex;
- export produces an `abyssal-descent-save` bundle tagged with the current product version;
- importing that validated bundle restores the saved state;
- malformed import text cannot overwrite the existing valid v5 checkpoint;
- Codex payload validation only accepts known content IDs, valid ending titles and the eight authored anomaly IDs.

`npm run check` passes after these additions. The underlying campaign save remains format v5, preserving compatibility with valid previous saves.

## v1.1.0 bilingual release gate

The production gate now includes `npm run i18n-check`. It verifies EN/ES coverage for **3 archetypes, 26 items, 14 enemies, 4 acts and 8 authored set pieces**, plus representative dynamic combat/exploration strings and language switching in the standalone runtime. The localization gate additionally verifies the standalone ES/EN selector and persistent language preference.

`npm run check` on v1.1.0 passes the procedural, balance, UI/campaign, localization, standalone asset, runtime smoke and static build gates.

## 1. Reported black screen — root cause confirmed

The former repository-root entry was a Vite development entry (`/src/main.tsx`). Serving that raw file from GitHub Pages in **Deploy from branch → / (root)** does not perform Vite's TSX transformation. The HTML/CSS background appears, while the application bootstrap never becomes a valid production JavaScript application.

v1.0.1 separates source development from deployment:

- `source.html` → React/Phaser/Vite development entry.
- `docs/index.html` → standalone production application.
- root `index.html` → safe redirect to `./docs/` for branch-root Pages.
- `dist/` → deterministic copy of the tested standalone production application for GitHub Actions.

## 2. Procedural/content validation — PASS

`scripts/validate.cjs` executed against **1,000 seeds × 4 acts = 4,000 generated floors**.

**Result: 4,000 / 4,000 passed.**

- 14 enemy definitions;
- 26 item definitions;
- 3 archetypes;
- all required exits/objectives/entities reachable;
- no reserved-position collision;
- mandatory-route metrics remain inside their release thresholds.

| Act | Median mandatory route | P90 | Maximum |
| --- | ---: | ---: | ---: |
| I | 46 | 66 | 102 |
| II | 48 | 64 | 86 |
| III | 46 | 60 | 90 |
| IV | 46 | 60 | 88 |

## 3. Boss-balance regression — PASS

The deterministic Monte Carlo gate still passes all class/act/profile thresholds.

| Act | Profile | Surveyor | Occultist | Veteran |
| --- | --- | ---: | ---: | ---: |
| I | minimum | 100.0% | 97.5% | 100.0% |
| I | explorer | 100.0% | 100.0% | 100.0% |
| II | minimum | 100.0% | 100.0% | 100.0% |
| II | explorer | 100.0% | 100.0% | 100.0% |
| III | minimum | 65.3% | 73.2% | 99.9% |
| III | explorer | 95.1% | 99.2% | 100.0% |
| IV | minimum | 42.5% | 42.8% | 90.4% |
| IV | explorer | 85.3% | 81.1% | 100.0% |

## 4. Button/UI/campaign regression — PASS

`scripts/ui-regression.cjs`:

- audits **25 UI button templates**;
- exercises all action contracts;
- covers archetype start, movement, interaction, inventory, combat, save/load, death recovery, preferences and endings;
- exercises complete Act I → II → III → IV → final-choice progression.

**Result: PASS.**

## 5. Standalone production artifact — PASS

`scripts/static-check.cjs` verifies:

- all required production files exist;
- production asset links are relative;
- `main.js` has no HTTP/CDN dependency;
- the production runtime contains the required canvas compatibility layer;
- critical game-system markers remain present in both source and production scene code.

**Result: PASS — 21 required static/PWA/product/presentation assets present; 20 production JS modules resolve locally; no runtime CDN dependency.**

## 6. Production runtime boot — PASS

`scripts/standalone-runtime.cjs` boots the **production** `docs/game/DungeonScene.js` using the production canvas compatibility runtime against a simulated DOM/canvas.

Verified:

- title scene creates successfully;
- initial title snapshot is emitted;
- Surveyor expedition can start;
- floor 1 enters playable state;
- turn/save/preference actions remain functional;
- canvas renderer performs real draw operations.

**Result: PASS — production smoke also exercises Codex unlocks plus save export/import and malformed-import preservation.**

## 7. Production build — PASS

`npm run build` now uses `scripts/build-static.cjs` and creates `dist/` without downloading dependencies.

The artifact contains only local production files and is ready for GitHub Pages.

## 8. Complete release gate — PASS

Executed successfully:

```text
npm run check
```

which currently runs:

```text
npm test
npm run static-check
npm run runtime-smoke
npm run v13-runtime
npm run v14-runtime
npm run build
```

## 9. Visual browser note

The managed Chromium binary in this audit environment is organization-policy blocked from opening both localhost and `file:` pages. Therefore a screenshot-based visual browser pass cannot be honestly claimed here. This restriction does not affect the production runtime smoke test above, GitHub Pages, or normal browsers.

