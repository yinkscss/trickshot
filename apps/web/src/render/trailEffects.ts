import type { LaunchRing, TrailParticle } from "./types";

export function spawnLaunchRings(
  rings: LaunchRing[],
  x: number,
  y: number,
): void {
  for (let i = 0; i < 5; i++) {
    rings.push({
      x,
      y: y + 8 + i * 7,
      rx: 12 + i * 6,
      ry: 3 + i * 0.8,
      a: 0.75 - i * 0.12,
    });
  }
}

/** Pitch trail / launch-ring lifetime (docs/animation-pitch.html). */
export function updateTrailEffects(
  trail: TrailParticle[],
  rings: LaunchRing[],
  dt: number,
  ballX: number,
  ballY: number,
  ballVx: number,
  ballVy: number,
  flying: boolean,
): void {
  for (const r of rings) {
    r.rx += 50 * dt;
    r.ry += 12 * dt;
    r.a -= dt * 1.8;
  }
  rings.splice(0, rings.length, ...rings.filter((r) => r.a > 0));

  for (const t of trail) {
    t.life -= dt * 3;
    t.rot += dt * 2;
  }
  trail.splice(0, trail.length, ...trail.filter((t) => t.life > 0));

  if (!flying) return;
  const speed = Math.hypot(ballVx, ballVy);
  if (speed <= 70) return;
  trail.push({
    x: ballX,
    y: ballY,
    life: 1,
    rot: Math.atan2(ballVy, ballVx),
  });
  if (trail.length > 36) trail.shift();
}
