import { RIM_RX, RIM_RY } from "./constants.js";
import { hypot } from "./math.js";
import type { Hoop, Projectile, Vec2 } from "./types.js";

/** World position → hoop-local coordinates (pitch `local`). */
export function hoopLocal(h: Hoop, x: number, y: number): Vec2 {
  const dx = x - h.x;
  const dy = y - h.y;
  const c = Math.cos(-h.ang);
  const s = Math.sin(-h.ang);
  return { x: dx * c - dy * s, y: dx * s + dy * c };
}

/** Pitch `throughHoop` — dunk when ball crosses the rim ellipse from below */
export function throughHoop(h: Hoop, ball: Projectile): boolean {
  const L = hoopLocal(h, ball.x, ball.y);
  const nx = L.x / (RIM_RX * 0.85);
  const ny = L.y / (RIM_RY * 1.4);
  if (nx * nx + ny * ny > 1) return false;
  return hypot(ball.vx, ball.vy) > 70 && ball.y >= h.y - 30;
}

/**
 * Pitch `rimHit` — elastic bounce off the rim edge; sets `h.wobble` on contact.
 * Returns true when a bounce was applied (for dunk quality flags).
 */
export function rimHit(h: Hoop, ball: Projectile): boolean {
  const L = hoopLocal(h, ball.x, ball.y);
  const dist = Math.sqrt(
    (L.x * L.x) / (RIM_RX * RIM_RX) + (L.y * L.y) / (RIM_RY * RIM_RY),
  );
  if (dist < 0.78 || dist > 1.2) return false;
  if (Math.abs(dist - 1) > 0.14) return false;

  let nx = L.x / (RIM_RX * RIM_RX);
  let ny = L.y / (RIM_RY * RIM_RY);
  const nl = hypot(nx, ny) || 1;
  nx /= nl;
  ny /= nl;

  const c = Math.cos(-h.ang);
  const s = Math.sin(-h.ang);
  let lvx = ball.vx * c - ball.vy * s;
  let lvy = ball.vx * s + ball.vy * c;
  const vn = lvx * nx + lvy * ny;
  if (vn >= 0) return false;

  lvx -= 1.55 * vn * nx;
  lvy -= 1.55 * vn * ny;
  lvx *= 0.7;
  lvy *= 0.7;

  const c2 = Math.cos(h.ang);
  const s2 = Math.sin(h.ang);
  ball.vx = lvx * c2 - lvy * s2;
  ball.vy = lvx * s2 + lvy * c2;
  h.wobble = 1;
  return true;
}
