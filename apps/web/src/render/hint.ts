import Phaser from "phaser";
import { safeTopInset } from "./math";

/** Finger + arrow + DRAG IT hint (pitch `drawHint`). */
export function drawDragHint(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  bob: number,
): void {
  const ty = y + bob;
  g.lineStyle(3, 0x9aa0aa, 1);
  g.beginPath();
  g.moveTo(x, ty - 10);
  g.lineTo(x, ty + 8);
  g.strokePath();

  g.beginPath();
  g.arc(x, ty - 14, 5, Math.PI, 0, false);
  g.strokePath();

  g.beginPath();
  g.moveTo(x - 6, ty + 14);
  g.lineTo(x, ty + 22);
  g.lineTo(x + 6, ty + 14);
  g.strokePath();
}

export function hintTextY(baseY: number, bob: number): number {
  return baseY + bob + 42;
}

export function hintBob(timeMs: number): number {
  return Math.sin(timeMs / 220) * 6;
}

export function pauseBarTop(): number {
  return 26 + safeTopInset();
}
