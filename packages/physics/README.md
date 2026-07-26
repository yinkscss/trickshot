# @trickshot/physics

Pitch-parity custom 2D integrator for Trick Shot — **no Phaser or DOM dependencies**.

Extracted from `apps/web/src/physics` (issue #16) so the web client and future server replay share one authority for gravity, wall banks, and aim preview.

## Fixed timestep

- **`FIXED_DT`** = `1/120` s — canonical sub-step for deterministic simulation.
- **`stepProjectile(p, dt, worldWidth)`** — one Euler step (gravity + wall bounce).
- **`stepProjectileSubsteps(p, frameDt, worldWidth)`** — advances `frameDt` in `FIXED_DT` chunks (used when replay must match preview despite variable frame times).

Constants (`G`, `WALL_REST`, `MAX_POW`, etc.) match `docs/animation-pitch.html` until a deliberate tuning PR.

## Exports

| Module | Role |
|--------|------|
| `integrate` | `stepProjectile`, `stepProjectileSubsteps`, `cloneProjectile` |
| `walls` | `applyWallBounce`, `edgePad` |
| `aim` | `aimFrom`, `netPullForHoop`, `predictPath` |
| `constants` | `G`, `FIXED_DT`, `BALL_RADIUS`, … |
| `types` | `Projectile`, `Vec2`, `Hoop`, … |

Obstacles and hoop collision remain in `apps/web` until #18/#19.

## Hybrid replay (#8)

Server replay will import this package in Node (no browser):

```ts
import {
  aimFrom,
  cloneProjectile,
  FIXED_DT,
  stepProjectile,
  stepProjectileSubsteps,
} from "@trickshot/physics";

// 1. Reconstruct launch velocity from logged aim input
const aim = aimFrom(origin, finger, worldWidth, worldHeight);
const ball = cloneProjectile({ x: origin.x, y: origin.y, vx: aim.x, vy: aim.y });

// 2. Step with fixed sub-steps for determinism
for (const frameDt of inputLog.frameDts) {
  stepProjectileSubsteps(ball, frameDt, worldWidth);
  // obstacle / rim hooks stay in web until #18/#19
}
```

Smoke check (after build):

```bash
npm run build -w @trickshot/physics
npm run smoke -w @trickshot/physics
# or: node --import tsx packages/physics/src/node-smoke.ts
```

Node subpath: `@trickshot/physics/node` re-exports the smoke runner.

## Tests

```bash
npm test -w @trickshot/physics
```

Covers free fall, L/R wall banks, preview ≡ stepped flight samples, and clone lockstep.
