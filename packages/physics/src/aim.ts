import {
  MAX_POW,
  MIN_SHOT,
  PREVIEW_DT,
  PREVIEW_MAX_DOTS,
  PREVIEW_STEPS,
} from "./constants.js";
import { clamp, hypot, maxPull } from "./math.js";
import { stepProjectile } from "./integrate.js";
import type { AimVector, Hoop, NetPull, PredictDot, Vec2 } from "./types.js";

export interface LaunchImpulse {
  vx: number;
  vy: number;
  pull: number;
}

/** Slingshot: velocity opposite the drag, from fixed hoop origin */
export function aimFrom(
  origin: Vec2,
  finger: Vec2,
  worldWidth: number,
  worldHeight: number,
  maxPow = MAX_POW,
): AimVector {
  const dx = origin.x - finger.x;
  const dy = origin.y - finger.y;
  const len = hypot(dx, dy);
  if (len < 1) return { x: 0, y: 0, pull: 0 };

  const cap = maxPull(worldWidth, worldHeight);
  const pull = clamp(len, 0, cap);
  const pow = (pull / cap) * maxPow;

  return {
    x: (dx / len) * pow,
    y: (dy / len) * pow,
    pull,
  };
}

/** World-space drag → hoop-local pull (net stretches toward finger) */
export function netPullForHoop(
  hoop: Hoop,
  dragPt: Vec2 | null,
  dragging: boolean,
  worldWidth: number,
  worldHeight: number,
): NetPull {
  if (!dragging || !dragPt) return { lx: 0, ly: 0, amt: 0 };

  const wx = dragPt.x - hoop.x;
  const wy = dragPt.y - hoop.y;
  const c = Math.cos(-hoop.ang);
  const s = Math.sin(-hoop.ang);
  const lx = wx * c - wy * s;
  const ly = wx * s + wy * c;
  const amt = clamp(hypot(wx, wy) / maxPull(worldWidth, worldHeight), 0, 1);
  return { lx, ly, amt };
}

/**
 * Net-pull release → launch impulse (pitch parity).
 * Returns null for tiny taps (aim deadzone) or pulls below `minSpeed`.
 */
export function launchFromPull(
  origin: Vec2,
  finger: Vec2,
  worldWidth: number,
  worldHeight: number,
  minSpeed = MIN_SHOT,
): LaunchImpulse | null {
  const aim = aimFrom(origin, finger, worldWidth, worldHeight);
  if (hypot(aim.x, aim.y) < minSpeed) return null;
  return { vx: aim.x, vy: aim.y, pull: aim.pull };
}

/**
 * Sample aim-preview dots using the same integrator as flight.
 * Bank hits are flagged so the renderer can highlight them.
 *
 * Pitch parity: preview dots omit obstacle collision (see `collideObstacles`);
 * only screen-edge banks are threaded into the orange trail.
 */
export function predictPath(
  origin: Vec2,
  vx: number,
  vy: number,
  worldWidth: number,
  worldHeight: number,
): PredictDot[] {
  if (hypot(vx, vy) < 40) return [];

  const p = { x: origin.x, y: origin.y, vx, vy };
  const dots: PredictDot[] = [];
  let drawn = 0;

  for (let i = 0; i < PREVIEW_STEPS; i++) {
    const bounced = stepProjectile(p, PREVIEW_DT, worldWidth);
    if (i % 3 !== 0 && !bounced) continue;

    const fade = 1 - drawn / PREVIEW_MAX_DOTS;
    if (fade <= 0) break;

    dots.push({ x: p.x, y: p.y, bounced, fade });
    drawn++;

    if (p.y > worldHeight + 40 || p.y < -60 || drawn > PREVIEW_MAX_DOTS) break;
  }

  return dots;
}
