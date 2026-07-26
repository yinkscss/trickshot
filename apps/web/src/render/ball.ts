import Phaser from "phaser";
import { BALL_RADIUS } from "../physics";

/** Marble-blue ball with layered highlights (pitch `drawMarble`). */
export function drawMarble(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r = BALL_RADIUS,
  alpha = 1,
): void {
  g.fillStyle(0x0a2878, alpha);
  g.fillCircle(x, y, r);
  g.fillStyle(0x1540c0, alpha * 0.95);
  g.fillCircle(x + r * 0.05, y + r * 0.05, r * 0.92);
  g.fillStyle(0x1e5fff, alpha * 0.9);
  g.fillCircle(x - r * 0.08, y - r * 0.04, r * 0.82);
  g.fillStyle(0x6eb6ff, alpha * 0.55);
  g.fillCircle(x - r * 0.22, y - r * 0.18, r * 0.52);
  g.fillStyle(0xd4efff, alpha * 0.35);
  g.fillCircle(x - r * 0.28, y - r * 0.28, r * 0.28);

  g.lineStyle(2, 0xffffff, alpha * 0.18);
  g.beginPath();
  g.arc(x - r * 0.2, y, r * 0.9, -0.8, 1.2, false);
  g.strokePath();

  g.fillStyle(0xffffff, alpha * 0.7);
  g.fillEllipse(x - r * 0.3, y - r * 0.35, r * 0.28, r * 0.16);
}

/** Cyan launch / combo heat rings around seated ball (pitch `drawFireAura`). */
export function drawFireAura(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  timeMs: number,
  heat = 0,
  alpha = 1,
): void {
  const t = timeMs / 1000;
  const h = Math.min(1, heat);

  g.fillStyle(0x2878ff, alpha * (0.08 + h * 0.06));
  g.fillCircle(x, y, r * (2.4 + h));

  g.fillStyle(0x4ecbff, alpha * (0.22 + h * 0.12));
  g.fillCircle(x, y, r * (1.6 + h * 0.4));

  for (let i = 0; i < 4; i++) {
    const pulse = Math.sin(t * 9 + i * 1.1) * 0.5 + 0.5;
    const yy = y + r * 0.55 + i * 7 + pulse * 2;
    const rx = r * (1.15 + i * 0.32 + pulse * 0.12);
    g.lineStyle(2.2, 0x4ecbff, alpha * (0.58 - i * 0.1));
    g.strokeEllipse(x, yy, rx, 2.8 + i * 0.35);
  }
}

/** Soft cyan glow while net is stretched during drag. */
export function drawDragGlow(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  pullAmt: number,
): void {
  const a = 0.12 + pullAmt * 0.18;
  g.fillStyle(0x4ecbff, a);
  g.fillCircle(x, y, r * (1.4 + pullAmt * 0.5));
}
