# Abyssal Descent

**Abyssal Descent** is an original open-source cosmic-horror grid dungeon crawler for the browser. It is inspired by classic first-person CRPGs and dungeon crawlers while using original code, writing, enemies, maps, systems and presentation.

Current release: **v1.4.0 — Presentation Pass**.

## What changed in v1.4.0

- Added a cinematic **title hub** with Resume, New Expedition, Daily Descent, Codex, Achievements and Options.
- New Expedition now reveals the original archetype/seed setup without removing or simplifying it; `Esc` or **Back to title** returns to the new hub.
- Added bilingual **Act I–IV transition cards** and dedicated guardian encounter presentation.
- Added a cinematic **Daily Descent result card** with score, steps, damage taken and secrets.
- Upgraded achievement toasts and boss-panel visual emphasis.
- Added responsive/mobile layouts plus `prefers-reduced-motion` fallbacks; the existing in-game Reduced Motion option also shortens presentation timing.
- Campaign logic, procedural generation, enemies, items, saves and boss balance are unchanged from v1.3.0.
- Added `npm run v14-check` and `npm run v14-runtime` to the release gate.

## What changed in v1.3.0

- Added **Advanced options** without changing campaign balance: independent SFX and ambience volume, 90–125% text scaling, fullscreen control and persistent keyboard remapping.
- Gameplay primary keys can be rebound safely; collisions swap bindings automatically, while arrow keys remain fixed movement aliases for accessibility.
- Added **Daily Descent** using a globally shared UTC seed (`ABYSS-DAILY-YYYY-MM-DD`), a deterministic scoring model and a locally stored best result for each date.
- Added **12 persistent achievements** tied to combat milestones, depth, no-retreat completions, Codex collection, authored anomalies, endings and Daily Descent completion.
- Achievement progress is surfaced both in its own panel and inside the persistent Codex.
- Split procedural Web Audio into independent SFX and ambience buses; the existing global audio on/off switch remains intact.
- Added a dedicated `npm run v13-check` gate for settings sanitization, binding collisions, UTC daily seeds, scoring and achievement unlock rules.
- Kept the v5 campaign save format, procedural generation and boss balance unchanged.

## What changed in v1.2.0

- Added an installable **Progressive Web App (PWA)** with a relative GitHub-Pages-safe manifest, 192/512 icons and a versioned service worker.
- After the first successful load, the production game can reload and play **offline** from its local cache.
- Added **Export save** / **Import save**. The JSON export contains the validated v5 expedition, persistent Codex progress and language preference.
- Imports are validated atomically before replacing the current checkpoint; malformed files cannot overwrite a valid save.
- Added a persistent **Codex** accessible from the always-available expedition tools bar, covering the 14 enemies, 26 items/relics, four acts, discovered journal notes, five endings and eight authored anomalies.
- Codex discoveries persist independently of individual expeditions and are merged, not erased, when importing another profile.
- Added secret/anomaly completion percentages and an overall discovery completion indicator.
- Extended the production release gate to verify manifest/service-worker assets and to smoke-test Codex unlocks plus valid/invalid save export/import.

## What changed in v1.1.0

- Added a persistent **Español / English** language selector available from the title screen and during an expedition.
- Spanish is selected automatically on first visit when the browser locale begins with `es`; the player can override it at any time.
- Localized the full player-facing experience: UI, archetypes, items, enemies, intents, four acts, objectives, journal entries, combat/exploration logs, set-piece rooms, endings and canvas overlays.
- Language changes redraw the first-person canvas immediately and do not require restarting or abandoning a run.
- Language preference is stored independently from expedition saves.
- Added `npm run i18n-check` and included it in the release gate so missing EN/ES content fails CI.
- The standalone production runtime used by GitHub Pages is fully bilingual while canonical game state/save data remains language-neutral.

## What changed in v1.0.1

