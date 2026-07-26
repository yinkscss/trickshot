import type { GameMode } from "@trickshot/shared";
import { createRng, type Rng } from "./rng.js";

/** Zigzag lane side: source low on `side`, goal high on the opposite. */
export type Side = -1 | 1;

export interface Vec2 {
  x: number;
  y: number;
}

export interface HoopPose {
  x: number;
  y: number;
  ang: number;
}

export type WallObstacle = {
  type: "wall";
  x: number;
  y: number;
  h: number;
  w: number;
};

export type BumperObstacle = {
  type: "bumper";
  x: number;
  y: number;
  r: number;
  pulse: number;
};

export type Obstacle = WallObstacle | BumperObstacle;

export interface ShotLayout {
  source: HoopPose;
  goal: HoopPose;
  star: Vec2;
  /** Invariant: length is 0 (tutorial) or 1 (post-tutorial). */
  obstacles: Obstacle[];
}

export interface GenerateShotLayoutInput {
  side: Side;
  score: number;
  seed: string | number;
  mode: GameMode;
  width: number;
  height: number;
}

/**
 * Coordinate assumptions (camera scroll is scene-owned):
 * - `width` × `height` logical court pixels (Alpha default 390×780 portrait).
 * - Source hoop at x ≈ 22% / 78%; goal on the opposite rail.
 * - Source y climbs from ~70% (first shot) to ~68%; goal y ≈ 29% of height.
 * - Obstacles sit along the shot chord midpoint in world space.
 */
export function layoutForSide(
  side: Side,
  fromScore: number,
  width: number,
  height: number,
): Omit<ShotLayout, "obstacles"> {
  const leftX = width * 0.22;
  const rightX = width * 0.78;
  const sourceOnLeft = side === 1;
  const sx = sourceOnLeft ? leftX : rightX;
  const tx = sourceOnLeft ? rightX : leftX;
  const sy = height * (fromScore === 0 ? 0.7 : 0.68);
  const ty = height * 0.29;
  const ang = sourceOnLeft ? -0.38 : 0.38;

  return {
    source: { x: sx, y: sy, ang: ang * 0.35 },
    goal: { x: tx, y: ty, ang },
    star: { x: tx, y: ty - 34 },
  };
}

export function nextSide(side: Side): Side {
  return (side * -1) as Side;
}

/** Per-shot RNG stream — isolates score/side without re-seeding the whole run. */
export function shotRng(
  seed: string | number,
  score: number,
  side: Side,
  mode: GameMode,
): Rng {
  return createRng(`${mode}:${seed}:${score}:${side}`);
}

/**
 * Obstacle spawn probabilities (Alpha):
 * - score < 1: none (tutorial clean lane)
 * - score 1–3: wall peg 50%, bumper disc 50%
 * - score ≥ 4 (“hard”): wall peg 65%, bumper 35%; taller peg / larger bumper / wider offset
 */
export function buildObstacles(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  score: number,
  worldWidth: number,
  rng: Rng,
): Obstacle[] {
  if (score < 1) return [];

  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;
  const hard = score >= 4;
  const wallWeight = hard ? 0.65 : 0.5;
  const useWall = rng.next() < wallWeight;

  if (useWall) {
    const offset = worldWidth * (hard ? 0.08 : 0.06);
    return [
      {
        type: "wall",
        x: midX + (sx < tx ? -offset : offset),
        y: midY,
        h: hard ? 100 : 90,
        w: 7,
      },
    ];
  }

  const jitter = hard ? (rng.next() - 0.5) * worldWidth * 0.04 : 0;
  return [
    {
      type: "bumper",
      x: midX + jitter,
      y: midY,
      r: hard ? 24 : 22,
      pulse: 0,
    },
  ];
}

/** Authoritative shot layout: zigzag hoops + zero or one obstacle. */
export function generateShotLayout(input: GenerateShotLayoutInput): ShotLayout {
  const base = layoutForSide(
    input.side,
    input.score,
    input.width,
    input.height,
  );
  const rng = shotRng(input.seed, input.score, input.side, input.mode);
  const obstacles = buildObstacles(
    base.source.x,
    base.source.y,
    base.goal.x,
    base.goal.y,
    input.score,
    input.width,
    rng,
  );

  return { ...base, obstacles };
}
