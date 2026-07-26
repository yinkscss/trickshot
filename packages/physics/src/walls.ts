import { BALL_RADIUS, WALL_REST } from "./constants.js";
import type { Projectile, WallBounceOptions, WallHitCallback } from "./types.js";

export function edgePad(ballRadius = BALL_RADIUS): number {
  return ballRadius + 3;
}

/**
 * Shared wall bounce — used by flight AND aim preview.
 * Mutates `p` in place. Returns whether a bounce occurred.
 * Pass `onHit` only during flight (preview omits FX).
 */
export function applyWallBounce(
  p: Projectile,
  worldWidth: number,
  ballRadiusOrOpts: number | WallBounceOptions = BALL_RADIUS,
  restitution = WALL_REST,
  onHit?: WallHitCallback,
): boolean {
  const opts =
    typeof ballRadiusOrOpts === "number"
      ? { ballRadius: ballRadiusOrOpts, restitution, onHit }
      : ballRadiusOrOpts;
  const radius = opts.ballRadius ?? BALL_RADIUS;
  const rest = opts.restitution ?? WALL_REST;
  const fx = opts.onHit;

  const pad = edgePad(radius);
  let hit = false;

  if (p.x < pad) {
    p.x = pad;
    if (p.vx < 0) {
      p.vx = -p.vx * rest;
      hit = true;
      fx?.("left", pad, p.y);
    }
  } else if (p.x > worldWidth - pad) {
    p.x = worldWidth - pad;
    if (p.vx > 0) {
      p.vx = -p.vx * rest;
      hit = true;
      fx?.("right", worldWidth - pad, p.y);
    }
  }

  return hit;
}

/** Pitch alias — screen-edge collision for flight (optional FX callback). */
export function collideScreenEdges(
  p: Projectile,
  worldWidth: number,
  onHit?: WallHitCallback,
): boolean {
  return applyWallBounce(p, worldWidth, { onHit });
}