The previous archive was correct as a Vite **source project**, but its root `index.html` pointed to `/src/main.tsx`. That file must be transformed by Vite. If GitHub Pages was configured as **Deploy from branch** against the repository root, Pages served the uncompiled TSX entry and the visible result was only the dark page background.

v1.0.1 removes that deployment trap:

- `docs/` is a complete standalone production build.
- The production build has **no runtime npm, React, Phaser, Vite or CDN requirement**.
- Root `index.html` redirects to `./docs/`, so branch deployment from `/ (root)` also starts correctly.
- GitHub Actions tests and deploys a generated `dist/` copied from the audited standalone build.
- A lightweight canvas compatibility runtime preserves the existing DungeonScene/game logic without removing campaign content or features.
- Runtime failures show an error panel instead of silently leaving a black screen.

## Features

- Four-act compact campaign: The Forgotten Cells, The City Below, The Dreaming Depths and The Great Abyss.
- Three playable archetypes with distinct active and passive identities.
- Seeded `17 × 13` procedural floors with reproducible expeditions and hand-authored anomaly encounters.
- 14 enemy definitions, elites, an optional miniboss and four phased guardians.
- Turn-based combat with Attack, Guard, Focus, class abilities, flee, criticals, stagger, defense and sanity pressure.
- 26 item definitions with weapons, charms, stacked consumables, quest items, unique artifacts and secret rewards.
- Sanity states with hallucinations, false silhouettes and an unreliable minimap at low sanity.
- NPC/journal narrative, optional secrets, multiple endings and a hidden ending path.
- Local manual saves and autosave checkpoints through `localStorage`, with defensive save validation and corrupted-save recovery.
- End-of-run statistics.
- Procedural Web Audio ambience/SFX with no external audio assets, now with independent effects/ambience volume controls.
- Reduced-motion and audio preferences stored independently from expedition saves.
- Keyboard plus clickable/touch-friendly controls.
- Complete **English / Spanish** interface and game-text localization with persistent language selection.
- Installable/offline PWA production build with portable JSON saves and persistent Codex metaprogression.
- Advanced options with persistent key remapping, fullscreen and text scaling.
- UTC-shared Daily Descent seed, deterministic daily score and local best records.
- 12 persistent internal achievements integrated with the Codex.

## Run locally — no dependency installation required

Node 22+ is sufficient for the standalone release:

```bash
npm run dev
```

Open `http://127.0.0.1:5173/`.

Create and preview the exact Pages artifact:

```bash
npm run build
npm run preview
```

Source-development mode with React + Phaser remains available and has not been removed:

```bash
npm install
npm run dev:source
```

## QA commands

```bash
npm run validate
npm run balance
npm run ui-regression
npm run i18n-check
npm run v13-check
npm run v13-runtime
npm run v14-check
npm run v14-runtime
npm run static-check
npm run runtime-smoke
npm test
npm run check
```

`npm run check` is the production release gate and does **not** require downloading third-party packages:

1. Procedural/content validation.
2. Deterministic boss-balance regression.
3. UI/button and complete four-act campaign regression.
4. EN/ES localization coverage for UI, content and dynamic game text.
5. v1.3 product-system validation: advanced settings, remappable bindings, UTC daily seed/scoring and 12 achievements.
6. v1.3 DOM/bootstrap smoke: toolbar, settings, Daily Descent, achievements and split-audio application.
7. v1.4 presentation validation: title hub, bilingual navigation, act/guardian cards and Daily-result presentation.
8. v1.4 DOM/bootstrap smoke: home screen, expedition-profile navigation and act transition.
9. Standalone asset/parity verification.
10. Standalone boot + expedition-start smoke test using the production canvas runtime.
11. PWA manifest/service-worker/install assets and portable-save/Codex smoke coverage.
12. Static `dist/` build.

For source-only React/Phaser type/build checks after installing dependencies:

```bash
npm run typecheck
npm run build:source
```

## Language / Idioma

