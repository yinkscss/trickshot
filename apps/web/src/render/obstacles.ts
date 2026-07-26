import Phaser from "phaser";
import type { Obstacle } from "../physics";
import { OBSTACLE_RED } from "./colors";

function roundCapBar(
  g: Phaser.GameObjects.Graphics,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thick: number,
  color: number,
  alpha: number,
): void {
  g.lineStyle(thick, color, alpha);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokePath();

  g.lineStyle(thick * 0.35, 0xffffff, 0.25 * alpha);
  g.beginPath();
  g.moveTo(x0, y0);
  g.lineTo(x1, y1);
  g.strokePath();
}

const RED = Phaser.Display.Color.HexStringToColor(OBSTACLE_RED).color;

export function drawObstacles(
  g: Phaser.GameObjects.Graphics,
  list: Obstacle[],
  alpha: number,
  timeMs: number,
): void {
  for (const o of list) {
    if (o.type === "wall") {
      roundCapBar(
        g,
        o.x,
        o.y - o.h / 2,
        o.x,
        o.y + o.h / 2,
        o.w,
        RED,
        alpha,
      );
    } else if (o.type === "bumper") {
      const p =
        1 + Math.sin(timeMs / 180) * 0.04 + (o.pulse || 0) * 0.15;
      g.fillStyle(RED, alpha);
      g.fillCircle(o.x, o.y, o.r * p);
      g.fillStyle(0xffffff, alpha);
      g.fillCircle(o.x, o.y, o.r * 0.45 * p);
      g.fillStyle(0xffffff, 0.35 * alpha);
      g.fillCircle(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.18);
    }
  }
}
