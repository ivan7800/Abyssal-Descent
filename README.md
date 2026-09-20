# Abyssal Descent

Abyssal Descent is an original open-source cosmic-horror grid dungeon crawler for the browser.

## Current release

**v2.3.0 — C64 Edition**

This release replaces the stacked cinematic renderer chain with one lightweight 320×200 C64-style renderer scaled pixel-perfect to the game viewport. It keeps the existing campaign, classes, combat, saves, Codex, Daily Descent, achievements, bilingual UI and offline/PWA support.

### Why v2.3

The previous premium renderer stack loaded several presentation layers in sequence, making movement too expensive and causing stalls. v2.3 loads only one gameplay renderer: `v23-c64.js`.

### Validation

- 48/48 UI actions pass
- 4000/4000 generated floors connected and collision-free
- C64 renderer regression passes
- 400 consecutive turn inputs complete without deadlock
- internal framebuffer: 320×200
- nearest-neighbour pixel scaling to 800×500

The project remains original and does not use copyrighted assets from commercial games.
