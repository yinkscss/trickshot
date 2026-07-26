import { FIXED_DT, G } from "./constants.js";
import type { Projectile, WallHitCallback } from "./types.js";
import { applyWallBounce } from "./walls.js";

/**
 * One physics step identical to flight (gravity + walls).
 * Mutates `p` in place. Returns whether a wall bounce occurred this step.
 */
export function stepProjectile(
  p: Projectile,
  dt: number,
  worldWidth: number,
  gravity = G,
  onWallHit?: WallHitCallback,
): boolean {
  p.vy += gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  return applyWallBounce(p, worldWidth, { onHit: onWallHit });
}

/**
 * Advance `frameDt` using fixed sub-steps (default FIXED_DT = 1/120 s).
 * Deterministic for replay when the same inputs and step count are used.
 */
export function stepProjectileSubsteps(
  p: Projectile,
  frameDt: number,
  worldWidth: number,
  fixedDt = FIXED_DT,
  gravity = G,
  onWallHit?: WallHitCallback,
): boolean {
  let bounced = false;
  let remaining = frameDt;
  while (remaining > 0) {
    const dt = Math.min(remaining, fixedDt);
    if (stepProjectile(p, dt, worldWidth, gravity, onWallHit)) bounced = true;
    remaining -= dt;
  }
  return bounced;
}

/** Clone a projectile for deterministic preview / tests */
export function cloneProjectile(p: Projectile): Projectile {
  return { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
}
