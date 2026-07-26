import Phaser from "phaser";
import { STAR_FILL, STAR_LINE } from "./colors";

/** Collectible / HUD five-point star (pitch `drawStarIcon`). */
export function drawStarIcon(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  rot = 0,
  alpha = 1,
): void {
  const fill = Phaser.Display.Color.HexStringToColor(STAR_FILL).color;
  const stroke = Phaser.Display.Color.HexStringToColor(STAR_LINE).color;
  const pts: { x: number; y: number }[] = [];

  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const a2 = a + Math.PI / 5;
    pts.push({
      x: x + Math.cos(a + rot) * r,
      y: y + Math.sin(a + rot) * r,
    });
    pts.push({
      x: x + Math.cos(a2 + rot) * r * 0.42,
      y: y + Math.sin(a2 + rot) * r * 0.42,
    });
  }

  g.fillStyle(fill, alpha);
  g.lineStyle(2, stroke, alpha);
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    g.lineTo(pts[i].x, pts[i].y);
  }
  g.closePath();
  g.fillPath();
  g.strokePath();
}
