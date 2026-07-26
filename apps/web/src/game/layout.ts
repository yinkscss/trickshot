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
 * Uses deterministic target height for Alpha reproducibility (no rand).
 */
export function layoutForSide(
  side: number,
  fromScore: number,
  width: number,
  height: number,
): ShotLayout {
  const leftX = width * 0.22;
  const rightX = width * 0.78;
  const sourceOnLeft = side === 1;
  const sx = sourceOnLeft ? leftX : rightX;
  const tx = sourceOnLeft ? rightX : leftX;
  const sy = height * (fromScore === 0 ? 0.7 : 0.68);
  // Deterministic arc height — pitch uses rand(0.24, 0.34); mid for Alpha
  const ty = height * 0.29;
  const ang = sourceOnLeft ? -0.38 : 0.38;
  return {
    sx,
    sy,
    tx,
    ty,
    sourceAng: ang * 0.35,
    targetAng: ang,
    star: { x: tx, y: ty - 34 },
  };
}
