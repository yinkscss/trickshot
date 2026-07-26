import Phaser from "phaser";
import { CYAN } from "./colors";
import type { LaunchRing, TrailParticle } from "./types";

const CYAN_COLOR = Phaser.Display.Color.HexStringToColor(CYAN).color;
const CYAN_ALT = 0x8adfff;

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

/** Cyan diamond fire trail + expanding launch rings (pitch `drawTrail`). */
export function drawTrail(
  g: Phaser.GameObjects.Graphics,
  trail: TrailParticle[],
  rings: LaunchRing[],
): void {
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const s = 7 + p.life * 14;
    const stretch = 1.35 + (1 - p.life) * 0.8;
    const color = i % 2 === 0 ? CYAN_COLOR : CYAN_ALT;
    drawDiamond(g, p.x, p.y, p.rot, s, stretch, p.life * 0.85, color);
  }

  for (const r of rings) {
    g.lineStyle(3, CYAN_COLOR, r.a);
    g.strokeEllipse(r.x, r.y, r.rx, r.ry);
  }
}

function drawDiamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rot: number,
  s: number,
  stretch: number,
  alpha: number,
  color: number,
): void {
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const pts = [
    { x: 0, y: -s * stretch },
    { x: s * 0.62, y: 0 },
    { x: 0, y: s * 0.85 },
    { x: -s * 0.62, y: 0 },
  ].map((p) => ({
    x: x + p.x * c - p.y * sn,
    y: y + p.x * sn + p.y * c,
  }));

  g.fillStyle(color, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) g.lineTo(pts[i].x, pts[i].y);
  g.closePath();
  g.fillPath();
}
