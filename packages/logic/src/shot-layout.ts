import type { GameMode } from "@trickshot/shared";
import type { Obstacle } from "@trickshot/physics";
import { createRng, type Rng } from "./rng.js";

export type { Obstacle };
export type { BumperObstacle, WallObstacle } from "@trickshot/physics";

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

/** Unlock order for endless modes — one new type per dunk after the starter pair. */
export const ENDLESS_OBSTACLE_UNLOCK_ORDER = [
  "wall",
  "bumper",
  "gate",
  "spinner",
  "pendulum",
  "slider",
  "orbiter",
  "conveyor",
  "wind",
  "glass",
  "portal",
  "laser",
] as const satisfies readonly Obstacle["type"][];

export type EndlessObstacleType = (typeof ENDLESS_OBSTACLE_UNLOCK_ORDER)[number];

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
 * Types available at `score` (dunks cleared so far).
 * - score &lt; 1: none (tutorial)
 * - score 1: wall + bumper
 * - each further dunk unlocks the next kit type, up to all 12
 */
export function unlockedObstacleTypes(score: number): EndlessObstacleType[] {
  if (score < 1) return [];
  const count = Math.min(
    ENDLESS_OBSTACLE_UNLOCK_ORDER.length,
    2 + (score - 1),
  );
  return ENDLESS_OBSTACLE_UNLOCK_ORDER.slice(0, count);
}

function pickType(types: readonly EndlessObstacleType[], rng: Rng): EndlessObstacleType {
  const i = Math.floor(rng.next() * types.length);
  return types[Math.min(types.length - 1, Math.max(0, i))]!;
}

function makeEndlessObstacle(
  type: EndlessObstacleType,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  score: number,
  worldWidth: number,
  worldHeight: number,
  rng: Rng,
): Obstacle {
  const midX = (sx + tx) / 2;
  const midY = (sy + ty) / 2;
  const hard = score >= 4;
  const towardGoal = sx < tx ? 1 : -1;
  const offset = worldWidth * (hard ? 0.08 : 0.06);
  const jitter = () => (rng.next() - 0.5) * worldWidth * (hard ? 0.04 : 0.02);
  const ps = (v: number) => v * worldWidth;
  const py = (v: number) => v * worldHeight;

  switch (type) {
    case "wall":
      return {
        type: "wall",
        x: midX + towardGoal * -offset,
        y: midY,
        h: hard ? 100 : 90,
        w: 7,
        segs: [],
        prev: null,
      };
    case "bumper":
      return {
        type: "bumper",
        x: midX + jitter(),
        y: midY,
        r: hard ? 24 : 22,
        pulse: 0,
        segs: [],
        prev: null,
      };
    case "gate":
      return {
        type: "gate",
        x: midX,
        y: midY,
        gap: ps(hard ? 0.22 : 0.26),
        span: ps(0.28),
        ang: 0,
        thick: 9,
        segs: [],
        prev: null,
      };
    case "spinner":
      return {
        type: "spinner",
        x: midX + jitter(),
        y: midY,
        len: ps(hard ? 0.18 : 0.15),
        spd: 1.8 + rng.next() * 0.8,
        ang: rng.next() * Math.PI,
        thick: 9,
        segs: [],
        prev: null,
      };
    case "pendulum":
      return {
        type: "pendulum",
        x: midX,
        y: midY - py(0.12),
        len: ps(hard ? 0.28 : 0.24),
        amp: 0.65 + rng.next() * 0.25,
        spd: 1.7 + rng.next() * 0.6,
        phase: rng.next() * Math.PI * 2,
        thick: 9,
        segs: [],
        prev: null,
      };
    case "slider":
      return {
        type: "slider",
        x: midX,
        y: midY,
        len: ps(0.22),
        range: ps(0.16),
        spd: 1.4 + rng.next() * 0.5,
        axis: rng.next() < 0.5 ? "x" : "y",
        phase: rng.next() * Math.PI * 2,
        thick: 10,
        segs: [],
        prev: null,
      };
    case "orbiter":
      return {
        type: "orbiter",
        x: midX,
        y: midY,
        rad: ps(0.14),
        r: ps(hard ? 0.05 : 0.045),
        spd: 1.8 + rng.next() * 0.8,
        phase: rng.next() * Math.PI * 2,
        pulse: 0,
        segs: [],
        prev: null,
      };
    case "conveyor":
      return {
        type: "conveyor",
        x: midX + jitter() * 0.5,
        y: midY + py(0.04),
        len: ps(0.15),
        ang: towardGoal * -0.35 + (rng.next() - 0.5) * 0.2,
        push: hard ? 380 : 320,
        thick: 11,
        segs: [],
        prev: null,
      };
    case "wind":
      return {
        type: "wind",
        x: midX,
        y: midY,
        w: ps(0.5),
        hh: py(0.22),
        ax: towardGoal * (600 + rng.next() * 400),
        ay: -200 - rng.next() * 400,
        segs: [],
        prev: null,
      };
    case "glass":
      return {
        type: "glass",
        x: midX,
        y: midY,
        len: ps(0.36),
        ang: (rng.next() - 0.5) * 0.35,
        thick: 9,
        broken: false,
        shatter: 0,
        segs: [],
        prev: null,
      };
    case "portal":
      return {
        type: "portal",
        x: midX - towardGoal * ps(0.14),
        y: midY + py(0.02),
        ex: midX + towardGoal * ps(0.16),
        ey: midY - py(0.06),
        r: ps(0.055),
        cool: 0,
        spin: 0,
        segs: [],
        prev: null,
      };
    case "laser":
      return {
        type: "laser",
        x: midX,
        y: midY,
        len: ps(0.36),
        ang: (rng.next() - 0.5) * 0.25,
        on: 0.7 + rng.next() * 0.4,
        off: 0.8 + rng.next() * 0.5,
        phase: rng.next() * Math.PI * 2,
        thick: 7,
        segs: [],
        prev: null,
      };
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

/**
 * Endless spawn: unlock kit types by score, then pick one at random.
 * Still exactly 0 (tutorial) or 1 obstacle — challenges keep authored multi-obs.
 */
export function buildObstacles(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  score: number,
  worldWidth: number,
  rng: Rng,
  worldHeight = worldWidth * 2,
): Obstacle[] {
  const types = unlockedObstacleTypes(score);
  if (types.length === 0) return [];

  const type = pickType(types, rng);
  return [
    makeEndlessObstacle(
      type,
      sx,
      sy,
      tx,
      ty,
      score,
      worldWidth,
      worldHeight,
      rng,
    ),
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
    input.height,
  );

  return { ...base, obstacles };
}
