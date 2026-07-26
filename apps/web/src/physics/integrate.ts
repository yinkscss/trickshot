import { G } from "./constants";
import type { Projectile } from "./types";
import { applyWallBounce } from "./walls";

/**
 * One physics step identical to flight (gravity + walls).
 * Mutates `p` in place. Returns whether a wall bounce occurred this step.
 */
export function stepProjectile(
  p: Projectile,
  dt: number,
  worldWidth: number,
  gravity = G,
): boolean {
  p.vy += gravity * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  return applyWallBounce(p, worldWidth);
}

/** Clone a projectile for deterministic preview / tests */
export function cloneProjectile(p: Projectile): Projectile {
  return { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
}
