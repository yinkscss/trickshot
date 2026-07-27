import { BALL_RADIUS } from "./constants.js";
import { clamp, hypot, lerp } from "./math.js";
import type { Obstacle, Projectile, Seg, SegmentHit } from "./types.js";

/**
 * Challenges layouts use up to 4 authored obstacles.
 * Endless `buildObstacles` still spawns 0–1 wall/bumper.
 */
export const MAX_LIVE_OBSTACLES = 4;

function ensureSegs(o: Obstacle): Seg[] {
  if (!o.segs) o.segs = [];
  return o.segs;
}

function bar(cx: number, cy: number, ang: number, half: number): Seg {
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  return [cx - c * half, cy - s * half, cx + c * half, cy + s * half];
}

export function laserOn(
  o: { on: number; off: number; phase: number },
  t: number,
): boolean {
  const period = o.on + o.off;
  return (((t + o.phase) % period) + period) % period < o.on;
}

/**
 * Rebuild obstacle segments from kinematics.
 * Uses accumulated sim time `worldT` — never `performance.now()`.
 */
export function updateObstacles(
  worldT: number,
  obstacles: Obstacle[],
  dt: number,
): void {
  const t = worldT;
  for (const o of obstacles) {
    const segs = ensureSegs(o);
    o.prev = segs.length ? segs.map((s) => s.slice() as Seg) : null;
    segs.length = 0;

    if (o.type === "wall") {
      segs.push([o.x, o.y - o.h / 2, o.x, o.y + o.h / 2]);
    } else if (o.type === "gate") {
      const c = Math.cos(o.ang);
      const s = Math.sin(o.ang);
      const g = o.gap / 2;
      segs.push([
        o.x - c * (g + o.span),
        o.y - s * (g + o.span),
        o.x - c * g,
        o.y - s * g,
      ]);
      segs.push([
        o.x + c * g,
        o.y + s * g,
        o.x + c * (g + o.span),
        o.y + s * (g + o.span),
      ]);
    } else if (o.type === "spinner") {
      o.ang += o.spd * dt;
      segs.push(bar(o.x, o.y, o.ang, o.len));
    } else if (o.type === "pendulum") {
      const a = Math.PI / 2 + Math.sin(t * o.spd + o.phase) * o.amp;
      o.tipX = o.x + Math.cos(a) * o.len;
      o.tipY = o.y + Math.sin(a) * o.len;
      segs.push([o.x, o.y, o.tipX, o.tipY]);
    } else if (o.type === "slider") {
      const off = Math.sin(t * o.spd + o.phase) * o.range;
      o.cx = o.x + (o.axis === "x" ? off : 0);
      o.cy = o.y + (o.axis === "y" ? off : 0);
      segs.push(
        bar(o.cx, o.cy, o.axis === "x" ? 0 : Math.PI / 2, o.len / 2),
      );
    } else if (o.type === "conveyor") {
      segs.push(bar(o.x, o.y, o.ang, o.len));
    } else if (o.type === "glass") {
      if (!o.broken) segs.push(bar(o.x, o.y, o.ang, o.len / 2));
      else o.shatter = Math.min(1, o.shatter + dt * 1.6);
    } else if (o.type === "laser") {
      o.live = laserOn(o, t);
      segs.push(bar(o.x, o.y, o.ang, o.len / 2));
    } else if (o.type === "orbiter") {
      const a = t * o.spd + o.phase;
      o.cx = o.x + Math.cos(a) * o.rad;
      o.cy = o.y + Math.sin(a) * o.rad;
      o.pvx = -Math.sin(a) * o.rad * o.spd;
      o.pvy = Math.cos(a) * o.rad * o.spd;
      o.pulse = Math.max(0, o.pulse - dt * 4);
    } else if (o.type === "portal") {
      o.spin += dt * 2.2;
      o.cool = Math.max(0, o.cool - dt);
    } else if (o.type === "bumper") {
      o.pulse = Math.max(0, (o.pulse || 0) - dt * 4);
    }
  }
}

function closestOnSeg(
  b: Projectile,
  s: Seg,
): { t: number; x: number; y: number } {
  const ax = s[2] - s[0];
  const ay = s[3] - s[1];
  const len2 = ax * ax + ay * ay || 1;
  const t = clamp(((b.x - s[0]) * ax + (b.y - s[1]) * ay) / len2, 0, 1);
  return { t, x: s[0] + ax * t, y: s[1] + ay * t };
}

/**
 * Reflect off a (possibly moving) segment. Returns contact info or null.
 * Pitch defaults: rest=0.65 → (1+rest)=1.65 impulse, friction=0.82.
 */
