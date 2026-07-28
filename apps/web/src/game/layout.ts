import type { Hoop } from "../physics";
import {
  generateShotLayout,
  layoutForSide,
  type ShotLayout as LogicShotLayout,
} from "@trickshot/logic";

export type { LogicShotLayout as ShotLayout };

export { generateShotLayout, layoutForSide };

type HoopOsc = NonNullable<Hoop["osc"]>;

export function makeHoop(
  x: number,
  y: number,
  ang: number,
  osc?: HoopOsc,
): Hoop {
  return { x, y, ang, wobble: 0, ...(osc ? { osc } : {}) };
}
