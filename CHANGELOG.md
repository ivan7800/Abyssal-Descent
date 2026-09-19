# Changelog

## 1.2.0 — PWA, portable saves and persistent Codex

### Installable / offline production

- Added a GitHub-Pages-safe PWA manifest, local 192/512 icons and a versioned service worker.
- Production remains dependency-free at runtime and can reload offline after its first successful cached visit.
- Added browser install-prompt integration while preserving normal browser-menu installation.

### Portable save management

- Added Export Save and Import Save controls.
- Exports package the validated v5 expedition, persistent Codex metadata and language preference into a portable JSON file.
- Imports validate the save before storage mutation; malformed imports leave the current valid checkpoint untouched.
- Imported Codex progress is merged with local discoveries rather than replacing them.

### Persistent Codex

- Added a persistent Codex launcher to the expedition tools bar, available from the title screen and during an expedition.
- Tracks all 14 enemy definitions, 26 item/relic definitions, four acts, discovered journal notes, five endings and eight authored anomaly rooms.
- Unlocks persist independently across expeditions under `abyssal-descent-codex-v1`.
- Added overall completion and explicit anomaly/secret percentage readouts.
- Codex import validation rejects unknown enemy/item/ending IDs and invalid anomaly IDs.

### Release engineering

- Static release verification now requires the manifest, service worker and both application icons.
- Production smoke test now validates Codex starting unlocks, save export, valid import restore and invalid-import checkpoint preservation.
- `npm run check` continues to run the unchanged 4,000-floor generation and boss-balance gates before producing `dist/`.

## 1.1.0 — English / Spanish localization

### Full bilingual experience

- Added persistent **ES / EN** language controls on the title screen and during active expeditions.
- Added browser-locale detection: Spanish is the first-run default for `es-*` browsers while English remains available instantly.
- Localized all three archetypes, all 26 items, all 14 enemies, enemy intents, four acts, objectives, journals, eight authored anomaly rooms, combat/exploration logs, interactions and all endings.
- First-person canvas labels, overlays, floor names and Surveyor bearings now redraw immediately in the selected language.
- Language preference is stored separately from save data so switching language never invalidates an expedition.
- Kept English text as the canonical game-state data, translating only at presentation time; existing v5 saves remain compatible.

### QA / release engineering

- Added `scripts/i18n-check.cjs` with content-count and dynamic-text assertions.
- Added explicit production-language selector coverage through the standalone localization gate; existing source UI regression remains unchanged.
- Standalone runtime smoke now verifies language preference persistence.
- Static release validation now requires the standalone `i18n.js` module and verifies the production localization layer without altering canonical save-state strings.

## 1.0.1 — GitHub Pages black-screen hotfix

### Deployment fix

- Confirmed the black-screen root cause: repository-root Pages could serve the raw Vite `/src/main.tsx` development entry without a Vite transformation/build.
- Added a complete standalone production application under `docs/`.
- Added a root redirect so **Deploy from branch → main / (root)** opens the standalone application.
- `main /docs` branch deployment is also supported directly.
- GitHub Actions now deploys a deterministic `dist/` generated from the audited standalone build and no longer needs an npm dependency download to publish.
- Production runtime has no CDN dependency and no React/Phaser/Vite dependency at runtime.
- Kept the React + Phaser source project intact under `src/`; `source.html` is the dedicated Vite development entry.

### Runtime resilience

- Added a lightweight Canvas 2D compatibility runtime implementing the subset of the Phaser scene API used by the game.
- Preserved the complete existing DungeonScene state machine, campaign content, save system, combat, audio, sanity, minimap, endings and controls.
- Added visible boot/runtime error output so a startup exception no longer degrades into an unexplained black page.
- Added `scripts/static-check.cjs` to verify the actual production artifact and prevent remote/CDN dependencies from creeping in.
- Added `scripts/standalone-runtime.cjs` to boot the production scene, start an expedition and verify renderer activity.
- Added dependency-free local `npm run dev`, `npm run build` and `npm run preview` commands for the production release.


## 1.0.0 — Final audited release

### Release-blocking fixes

- Made browser storage access exception-safe so blocked/private/quota-limited `localStorage` cannot crash the scene.
- Prevented dead expeditions from overwriting the last valid checkpoint; Save is disabled after death and protected in the scene layer as well.
- Added atomic v5 save validation before state mutation, plus removal of corrupted/unsupported saves so Resume cannot enter a broken loop.
- Fixed keyboard capture so seed text fields and modified browser shortcuts are never hijacked; gameplay arrows prevent page scrolling only when actually used by the game.
- Corrected first-person corridor depth projection and near-wall occlusion.
- Fixed stale location labels remaining visible over combat.
- Changed Surveyor objective guidance from Manhattan direction to real BFS path distance, so it no longer points through walls.
- Prevented one-use refuges from being consumed at full resources.
- Stopped tile rewards/events from resolving after panic damage kills the player during movement.
- Made successful flee movement count as a step, reveal the destination and resolve that tile consistently.
- Hardened Web Audio initialization/resume/disconnect behavior for browsers where AudioContext is unavailable or suspended.

