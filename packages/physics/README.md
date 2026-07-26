# @trickshot/physics

Pitch-parity custom 2D integrator for Trick Shot — **no Phaser or DOM dependencies**.

Extracted from `apps/web/src/physics` (issue #16) so the web client and future server replay share one authority for gravity, wall banks, and aim preview.

## Fixed timestep

- **`FIXED_DT`** = `1/120` s — canonical sub-step for deterministic simulation.
- **`stepProjectile(p, dt, worldWidth)`** — one Euler step (gravity + wall bounce).
- **`stepProjectileSubsteps(p, frameDt, worldWidth)`** — advances `frameDt` in `FIXED_DT` chunks (used when replay must match preview despite variable frame times).

Constants (`G`, `WALL_REST`, `MAX_POW`, etc.) match `docs/animation-pitch.html` until a deliberate tuning PR.

## Coordinate space

All positions and velocities are **world pixels** — the same space Phaser uses after `Scale.RESIZE`:

- `worldWidth` / `worldHeight` = `scale.width` / `scale.height` from the active scene (not normalized 0–1).
- Wall collision uses `edgePad()` = `BALL_RADIUS + 3` px inset from each screen edge.
- Aim preview (`predictPath`) and flight (`stepProjectile` / `stepProjectileSubsteps`) share this space; no camera-scroll offset is applied in Alpha (zigzag is layout-only).

## Float compare epsilons

| Constant | Value | Use |
|----------|-------|-----|
| `FLIGHT_EPSILON` | `1e-9` | Preview dot vs fixed `PREVIEW_DT` flight |
| `SUBSTEP_EPSILON` | `1e-6` | Variable `frameDt` flight via `stepProjectileSubsteps` |

## Wall banks

- **`applyWallBounce`** / **`collideScreenEdges`** — single authority for L/R screen edges (`WALL_REST = 0.9`).
- Optional `onHit(side, x, y)` callback for flight FX; **preview omits the hook**.
- Flight in the web client should use **`stepProjectileSubsteps`** so variable frame times match the fixed preview integrator.

## Exports

| Module | Role |
|--------|------|
| `integrate` | `stepProjectile`, `stepProjectileSubsteps`, `cloneProjectile` |
| `walls` | `applyWallBounce`, `collideScreenEdges`, `edgePad` |
| `aim` | `aimFrom`, `netPullForHoop`, `launchFromPull`, `predictPath` |
| `hoop` | `hoopLocal`, `throughHoop`, `rimHit` |
| `obstacles` | `collideObstacles`, `segmentBounce`, `MAX_LIVE_OBSTACLES` |
| `constants` | `G`, `FIXED_DT`, `BALL_RADIUS`, … |
| `types` | `Projectile`, `Vec2`, `Hoop`, `Obstacle`, … |

Obstacle collision (wall peg + bumper disc) and hoop rim/through probes live here for Node replay (#18–#19).

## Net-pull launch

- Ball stays seated at `aimOrigin` while `mode=aiming`; drag stretches the **net** (`netPullForHoop`).
- On release: `launchFromPull(origin, finger, W, H)` → `{ vx, vy, pull }` or `null` (deadzone / below `MIN_SHOT`).
- `aimFrom` is the raw slingshot vector; `launchFromPull` applies the pitch min-speed gate.

## Hoop scoring probes

- **`hoopLocal(h, x, y)`** — world → hoop-local transform (pitch `local`).
- **`throughHoop(h, ball)`** — swish gate when ball crosses the rim ellipse from below.
- **`rimHit(h, ball)`** — elastic rim bounce; mutates `ball` velocity and sets `h.wobble`.

## Flight tick ordering (pitch parity)

Each flying frame in the web client (and server replay) should run probes in this order:

1. **`stepProjectileSubsteps`** — gravity + L/R screen walls (integrator)
2. **`rimHit(source)`**, **`rimHit(target)`** — rim elastic bounce
3. **`collideObstacles`** — single live obstacle (#18)
4. **`throughHoop(target)`** — if true, dispatch `throughHoop` to RunFSM → scored

Aim preview (`predictPath`) omits steps 2–4. While `mode=aiming`, the ball never integrates as a free projectile.

## Aim preview vs obstacles

Pitch `predictDots` uses the same integrator as flight but **does not** call `collideObstacles`. `predictPath` matches that behavior — screen-edge banks only. Flight applies `collideObstacles` after each step in the web client.

## Hybrid replay (#8)

Server replay will import this package in Node (no browser):

```ts
import {
  aimFrom,
  cloneProjectile,
  collideObstacles,
  FIXED_DT,
  launchFromPull,
  rimHit,
  stepProjectile,
  stepProjectileSubsteps,
  throughHoop,
  type Hoop,
  type Obstacle,
} from "@trickshot/physics";

// 1. Reconstruct launch velocity from logged aim input
const launch = launchFromPull(origin, finger, worldWidth, worldHeight);
if (!launch) return; // weak tap — stay in aiming
const ball = cloneProjectile({
  x: origin.x,
  y: origin.y,
  vx: launch.vx,
  vy: launch.vy,
});
const obstacles: Obstacle[] = []; // from logged shot layout
const source: Hoop = { x: 0, y: 0, ang: 0, wobble: 0 };
const target: Hoop = { x: 0, y: 0, ang: 0, wobble: 0 };

// 2. Step with fixed sub-steps for determinism (see flight tick ordering above)
for (const frameDt of inputLog.frameDts) {
  stepProjectileSubsteps(ball, frameDt, worldWidth);
  rimHit(source, ball);
  rimHit(target, ball);
  collideObstacles(obstacles, ball, frameDt);
  if (throughHoop(target, ball)) {
    // dispatch throughHoop to RunFSM
  }
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
