import Phaser from "phaser";
import type { PredictDot } from "../physics";
import { CYAN, ORANGE } from "./colors";

export function drawAimDots(
  g: Phaser.GameObjects.Graphics,
  dots: PredictDot[],
): void {
  const orange = Phaser.Display.Color.HexStringToColor(ORANGE).color;
  const cyan = Phaser.Display.Color.HexStringToColor(CYAN).color;

  for (const d of dots) {
    const r = d.bounced ? 4.2 : 2.4 + 2.0 * d.fade;
    g.fillStyle(d.bounced ? cyan : orange, 0.95 * d.fade);
    g.fillCircle(d.x, d.y, r);
  }
}

export function drawAimRubberBand(
  g: Phaser.GameObjects.Graphics,
  originX: number,
  originY: number,
  fingerX: number,
  fingerY: number,
  pull: number,
  maxPull: number,
): void {
  g.lineStyle(2.5, Phaser.Display.Color.HexStringToColor(ORANGE).color, 0.35);
  g.beginPath();
  g.moveTo(originX, originY);
  g.lineTo(fingerX, fingerY);
  g.strokePath();

  const t = maxPull > 0 ? pull / maxPull : 0;
  g.lineStyle(3, Phaser.Display.Color.HexStringToColor(ORANGE).color, 0.25 + t * 0.45);
  g.strokeCircle(originX, originY, 18 + t * 22);
}
