import {
  COURT_H,
  COURT_W,
  type Hoop,
  type Obstacle,
} from "@trickshot/physics";
import type { ChallengeLevel, LevelObsDef } from "./levels.js";

export interface ChallengeStar {
  x: number;
  y: number;
  on: boolean;
}

/** Pixel-space challenge world — pitch `makeWorld` output. */
export interface ChallengeWorld {
  t: number;
  w: number;
  h: number;
  src: Hoop;
  goal: Hoop;
  stars: ChallengeStar[];
  obs: Obstacle[];
}

function buildObstacle(o: LevelObsDef, px: (v: number) => number, py: (v: number) => number, ps: (v: number) => number): Obstacle {
  const x = px(o.x);
  const y = py(o.y);
  switch (o.t) {
    case "wall":
      return { type: "wall", x, y, h: ps(o.h), w: 8, segs: [], prev: null };
    case "bumper":
      return { type: "bumper", x, y, r: ps(o.r), pulse: 0, segs: [], prev: null };
    case "gate":
      return {
        type: "gate",
        x,
        y,
        gap: ps(o.gap),
        span: ps(o.span),
        ang: o.ang ?? 0,
        thick: 9,
        segs: [],
        prev: null,
      };
    case "spinner":
      return {
        type: "spinner",
        x,
        y,
        len: ps(o.len),
        spd: o.spd,
        ang: o.ang ?? 0,
        thick: 9,
        segs: [],
        prev: null,
      };
    case "pendulum":
      return {
        type: "pendulum",
        x,
        y,
        len: ps(o.len),
        amp: o.amp,
        spd: o.spd,
        phase: o.phase ?? 0,
        thick: 9,
        segs: [],
        prev: null,
      };
    case "slider":
      return {
        type: "slider",
        x,
        y,
        len: ps(o.len),
        range: ps(o.range),
        spd: o.spd,
        axis: o.axis ?? "x",
        phase: o.phase ?? 0,
        thick: 10,
        segs: [],
        prev: null,
      };
    case "orbiter":
      return {
        type: "orbiter",
        x,
        y,
        rad: ps(o.rad),
        r: ps(o.r),
        spd: o.spd,
        phase: o.phase ?? 0,
        pulse: 0,
        segs: [],
        prev: null,
      };
    case "conveyor":
      return {
        type: "conveyor",
        x,
        y,
        len: ps(o.len),
        ang: o.ang ?? 0,
        push: o.push,
        thick: 11,
        segs: [],
        prev: null,
      };
    case "wind":
      return {
        type: "wind",
        x,
        y,
        w: ps(o.w),
        hh: py(o.h),
        ax: o.ax,
        ay: o.ay,
        segs: [],
        prev: null,
      };
    case "glass":
      return {
        type: "glass",
        x,
        y,
        len: ps(o.len),
        ang: o.ang ?? 0,
        thick: 9,
        broken: false,
        shatter: 0,
        segs: [],
        prev: null,
      };
    case "portal":
      return {
        type: "portal",
        x,
        y,
        r: ps(o.r),
        ex: px(o.ex),
        ey: py(o.ey),
        cool: 0,
        spin: 0,
        segs: [],
        prev: null,
      };
    case "laser":
      return {
        type: "laser",
        x,
        y,
        len: ps(o.len),
        ang: o.ang ?? 0,
        on: o.on,
        off: o.off,
        phase: o.phase ?? 0,
        thick: 7,
        segs: [],
        prev: null,
      };
    default: {
      const _exhaustive: never = o;
      return _exhaustive;
    }
  }
}

/**
 * Normalize authored level data into fixed court pixels.
 * Defaults match docs/challenges-pitch.html (390×780).
 */
export function makeWorld(
  level: ChallengeLevel,
  w: number = COURT_W,
  h: number = COURT_H,
): ChallengeWorld {
  const px = (v: number) => v * w;
  const py = (v: number) => v * h;
  const ps = (v: number) => v * w;

  return {
    t: 0,
    w,
    h,
    src: {
      x: px(level.src[0]),
      y: py(level.src[1]),
      ang: level.src[2],
      wobble: 0,
    },
    goal: {
      x: px(level.goal[0]),
      y: py(level.goal[1]),
      ang: level.goal[2],
      wobble: 0,
    },
    stars: level.stars.map((s) => ({ x: px(s[0]), y: py(s[1]), on: true })),
    obs: level.obs.map((o) => buildObstacle(o, px, py, ps)),
  };
}