export function segmentBounce(
  b: Projectile,
  s: Seg,
  prev: Seg | null | undefined,
  rad: number,
  dt: number,
  rest = 0.65,
  friction = 0.82,
): SegmentHit | null {
  const cp = closestOnSeg(b, s);
  const dx = b.x - cp.x;
  const dy = b.y - cp.y;
  const d = hypot(dx, dy) || 1;
  if (d >= rad) return null;

  const nx = dx / d;
  const ny = dy / d;
  let svx = 0;
  let svy = 0;
  if (prev && dt > 0) {
    const px = lerp(prev[0], prev[2], cp.t);
    const py = lerp(prev[1], prev[3], cp.t);
    svx = (cp.x - px) / dt;
    svy = (cp.y - py) / dt;
  }
  const rvx = b.vx - svx;
  const rvy = b.vy - svy;
  const vn = rvx * nx + rvy * ny;
  if (vn < 0) {
    b.vx = svx + (rvx - (1 + rest) * vn * nx) * friction;
    b.vy = svy + (rvy - (1 + rest) * vn * ny) * friction;
  }
  b.x = cp.x + nx * rad;
  b.y = cp.y + ny * rad;
  return { x: cp.x, y: cp.y, nx, ny, speed: hypot(rvx, rvy) };
}

/**
 * Dedicated collide step called after the integrator (pitch `collideObstacles`).
 * Mutates ball + obstacle state in place.
 * Returns `"dead"` if a live laser was touched, else `null`.
 */
export function collideObstacles(
  obstacles: Obstacle[],
  ball: Projectile,
  dt: number,
  ballRadius = BALL_RADIUS,
): "dead" | null {
  if (obstacles.length > MAX_LIVE_OBSTACLES) {
    throw new Error(
      `collideObstacles: expected at most ${MAX_LIVE_OBSTACLES} obstacles, got ${obstacles.length}`,
    );
  }

  for (const o of obstacles) {
    if (o.type === "bumper" || o.type === "orbiter") {
      const cx = o.type === "orbiter" ? (o.cx ?? o.x) : o.x;
      const cy = o.type === "orbiter" ? (o.cy ?? o.y) : o.y;
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      const d = hypot(dx, dy) || 1;
      const min = o.r + ballRadius;
      if (d < min) {
        const nx = dx / d;
        const ny = dy / d;
        const svx = o.type === "orbiter" ? (o.pvx ?? 0) : 0;
        const svy = o.type === "orbiter" ? (o.pvy ?? 0) : 0;
        const rvx = ball.vx - svx;
        const rvy = ball.vy - svy;
        const vn = rvx * nx + rvy * ny;
        if (vn < 0) {
          ball.vx = svx + (rvx - 1.8 * vn * nx) * 1.05;
          ball.vy = svy + (rvy - 1.8 * vn * ny) * 1.05;
        }
        ball.x = cx + nx * min;
        ball.y = cy + ny * min;
        o.pulse = 1;
      }
      continue;
    }

    if (o.type === "wind") {
      if (
        Math.abs(ball.x - o.x) < o.w / 2 &&
        Math.abs(ball.y - o.y) < o.hh / 2
      ) {
        ball.vx += o.ax * dt;
        ball.vy += o.ay * dt;
      }
      continue;
    }

    if (o.type === "portal") {
      if (
        o.cool <= 0 &&
        hypot(ball.x - o.x, ball.y - o.y) < o.r + ballRadius * 0.4
      ) {
        const sp = hypot(ball.vx, ball.vy) || 1;
        ball.x = o.ex + (ball.vx / sp) * (o.r + ballRadius + 2);
        ball.y = o.ey + (ball.vy / sp) * (o.r + ballRadius + 2);
        o.cool = 0.35;
      }
      continue;
    }

    if (o.type === "laser") {
      const segs = o.segs;
      if (!o.live || !segs?.length) continue;
      const cp = closestOnSeg(ball, segs[0]);
      if (hypot(ball.x - cp.x, ball.y - cp.y) < o.thick / 2 + ballRadius) {
        return "dead";
      }
      continue;
    }

    if (o.type === "glass") {
      if (o.broken) continue;
      const segs = o.segs;
      if (!segs?.length) continue;
      const cp = closestOnSeg(ball, segs[0]);
      if (hypot(ball.x - cp.x, ball.y - cp.y) < o.thick / 2 + ballRadius) {
        o.broken = true;
        ball.vx *= 0.92;
        ball.vy *= 0.92;
      }
      continue;
    }

    // wall / gate / spinner / pendulum / slider / conveyor
    const rest = o.type === "conveyor" ? 0.35 : 0.65;
    const friction = o.type === "conveyor" ? 0.9 : 0.82;
    let segs = o.segs;
    let thick: number;
    if (o.type === "wall") {
      thick = o.w;
      if (!segs?.length) {
        segs = [[o.x, o.y - o.h / 2, o.x, o.y + o.h / 2]];
      }
    } else {
      thick = o.thick;
      if (!segs?.length) continue;
    }

    for (let i = 0; i < segs.length; i++) {
      const hit = segmentBounce(
        ball,
        segs[i],
        o.prev ? o.prev[i] : null,
        thick / 2 + ballRadius,
        dt,
        rest,
        friction,
      );
      if (!hit) continue;
      if (o.type === "conveyor") {
        ball.vx += Math.cos(o.ang) * o.push * dt * 8;
        ball.vy += Math.sin(o.ang) * o.push * dt * 8;
      }
    }
  }
  return null;
}