### UI and inventory corrections

- Death state now takes precedence over the enemy panel, so lethal combat shows checkpoint recovery rather than inert combat buttons.
- Inventory actions are locked after death and during final-ending resolution.
- Consumables cannot be wasted when they would provide no positive vitality/sanity benefit; UI and scene logic both enforce this.
- Added progressbar ARIA metadata, persistent pressed-state hints, canvas labeling and clearer disabled-button behavior.

### Automated regression coverage

- Added `scripts/ui-regression.cjs`.
- Audits all 25 JSX button templates for click handlers and verifies literal/dynamic action contracts.
- Exercises all three archetype starts, preferences, keyboard filtering, movement, interaction, inventory, all combat actions, flee, save/load, death protection, storage denial, malformed saves, all ending branches, Surveyor routing, perspective regression and stale-overlay cleanup.
- Exercises the complete four-act campaign state machine through final-choice presentation.
- Package promoted from `1.0.0-rc.1` to `1.0.0`; direct dependency versions are pinned and Node requirement is `22.12+`.

## 1.0.0-rc.1 — Release Candidate

### Balance and pacing

- Reduced procedural floor dimensions to `17 × 13` for denser exploration and less repetitive corridor travel.
- Added deterministic generator pacing metrics for mandatory objective routes.
- Added a reproducible Monte Carlo boss-balance regression script with minimum/explorer equipment profiles.
- Tuned boss heavy attacks so telegraphed Guard decisions matter more.
- Adjusted late-game balance so exploration materially improves Surveyor/Occultist survival while Veteran remains the safer introductory class.

### Archetype identity

- Added true passive identities to all three archetypes.
- Surveyor now reveals a wider minimap area and receives bearing/distance information toward objectives.
- Occultist gains innate sanity resistance and stronger Focus recovery.
- Veteran gains stronger Guard and improved medical healing.

### Inventory and equipment

- Consumables now stack by quantity instead of filling the inventory with duplicate rows.
- Added Bone Sabre, Cantor Needle and Dream Sickle as sidegrade weapons with different crit/sanity profiles.
- Reworked floor loot and boss reward placement to reduce duplicate rewards.
- Removed the useless post-final-boss equipment reward.
- Star Cutter is now tied to secret progression rather than ordinary floor loot.
- Prevented duplicate unique-item acquisition.
- Locked equipment changes during combat and after entering final-ending choice mode.

### Exploit fixes

- Fixed max-sanity equipment swapping granting free current sanity.
- Fixed combat consumables preserving Guard state / cooldown timing without a proper new turn.
- Run damage statistics now count actual damage rather than overkill values.
- Panic and zero-sanity self-damage now count toward run damage taken.

### Campaign and UX

- Added clearer `(completed / required)` objective counters throughout the campaign.
- Added discovered objective markers to the minimap.
- Added additional autosave checkpoints after major optional/mandatory progression milestones.
- Added boss journal entries for all four guardians.
- Added end-of-run statistics covering kills, guardians, elites, damage, consumables, retreats, rests, steps, secrets and Act IV mapping.
- Added combat keyboard shortcuts: `G` Guard, `R` Focus and `X` Flee.
- Improved combat button labels/tooltips and inventory lock feedback.
- Fixed audio re-enable behavior so ambience resumes for the current act instead of Act I.
- Audio and reduced-motion preferences now persist independently from expedition saves.
- Added visible keyboard focus treatment and ARIA state hints to key UI controls.
- Major encounter checkpoints are written after reward resolution so checkpoint inventory matches the completed encounter.

### Validation and release engineering

- Migrated save format to **v5**.
- Added `scripts/validate.cjs` for content integrity, connectivity, spawn collision and route-density regression checks.
- Added `scripts/balance.cjs` for deterministic combat-balance regression checks.
- Validation now covers **1,000 seeds × 4 acts = 4,000 generated floors**.
- GitHub Pages workflow now runs the complete `npm run check` release gate before deployment.
- Package version promoted to `1.0.0-rc.1`.

## 0.4.0 — Quality Pass

- Added Act IV: The Great Abyss.
- Added The Void Saint final guardian.
- Added multi-phase boss encounters and dynamic intents.
- Added optional Mirror Stalker miniboss and unique Mirror Shard reward.
- Added Bell Devourer elite enemy.
- Added authored anomaly chambers on every act.
- Added secret discovery tracking and hidden ending path.
- Added Star Cutter, Saint Bone, Mirror Shard, Abyss Key and Black Draught.
- Added critical-chance, sanity-resistance and heal-on-kill equipment properties.
- Added sanity-state labels and stronger low-sanity presentation effects.
- Added hallucinated silhouettes and unreliable minimap behavior.
- Added procedural Web Audio ambience and SFX.
- Added combat camera feedback.
- Added audio toggle and reduced-motion toggle.
- Migrated save format to v4.
- Expanded generator validation to four acts.
