# Pitch amendments (Alpha)

Authoritative feel docs remain [`animation-pitch.html`](./animation-pitch.html) and [`challenges-pitch.html`](./challenges-pitch.html). This file records intentional Alpha deviations.

## Scoring (2026-07-28)

- **Removed** chain combo **point** multipliers (`×2` / `×3` / `×4` from dunk streak).
- **Base dunk** is **+1** (DunkShot-style).
- **Perfect swish** (no wall bounce, no rim contact this flight) awards **+2**.
- **Bank dunk** (≥1 screen-edge wall bounce) awards **+1**.
- **Rim dunk** (rim contact, no wall bounce) awards **+1**, labeled `RIM`.
- Streak juice (`x2` / `x3` / `ON FIRE`, camera shake) remains **visual/audio only**.
- Star pickups add **soft currency only** — they no longer add to run score.

## Aim preview vs obstacles

Aim preview dots truncate at the first obstacle collision while still showing wall-bank highlights (fairness over the older pitch comment that omitted obstacle collision in preview).

## Moving rim (DunkShot-style)

From dunk-count tier 3+, the **goal hoop** oscillates (seeded horizontal or vertical sin motion) during aim/flight and freezes on dunk. This is a rim hazard (not a new kit obstacle type). Endless still uses the existing procedural 0–1 kit obstacle when unlocked.

## Obstacle art packs

Per-type PNG sprites under `apps/web/public/obstacles/{type}/` (idle + pulse where needed) preload via `obstacleArt.ts`. Canvas draws the sprite when loaded; otherwise falls back to the pitch procedural vectors in `pitchDraw.ts`.
