import Phaser from "phaser";
import { COURT } from "./colors";

/** Full-bleed court fill + soft side rails (wall-bounce hint). */
export function drawCourt(
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
): void {
  g.fillStyle(Phaser.Display.Color.HexStringToColor(COURT).color, 1);
  g.fillRect(-30, -30, w + 60, h + 60);

  g.fillStyle(0x5a606e, 0.14);
  g.fillRect(0, 0, 14, h);
  g.fillRect(w - 14, 0, 14, h);
}
