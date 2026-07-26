import { BALL_RADIUS, WALL_REST } from "./constants.js";
import type { Projectile } from "./types.js";

export function edgePad(ballRadius = BALL_RADIUS): number {
  return ballRadius + 3;
}

/**
 * Shared wall bounce — used by flight AND aim preview.
 * Mutates `p` in place. Returns whether a bounce occurred.
 */
export function applyWallBounce(
  p: Projectile,
  worldWidth: number,
  ballRadius = BALL_RADIUS,
  restitution = WALL_REST,
): boolean {
  const pad = edgePad(ballRadius);
  let hit = false;

  if (p.x < pad) {
    p.x = pad;
    if (p.vx < 0) {
      p.vx = -p.vx * restitution;
      hit = true;
    }
  } else if (p.x > worldWidth - pad) {
    p.x = worldWidth - pad;
    if (p.vx > 0) {
      p.vx = -p.vx * restitution;
      hit = true;
    }
  }

  return hit;
}
