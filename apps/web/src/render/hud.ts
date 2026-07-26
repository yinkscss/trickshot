import Phaser from "phaser";
import { comboLabel } from "@trickshot/logic";
import { safeTopInset } from "./math";

export interface HudState {
  stars: number;
  chainLength: number;
  width: number;
}

/** Pause bars — drawn above gameplay. */
export function drawPauseIcon(g: Phaser.GameObjects.Graphics): void {
  const top = 26 + safeTopInset();
  g.fillStyle(0xa4a8b0, 1);
  g.fillRect(20, top, 5, 20);
  g.fillRect(30, top, 5, 20);
}

export function hudStarPosition(width: number): { x: number; y: number } {
  const top = 26 + safeTopInset();
  return { x: width - 26, y: top + 12 };
}

export function hudStarTextPosition(width: number): { x: number; y: number } {
  const top = 26 + safeTopInset();
  return { x: width - 48, y: top + 2 };
}

export function comboChipText(chainLength: number): string | null {
  const label = comboLabel(chainLength);
  if (!label) return null;
  return label;
}
