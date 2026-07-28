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

From dunk-count tier 2+ (**5 dunks**), the **goal hoop** oscillates (seeded horizontal or vertical sin motion) during aim/flight and freezes on dunk. Travel scales from ~52px at tier 2 to ~130px at tier 6; horizontal swings clamp to `RIM_RX + 8` from each rail so the rim never leaves the court. This is a rim hazard (not a new kit obstacle type). Endless still uses the existing procedural 0–1 kit obstacle when unlocked.

## Obstacle scale (Dunk Shot reference)

Endless kit obstacles are chunkier than the original pitch so they read at phone size: wall `w 7 → 12` / `h 90–100 → 130–150`, bumper `r 22–24 → 27–30`, and bar-type thickness `9–10 → 12–13`.

## Obstacle art packs

PNG packs under `apps/web/public/obstacles/{type}/` still preload via `obstacleArt.ts`, but **draw always uses pitch procedural vectors** in `pitchDraw.ts` (HTML pitch SoT). Single stretched sprites previously sealed gate gaps and skipped segment bodies.
