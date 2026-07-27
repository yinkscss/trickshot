import {
  generateShotLayout,
  nextSide,
  type Obstacle,
  type ShotLayout,
} from "@trickshot/logic";
import type { GameMode } from "@trickshot/shared";
import { makeHoop } from "./layout";
import type { Hoop, Projectile } from "../physics";

export interface Pose2 {
  x: number;
  y: number;
  ang: number;
}

export interface TransitionPose extends Pose2 {
  wobble: number;
  a?: number;
  colorT?: number;
}

export interface DunkTransition {
  t: number;
  dur: number;
  carryFrom: Pose2;
  carryTo: Pose2;
  leaveFrom: Pose2;
  leaveTo: Pose2;
  arriveFrom: Pose2;
  arriveTo: Pose2;
  nextObstacles: Obstacle[];
  oldObstacles: Obstacle[];
  carry: TransitionPose | null;
  leave: TransitionPose | null;
  arrive: TransitionPose | null;
}

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Orange → grey as the scored hoop becomes the new source. */
export function mixRimCss(t: number): string {
  const r = lerp(0xff, 0x5f, t);
  const g = lerp(0x4d, 0x64, t);
  const b = lerp(0x1a, 0x6e, t);
  return `rgb(${r | 0},${g | 0},${b | 0})`;
}

export function beginDunkTransition(args: {
  side: number;
  score: number;
  seed: string | number;
  mode: GameMode;
  width: number;
  height: number;
  source: Hoop;
  target: Hoop;
  obstacles: Obstacle[];
}): { side: number; transition: DunkTransition; layout: ShotLayout } {
  const side = nextSide(args.side as -1 | 1);
  const L = generateShotLayout({
    side,
    score: args.score,
    seed: args.seed,
    mode: args.mode,
    width: args.width,
    height: args.height,
  });
  const carrier = args.target;
  const leaving = args.source;

  const transition: DunkTransition = {
    t: 0,
    dur: 0.58,
    carryFrom: { x: carrier.x, y: carrier.y, ang: carrier.ang },
    carryTo: { x: L.source.x, y: L.source.y, ang: L.source.ang },
    leaveFrom: { x: leaving.x, y: leaving.y, ang: leaving.ang },
    leaveTo: { x: leaving.x, y: args.height + 90, ang: leaving.ang },
    arriveFrom: { x: L.goal.x, y: L.goal.y - 140, ang: L.goal.ang },
    arriveTo: { x: L.goal.x, y: L.goal.y, ang: L.goal.ang },
    nextObstacles: L.obstacles.map((o) => ({ ...o })),
    oldObstacles: args.obstacles.map((o) => ({ ...o })),
    carry: null,
    leave: null,
    arrive: null,
  };

  return { side, transition, layout: L };
}

/** Advance handoff; ball stays seated in the carrying net. Returns true when done. */
export function updateDunkTransition(
  tr: DunkTransition,
  ball: Projectile,
  dt: number,
): boolean {
  tr.t += dt / tr.dur;
  const u = easeInOutCubic(Math.min(Math.max(tr.t, 0), 1));
  const ua = easeInOutCubic(Math.min(Math.max((tr.t - 0.12) / 0.88, 0), 1));

  const cx = lerp(tr.carryFrom.x, tr.carryTo.x, u);
  const cy = lerp(tr.carryFrom.y, tr.carryTo.y, u);
  const ca = lerp(tr.carryFrom.ang, tr.carryTo.ang, u);
  tr.carry = { x: cx, y: cy, ang: ca, wobble: (1 - u) * 1.1, colorT: u };

  tr.leave = {
    x: lerp(tr.leaveFrom.x, tr.leaveTo.x, u),
    y: lerp(tr.leaveFrom.y, tr.leaveTo.y, u),
    ang: tr.leaveFrom.ang,
    a: 1 - u,
    wobble: 0,
  };

  tr.arrive = {
    x: lerp(tr.arriveFrom.x, tr.arriveTo.x, ua),
    y: lerp(tr.arriveFrom.y, tr.arriveTo.y, ua),
    ang: lerp(tr.arriveFrom.ang, tr.arriveTo.ang, ua),
    a: ua,
    wobble: (1 - ua) * 0.6,
  };

  ball.x = cx;
  ball.y = cy - 1;
  ball.vx = 0;
  ball.vy = 0;

  return tr.t >= 1;
}

export function finishDunkTransition(tr: DunkTransition): {
  source: Hoop;
  target: Hoop;
  obstacles: Obstacle[];
  ball: Projectile;
  aimOrigin: { x: number; y: number };
} {
  const source = makeHoop(tr.carryTo.x, tr.carryTo.y, tr.carryTo.ang);
  const target = makeHoop(tr.arriveTo.x, tr.arriveTo.y, tr.arriveTo.ang);
  return {
    source,
    target,
    obstacles: tr.nextObstacles,
    ball: { x: source.x, y: source.y - 1, vx: 0, vy: 0 },
    aimOrigin: { x: source.x, y: source.y - 1 },
  };
}
