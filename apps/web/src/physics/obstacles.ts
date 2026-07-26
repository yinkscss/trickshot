import {
  BALL_RADIUS,
  clamp,
  hypot,
  type Projectile,
} from "@trickshot/physics";
import {
  buildObstacles,
  type BumperObstacle,
  type Obstacle,
  type WallObstacle,
} from "@trickshot/logic";

export type { BumperObstacle, Obstacle, WallObstacle };
export { buildObstacles };

/** Pitch `segmentBounce` — shared by wall peg (and future segment obstacles). */
export function segmentBounce(
  b: Projectile,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  rad: number,
): void {
  const ax = x1 - x0;
  const ay = y1 - y0;
  const len2 = ax * ax + ay * ay || 1;
  let t = ((b.x - x0) * ax + (b.y - y0) * ay) / len2;
  t = clamp(t, 0, 1);
  const px = x0 + ax * t;
  const py = y0 + ay * t;
  const dx = b.x - px;
  const dy = b.y - py;
  const d = hypot(dx, dy) || 1;
  if (d >= rad) return;

  const nx = dx / d;
  const ny = dy / d;
  const vn = b.vx * nx + b.vy * ny;
  if (vn < 0) {
    b.vx -= 1.65 * vn * nx;
    b.vy -= 1.65 * vn * ny;
    b.vx *= 0.82;
    b.vy *= 0.82;
  }
  b.x = px + nx * rad;
  b.y = py + ny * rad;
}

/**
 * Dedicated collide step called after the integrator (pitch `collideObstacles`).
 * Mutates ball + bumper pulse in place.
 */
export function collideObstacles(
  obstacles: Obstacle[],
  ball: Projectile,
  dt: number,
  ballRadius = BALL_RADIUS,
): void {
  for (const o of obstacles) {
    if (o.type === "wall") {
      segmentBounce(
        ball,
        o.x,
        o.y - o.h / 2,
        o.x,
        o.y + o.h / 2,
        o.w / 2 + ballRadius,
      );
    } else if (o.type === "bumper") {
      const dx = ball.x - o.x;
      const dy = ball.y - o.y;
      const d = hypot(dx, dy) || 1;
      const min = o.r + ballRadius;
      if (d < min) {
        const nx = dx / d;
        const ny = dy / d;
        const vn = ball.vx * nx + ball.vy * ny;
        if (vn < 0) {
          ball.vx -= 1.8 * vn * nx;
          ball.vy -= 1.8 * vn * ny;
          ball.vx *= 1.05;
          ball.vy *= 1.05;
        }
        ball.x = o.x + nx * min;
        ball.y = o.y + ny * min;
        o.pulse = 1;
      }
      o.pulse = Math.max(0, (o.pulse || 0) - dt * 4);
    }
  }
}
