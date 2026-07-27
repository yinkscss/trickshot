import {
  COURT_H,
  COURT_W,
  FIXED_DT,
  MAX_POW,
  MIN_SHOT,
  collideObstacles,
  rimHit,
  stepProjectile,
  throughHoop,
  updateObstacles,
  type Projectile,
} from "@trickshot/physics";
import { LEVELS, type ChallengeLevel } from "./levels.js";
import { makeWorld, type ChallengeWorld } from "./make-world.js";

/** Pitch `FLIGHT_TIMEOUT` — seconds before a sim is a miss. */
export const FLIGHT_TIMEOUT = 9;

/** Pitch solvability grid defaults (~110×16×5). */
export const SOLVE_ANGLES = 110;
export const SOLVE_POWERS = 16;
export const SOLVE_PHASES = 5;

/** 0 = miss, 1 = clear, 2 = clear + every star. */
export type SimResult = 0 | 1 | 2;

export interface SolveShot {
  angDeg: number;
  pow: number;
  phase: number;
}

export interface SolveResult {
  i: number;
  name: string;
  hits: number;
  starHits: number;
  total: number;
  rate: number;
  best: SolveShot | null;
  bestStar: SolveShot | null;
}

export interface SolveOptions {
  angles?: number;
  powers?: number;
  phases?: number;
  w?: number;
  h?: number;
  /** Stop once both a clear and a full-star clear are found. */
  earlyExit?: boolean;
}

/**
 * One FIXED_DT flight step — pitch `stepWorld` order for movers:
 * t += dt → updateObstacles → stepProjectile → rim → collide → stars → throughHoop.
 */
export function stepChallengeWorld(
  world: ChallengeWorld,
  ball: Projectile,
  dt: number,
): "win" | "dead" | null {
  world.t += dt;
  updateObstacles(world.t, world.obs, dt);
  stepProjectile(ball, dt, world.w);

  rimHit(world.src, ball);
  rimHit(world.goal, ball);

  const hazard = collideObstacles(world.obs, ball, dt);
  if (hazard === "dead") return "dead";

  for (const s of world.stars) {
    if (s.on && Math.hypot(ball.x - s.x, ball.y - s.y) < 30) {
      s.on = false;
    }
  }

  if (throughHoop(world.goal, ball)) return "win";
  if (ball.y > world.h + 90 || ball.x < -140 || ball.x > world.w + 140) {
    return "dead";
  }
  return null;
}

/** Run a single shot. Optional `trace` collects ball positions each tick. */
export function runSim(
  world: ChallengeWorld,
  vx: number,
  vy: number,
  trace?: Array<[number, number]>,
): SimResult {
  const ball: Projectile = {
    x: world.src.x,
    y: world.src.y - 1,
    vx,
    vy,
  };
  const maxSteps = Math.ceil(FLIGHT_TIMEOUT / FIXED_DT);
  for (let i = 0; i < maxSteps; i++) {
    const r = stepChallengeWorld(world, ball, FIXED_DT);
    if (trace) trace.push([ball.x, ball.y]);
    if (r === "win") return world.stars.every((s) => !s.on) ? 2 : 1;
    if (r === "dead") return 0;
  }
  return 0;
}

function warmWorld(world: ChallengeWorld, warmSeconds: number): void {
  const steps = Math.floor(warmSeconds / FIXED_DT);
  for (let k = 0; k < steps; k++) {
    world.t += FIXED_DT;
    updateObstacles(world.t, world.obs, FIXED_DT);
  }
}

/** Sweep aim space for one level — pitch `solve`. */
export function solveLevel(
  idx: number,
  options: SolveOptions = {},
): SolveResult {
  const angles = options.angles ?? SOLVE_ANGLES;
  const powers = options.powers ?? SOLVE_POWERS;
  const phases = options.phases ?? SOLVE_PHASES;
  const w = options.w ?? COURT_W;
  const h = options.h ?? COURT_H;
  const level = LEVELS[idx];
  if (!level) {
    throw new Error(`solveLevel: no level at index ${idx}`);
  }

  let hits = 0;
  let starHits = 0;
  let total = 0;
  let best: SolveShot | null = null;
  let bestStar: SolveShot | null = null;

  outer: for (let ph = 0; ph < phases; ph++) {
    for (let ai = 0; ai < angles; ai++) {
      for (let pi = 0; pi < powers; pi++) {
        const world = makeWorld(level, w, h);
        const warm = (ph / phases) * 1.6;
        warmWorld(world, warm);
        const ang = -Math.PI * 1.04 + (Math.PI * 1.08 * (ai + 0.5)) / angles;
        const pow = MIN_SHOT + ((MAX_POW - MIN_SHOT) * (pi + 0.5)) / powers;
        total++;
        const r = runSim(world, Math.cos(ang) * pow, Math.sin(ang) * pow);
        if (r) {
          hits++;
          const shot: SolveShot = {
            angDeg: (ang * 180) / Math.PI,
            pow: Math.round(pow),
            phase: ph,
          };
          if (!best) best = shot;
          if (r === 2) {
            starHits++;
            if (!bestStar) bestStar = shot;
          }
          if (options.earlyExit && best && bestStar) break outer;
        }
      }
    }
  }

  return {
    i: idx + 1,
    name: level.n,
    hits,
    starHits,
    total,
    rate: +(hits / total * 100).toFixed(2),
    best,
    bestStar,
  };
}

export function solveAll(
  options: SolveOptions = {},
): SolveResult[] {
  return LEVELS.map((_, i) => solveLevel(i, options));
}

/** Trajectory for one exact aim — pitch `path`. */
export function challengePath(
  idx: number,
  angDeg: number,
  pow: number,
  warm = 0,
  w: number = COURT_W,
  h: number = COURT_H,
): { trace: Array<[number, number]>; w: number; h: number } {
  const level: ChallengeLevel = LEVELS[idx];
  const world = makeWorld(level, w, h);
  warmWorld(world, warm);
  const a = (angDeg * Math.PI) / 180;
  const trace: Array<[number, number]> = [];
  runSim(world, Math.cos(a) * pow, Math.sin(a) * pow, trace);
  return { trace, w: world.w, h: world.h };
}

/** Single shot at an exact aim — pitch `probe`. */
export function probe(
  idx: number,
  angDeg: number,
  pow: number,
  warm = 0,
  w: number = COURT_W,
  h: number = COURT_H,
): SimResult {
  const world = makeWorld(LEVELS[idx], w, h);
  warmWorld(world, warm);
  const a = (angDeg * Math.PI) / 180;
  return runSim(world, Math.cos(a) * pow, Math.sin(a) * pow);
}
