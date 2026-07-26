import { seededUnit } from "../meta/daily";
import type { Hoop, Vec2 } from "../physics";

export interface ShotLayout {
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  sourceAng: number;
  targetAng: number;
  star: Vec2;
}

export function makeHoop(x: number, y: number, ang: number): Hoop {
  return { x, y, ang, wobble: 0 };
}

/**
 * Zigzag lane positions (pitch `layoutForSide`).
 * Optional seed jitter for daily challenge shared climb height.
 */
export function layoutForSide(
  side: number,
  fromScore: number,
  width: number,
  height: number,
  seed = "casual",
): ShotLayout {
  const leftX = width * 0.22;
  const rightX = width * 0.78;
  const sourceOnLeft = side === 1;
  const sx = sourceOnLeft ? leftX : rightX;
  const tx = sourceOnLeft ? rightX : leftX;
  const sy = height * (fromScore === 0 ? 0.7 : 0.68);
  const tyNorm = 0.24 + seededUnit(seed, `ty:${fromScore}:${side}`) * 0.1;
  const ty = height * tyNorm;
  const ang = sourceOnLeft ? -0.38 : 0.38;
  const starJitter = seededUnit(seed, `star:${fromScore}:${side}`);
  return {
    sx,
    sy,
    tx,
    ty,
    sourceAng: ang * 0.35,
    targetAng: ang,
    star: {
      x: (sx + tx) / 2 + (starJitter - 0.5) * width * 0.12,
      y: (sy + ty) / 2 - 20,
    },
  };
}
