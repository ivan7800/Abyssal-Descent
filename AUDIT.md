# Release Audit — Abyssal Descent v1.0.1

## Black-screen root cause

The v1.0.0 archive shipped the development Vite entry at repository root:

```html
<script type="module" src="/src/main.tsx"></script>
```

That entry is valid when Vite serves/transforms it or when `vite build` produces `dist/`. It is **not a deployable static GitHub Pages entry by itself**. When Pages was set to **Deploy from branch → main / (root)**, the browser received raw TSX/TypeScript instead of a production bundle. The CSS background still loaded, producing the reported black screen.

This was a release-packaging defect: the previous automated game tests did not exercise the exact static artifact served by the alternative Pages configuration.

## Correction

v1.0.1 adds a separate, audited production surface under `docs/`:

- no runtime third-party dependency;
- no CDN dependency;
- no TypeScript/TSX in the browser path;
- relative asset URLs safe under a GitHub repository subpath;
- native canvas rendering compatibility layer for the existing scene API;
- production UI preserving every existing button/action/content system;
- visible boot/runtime error fallback instead of silent black output;
- root redirect for Pages deployments that publish `/ (root)`;
- deterministic `dist/` builder used by GitHub Actions.

The React + Phaser source tree remains intact for development. No game feature or campaign content was removed to make deployment work.

## Release checks executed

```text
npm test
npm run static-check
npm run runtime-smoke
npm run build
npm run check
```

Results:

- content integrity: PASS — 14 enemies, 26 items, 3 archetypes;
- procedural generation: PASS — 4,000 / 4,000 floors;
- deterministic boss balance gate: PASS;
- UI/campaign contracts: PASS — 25 button templates and four-act progression;
- standalone static assets/parity: PASS;
- standalone production boot: PASS;
- production expedition start: PASS;
- standalone canvas renderer: PASS (`379` draw operations in the smoke run);
- production `dist/` creation: PASS.

## Browser-host limitation

The container's managed Chromium blocks both localhost and `file:` navigation by organization policy, so a visual Chromium screenshot could not be obtained here. To avoid treating that as success, the release includes a production-runtime smoke harness that boots the exact standalone `DungeonScene` and canvas compatibility layer against a simulated DOM/canvas and starts a real Surveyor expedition. This runtime test passes.
