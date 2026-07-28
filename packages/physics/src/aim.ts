import {
  MAX_POW,
  MIN_SHOT,
  PREVIEW_DT,
  PREVIEW_MAX_DOTS,
  PREVIEW_STEPS,
  BALL_RADIUS,
} from "./constants.js";
import { clamp, hypot, maxPull } from "./math.js";
import { stepProjectile } from "./integrate.js";
import { collideObstacles, updateObstacles } from "./obstacles.js";
import type {
  AimVector,
  Hoop,
  NetPull,
  Obstacle,
  PredictDot,
  Seg,
  Vec2,
} from "./types.js";

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

function cloneObstaclesForPreview(obstacles: Obstacle[]): Obstacle[] {
  return obstacles
    .filter((o) => o.type !== "wind")
    .map((o) => {
      const copy = { ...o } as Obstacle;
      if (o.segs) copy.segs = o.segs.map((s) => [...s] as Seg);
      if (o.prev) copy.prev = o.prev.map((s) => [...s] as Seg);
      return copy;
    });
}

/**
 * Sample aim-preview dots using the same integrator as flight.
 * Bank hits are flagged so the renderer can highlight them.
 * When `obstacles` are provided, the trail truncates at the first solid hit
 * (see docs/pitch-amendments.md).
 */
export function predictPath(
  origin: Vec2,
  vx: number,
  vy: number,
  worldWidth: number,
  worldHeight: number,
  obstacles?: Obstacle[],
  worldT = 0,
): PredictDot[] {
  if (hypot(vx, vy) < 40) return [];

  const p = { x: origin.x, y: origin.y, vx, vy };
  const dots: PredictDot[] = [];
  let drawn = 0;
  const obs = obstacles?.length ? cloneObstaclesForPreview(obstacles) : [];

  for (let i = 0; i < PREVIEW_STEPS; i++) {
    const bounced = stepProjectile(p, PREVIEW_DT, worldWidth);

    let blocked = false;
    if (obs.length) {
      const t = worldT + i * PREVIEW_DT;
      updateObstacles(t, obs, PREVIEW_DT);
      const before = { x: p.x, y: p.y, vx: p.vx, vy: p.vy };
      const hazard = collideObstacles(obs, p, PREVIEW_DT, BALL_RADIUS);
      const dPos = hypot(p.x - before.x, p.y - before.y);
      const dVel = hypot(p.vx - before.vx, p.vy - before.vy);
      blocked = hazard === "dead" || dVel > 8 || dPos > 2.5;
    }

    if (i % 3 !== 0 && !bounced && !blocked) continue;

    const fade = 1 - drawn / PREVIEW_MAX_DOTS;
    if (fade <= 0) break;

    dots.push({ x: p.x, y: p.y, bounced, fade });
    drawn++;

    if (blocked) break;
    if (p.y > worldHeight + 40 || p.y < -60 || drawn > PREVIEW_MAX_DOTS) break;
  }

  return dots;
}