Use the **ES / EN** selector in the top bar at any time. The selection is saved under `abyssal-descent-language-v1` and is independent from the campaign save. On a first visit, Spanish is selected automatically for browsers configured with a Spanish locale.

El selector **ES / EN** de la barra superior puede cambiarse en cualquier momento. La preferencia se conserva entre sesiones y no modifica ni invalida la partida guardada.

## PWA / offline installation

The production release includes `manifest.webmanifest`, 192/512 PNG icons and `sw.js`. On supported desktop/mobile browsers an **Install app** button appears when the browser exposes its install prompt. Browser-menu installation remains available where the prompt event is not exposed.

The service worker uses a versioned cache and relative URLs, so it works under the GitHub Pages project path (`/Abyssal-Descent/`) as well as local static hosting. After one successful online load, the application shell and game modules are available offline.

## Portable saves and Codex

- **Export save** downloads a `.json` backup containing the v5 campaign save, Codex discoveries and selected language.
- **Import save** validates the campaign before replacing local storage. Existing Codex discoveries are merged with imported discoveries.
- The Codex is available from the persistent expedition tools bar, is stored under `abyssal-descent-codex-v1`, and tracks enemies, items/relics, acts, notes, endings and the eight authored anomalies across expeditions.
- Existing valid v5 saves from v1.0.x/v1.1.0 remain compatible.

## Advanced options / Daily Descent / achievements

- **Advanced options** exposes separate Effects and Ambience volume, text scale, fullscreen and keyboard rebinding. Settings are stored under `abyssal-descent-v13-settings-v1`.
- The remappable primary bindings cover Forward, Back, Turn Left/Right, Interact, Attack, Guard, Focus, Ability and Flee. Arrow keys remain fixed movement aliases.
- **Daily Descent** derives its dungeon seed from the UTC calendar date, so every player receives the same seeded layout on the same day. The best local score for each date is retained.
- **Achievements** are persistent metaprogression stored under `abyssal-descent-achievements-v1`; 12 achievements cover combat, progression, Codex completion, endings and the daily challenge.

## Controls

Default primary bindings are shown below and can now be changed in **Advanced options**.

Exploration:

- `W` / Arrow Up — move forward
- `S` / Arrow Down — move backward
- `A` / Arrow Left — turn left
- `D` / Arrow Right — turn right
- `E` — interact
- `M` — toggle procedural audio

Combat:

- `F` — attack
- `G` — guard
- `R` — focus
- `Q` — class ability
- `X` — flee when allowed

## Saves

The game uses save format **v5** under `abyssal-descent-save-v5`.

- v1.0.1 remains compatible with valid v1.0.0 saves.
- A dead run cannot overwrite the last valid checkpoint.
- Browser storage failures are handled without crashing the game.
- Structurally malformed saves are rejected before live state is changed.
- v1.2.0+ can export/import portable JSON backups without changing the underlying v5 campaign-save format.
- v1.3.0 keeps Daily Descent, achievements and advanced-option preferences as browser-local metaprogression.

## GitHub Pages

### Recommended: GitHub Actions

In **Settings → Pages → Build and deployment**, select **GitHub Actions**. Push to `main`; `.github/workflows/deploy.yml` runs `npm run check` and publishes `dist/`.

### Also supported: Deploy from branch

The release deliberately supports both common Pages configurations:

- `main` + `/ (root)` — root `index.html` redirects to `docs/`.
- `main` + `/docs` — `docs/index.html` is already the complete standalone app.

No Vite build is required by either branch-deployment option.

## Validation

See [VALIDATION.md](VALIDATION.md) and [AUDIT.md](AUDIT.md).

## IP / project scope

This project is an original work. It does **not** include *Cyclopean: The Great Abyss* assets, text, source code, maps, characters or music. Inspiration is limited to broad genre mechanics such as grid exploration, turn-based RPG combat and cosmic horror.

## License

MIT. See [LICENSE](LICENSE).
