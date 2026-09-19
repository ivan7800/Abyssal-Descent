# Abyssal Descent

**Abyssal Descent** is an original open-source cosmic-horror grid dungeon crawler for the browser. It is inspired by classic first-person CRPGs and dungeon crawlers while using original code, writing, enemies, maps, systems and presentation.

Current release: **v1.1.0 — bilingual EN/ES edition**.

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
- Procedural Web Audio ambience/SFX with no external audio assets.
- Reduced-motion and audio preferences stored independently from expedition saves.
- Keyboard plus clickable/touch-friendly controls.
- Complete **English / Spanish** interface and game-text localization with persistent language selection.

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
5. Standalone asset/parity verification.
6. Standalone boot + expedition-start smoke test using the production canvas runtime.
7. Static `dist/` build.

For source-only React/Phaser type/build checks after installing dependencies:

```bash
npm run typecheck
npm run build:source
```

## Language / Idioma

Use the **ES / EN** selector in the top bar at any time. The selection is saved under `abyssal-descent-language-v1` and is independent from the campaign save. On a first visit, Spanish is selected automatically for browsers configured with a Spanish locale.

El selector **ES / EN** de la barra superior puede cambiarse en cualquier momento. La preferencia se conserva entre sesiones y no modifica ni invalida la partida guardada.

## Controls

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
