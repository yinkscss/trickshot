/**
 * Authored challenge levels — normalized coords from docs/challenges-pitch.html.
 * Court pixels come from `makeWorld` via COURT_W × COURT_H.
 */

export type LevelObsDef =
  | { t: "wall"; x: number; y: number; h: number }
  | { t: "bumper"; x: number; y: number; r: number }
  | { t: "gate"; x: number; y: number; gap: number; span: number; ang?: number }
  | { t: "spinner"; x: number; y: number; len: number; spd: number; ang?: number }
  | {
      t: "pendulum";
      x: number;
      y: number;
      len: number;
      amp: number;
      spd: number;
      phase?: number;
    }
  | {
      t: "slider";
      x: number;
      y: number;
      len: number;
      range: number;
      spd: number;
      axis?: "x" | "y";
      phase?: number;
    }
  | {
      t: "orbiter";
      x: number;
      y: number;
      rad: number;
      r: number;
      spd: number;
      phase?: number;
    }
  | {
      t: "conveyor";
      x: number;
      y: number;
      len: number;
      ang?: number;
      push: number;
    }
  | {
      t: "wind";
      x: number;
      y: number;
      w: number;
      h: number;
      ax: number;
      ay: number;
    }
  | { t: "glass"; x: number; y: number; len: number; ang?: number }
  | {
      t: "portal";
      x: number;
      y: number;
      ex: number;
      ey: number;
      r: number;
    }
  | {
      t: "laser";
      x: number;
      y: number;
      len: number;
      ang?: number;
      on: number;
      off: number;
      phase?: number;
    };

/** Normalized [x, y, ang] for source / goal hoops. */
export type LevelPose = readonly [number, number, number];

export interface ChallengeLevel {
  n: string;
  tip: string;
  src: LevelPose;
  goal: LevelPose;
  stars: ReadonlyArray<readonly [number, number]>;
  obs: readonly LevelObsDef[];
}

export const LEVELS: readonly ChallengeLevel[] = [
  {
    n: "First Contact",
    tip: "Drag back, then let go.",
    src: [0.24, 0.74, -0.13],
    goal: [0.76, 0.3, -0.38],
    stars: [[0.308, 0.453]],
    obs: [],
  },
  {
    n: "Peg Leg",
    tip: "Arc over the red peg.",
    src: [0.22, 0.76, -0.13],
    goal: [0.78, 0.29, -0.38],
    stars: [
      [0.121, 0.538],
      [0.395, 0.364],
    ],
    obs: [{ t: "wall", x: 0.5, y: 0.54, h: 0.26 }],
  },
  {
    n: "Bumper Pop",
    tip: "The disc kicks harder than it looks.",
    src: [0.24, 0.76, -0.13],
    goal: [0.77, 0.29, -0.38],
    stars: [[0.412, 0.504]],
    obs: [{ t: "bumper", x: 0.5, y: 0.53, r: 0.058 }],
  },
  {
    n: "The Gate",
    tip: "One window, straight through.",
    src: [0.25, 0.76, -0.1],
    goal: [0.75, 0.29, -0.38],
    stars: [[0.49, 0.455]],
    obs: [{ t: "gate", x: 0.5, y: 0.5, gap: 0.24, span: 0.42 }],
  },
  {
    n: "Bank Job",
    tip: "Use the side rail — the lane is shut.",
    src: [0.3, 0.76, -0.1],
    goal: [0.82, 0.28, -0.42],
    stars: [[0.319, 0.42]],
    obs: [{ t: "wall", x: 0.6, y: 0.5, h: 0.34 }],
  },
  {
    n: "Spin Cycle",
    tip: "Wait for the bar to open the lane.",
    src: [0.22, 0.76, -0.13],
    goal: [0.78, 0.28, -0.38],
    stars: [[0.362, 0.433]],
    obs: [{ t: "spinner", x: 0.5, y: 0.52, len: 0.16, spd: 2.1 }],
  },
  {
    n: "Metronome",
    tip: "Count the swing, then shoot.",
    src: [0.23, 0.77, -0.13],
    goal: [0.77, 0.27, -0.38],
    stars: [[0.345, 0.263]],
    obs: [
      { t: "pendulum", x: 0.5, y: 0.24, len: 0.34, amp: 0.85, spd: 1.9 },
    ],
  },
  {
    n: "Sliding Doors",
    tip: "The shelf never stops moving.",
    src: [0.24, 0.77, -0.13],
    goal: [0.76, 0.27, -0.38],
    stars: [[0.312, 0.425]],
    obs: [
      {
        t: "slider",
        x: 0.5,
        y: 0.5,
        len: 0.24,
        range: 0.2,
        spd: 1.5,
        axis: "x",
      },
    ],
  },
  {
    n: "Twin Pegs",
    tip: "Two pegs, one slot between them.",
    src: [0.22, 0.76, -0.13],
    goal: [0.78, 0.29, -0.38],
    stars: [[0.326, 0.417]],
    obs: [
      { t: "wall", x: 0.4, y: 0.48, h: 0.2 },
      { t: "wall", x: 0.62, y: 0.6, h: 0.2 },
    ],
  },
  {
    n: "Pinball",
    tip: "Three discs. Pick a clean line.",
    src: [0.24, 0.76, -0.1],
    goal: [0.76, 0.29, -0.38],
    stars: [[0.347, 0.243]],
    obs: [
      { t: "bumper", x: 0.34, y: 0.56, r: 0.048 },
      { t: "bumper", x: 0.52, y: 0.45, r: 0.048 },
      { t: "bumper", x: 0.7, y: 0.58, r: 0.048 },
    ],
  },
  {
    n: "Tailwind",
    tip: "The cyan zone shoves you right.",
    src: [0.2, 0.76, -0.13],
    goal: [0.79, 0.27, -0.38],
    stars: [[0.304, 0.445]],
    obs: [{ t: "wind", x: 0.5, y: 0.48, w: 0.62, h: 0.3, ax: 900, ay: 0 }],
  },
  {
    n: "Updraft",
    tip: "Under-shoot — the draft lifts you.",
    src: [0.24, 0.78, -0.13],
    goal: [0.75, 0.25, -0.38],
    stars: [[0.491, 0.437]],
    obs: [
      {
        t: "wind",
        x: 0.52,
        y: 0.52,
        w: 0.55,
        h: 0.34,
        ax: 120,
        ay: -1400,
      },
    ],
  },
  {
    n: "Conveyor",
    tip: "The green bar flings you along it.",
    src: [0.22, 0.76, -0.13],
    goal: [0.79, 0.28, -0.38],
    stars: [[0.362, 0.433]],
    obs: [
      {
        t: "conveyor",
        x: 0.46,
        y: 0.6,
        len: 0.16,
        ang: -0.35,
        push: 380,
      },
    ],
  },
  {
    n: "Orbit",
    tip: "One disc, forever circling.",
    src: [0.24, 0.77, -0.13],
    goal: [0.77, 0.27, -0.38],
    stars: [[0.312, 0.425]],
    obs: [{ t: "orbiter", x: 0.5, y: 0.5, rad: 0.17, r: 0.05, spd: 2.0 }],
  },
  {
    n: "Glass Ceiling",
    tip: "The pane shatters on contact — once.",
    src: [0.25, 0.76, -0.1],
    goal: [0.74, 0.28, -0.38],
    stars: [[0.285, 0.429]],
    obs: [{ t: "glass", x: 0.5, y: 0.48, len: 0.44, ang: 0 }],
  },
  {
    n: "Wormhole",
    tip: "In the cyan ring, out the pink one.",
    src: [0.22, 0.77, -0.13],
    goal: [0.79, 0.27, -0.38],
    stars: [[0.232, 0.56]],
    obs: [
      { t: "portal", x: 0.3, y: 0.52, ex: 0.74, ey: 0.44, r: 0.062 },
      { t: "wall", x: 0.52, y: 0.52, h: 0.46 },
    ],
  },
  {
    n: "Laser Gate",
    tip: "It blinks. Go on the dark beat.",
    src: [0.24, 0.77, -0.1],
    goal: [0.76, 0.28, -0.38],
    stars: [[0.288, 0.427]],
    obs: [
      {
        t: "laser",
        x: 0.5,
        y: 0.48,
        len: 0.46,
        ang: 0,
        on: 0.9,
        off: 0.9,
      },
    ],
  },
  {
    n: "Needle",
    tip: "Narrow window, no second chances.",
    src: [0.25, 0.77, -0.1],
    goal: [0.75, 0.28, -0.38],
    stars: [[0.507, 0.45]],
    obs: [
      { t: "gate", x: 0.5, y: 0.5, gap: 0.22, span: 0.28 },
      { t: "wall", x: 0.22, y: 0.36, h: 0.12 },
      { t: "wall", x: 0.78, y: 0.36, h: 0.12 },
    ],
  },
  {
    n: "Windmill",
    tip: "Long arm, tight timing.",
    src: [0.22, 0.76, -0.13],
    goal: [0.78, 0.28, -0.38],
    stars: [[0.325, 0.399]],
    obs: [
      { t: "spinner", x: 0.5, y: 0.5, len: 0.21, spd: 1.6 },
      { t: "wall", x: 0.5, y: 0.7, h: 0.11 },
    ],
  },
  {
    n: "Twin Pendulums",
    tip: "Two arms, out of phase.",
    src: [0.23, 0.76, -0.13],
    goal: [0.77, 0.28, -0.38],
    stars: [[0.348, 0.433]],
    obs: [
      { t: "pendulum", x: 0.36, y: 0.3, len: 0.22, amp: 0.7, spd: 2.0 },
      {
        t: "pendulum",
        x: 0.66,
        y: 0.46,
        len: 0.2,
        amp: 0.7,
        spd: 2.0,
        phase: 3.14,
      },
    ],
  },
  {
    n: "Crosswind Spin",
    tip: "The draft bends what the bar allows.",
    src: [0.22, 0.76, -0.13],
    goal: [0.78, 0.28, -0.38],
    stars: [[0.341, 0.234]],
    obs: [
      { t: "wind", x: 0.5, y: 0.62, w: 0.5, h: 0.18, ax: -420, ay: 0 },
      { t: "spinner", x: 0.52, y: 0.42, len: 0.15, spd: 2.4 },
    ],
  },
  {
    n: "Gatekeeper",
    tip: "Thread the gate while the arm is clear.",
    src: [0.25, 0.77, -0.1],
    goal: [0.75, 0.28, -0.38],
    stars: [[0.501, 0.467]],
    obs: [
      { t: "gate", x: 0.5, y: 0.52, gap: 0.30, span: 0.28 },
      { t: "pendulum", x: 0.5, y: 0.3, len: 0.17, amp: 0.7, spd: 2.2 },
    ],
  },
  {
    n: "Shatter Run",
    tip: "Break the pane, survive the discs.",
    src: [0.24, 0.77, -0.1],
    goal: [0.76, 0.28, -0.38],
    stars: [[0.354, 0.462]],
    obs: [
      { t: "glass", x: 0.5, y: 0.58, len: 0.34, ang: 0.18 },
      { t: "bumper", x: 0.32, y: 0.42, r: 0.045 },
      { t: "bumper", x: 0.68, y: 0.4, r: 0.045 },
    ],
  },
  {
    n: "Portal Bank",
    tip: "Bank in, drop out high.",
    src: [0.28, 0.77, -0.1],
    goal: [0.8, 0.27, -0.4],
    stars: [[0.211, 0.473]],
    obs: [
      { t: "wall", x: 0.56, y: 0.54, h: 0.38 },
      { t: "portal", x: 0.22, y: 0.42, ex: 0.66, ey: 0.42, r: 0.062 },
    ],
  },
  {
    n: "Strobe",
    tip: "Laser and shelf share the beat.",
    src: [0.24, 0.77, -0.1],
    goal: [0.76, 0.27, -0.38],
    stars: [[0.312, 0.425]],
    obs: [
      {
        t: "laser",
        x: 0.5,
        y: 0.62,
        len: 0.36,
        ang: 0,
        on: 0.6,
        off: 1.2,
      },
      {
        t: "slider",
        x: 0.5,
        y: 0.4,
        len: 0.18,
        range: 0.18,
        spd: 1.7,
        axis: "x",
      },
    ],
  },
  {
    n: "Gauntlet I",
    tip: "Peg, disc, bar — in that order.",
    src: [0.22, 0.76, -0.13],
    goal: [0.78, 0.28, -0.38],
    stars: [[0.561, 0.493]],
    obs: [
      { t: "wall", x: 0.38, y: 0.66, h: 0.16 },
      { t: "bumper", x: 0.62, y: 0.52, r: 0.042 },
      { t: "spinner", x: 0.36, y: 0.44, len: 0.12, spd: 2.3 },
    ],
  },
  {
    n: "Gauntlet II",
    tip: "Draft first, then the ring.",
    src: [0.25, 0.77, -0.1],
    goal: [0.75, 0.27, -0.38],
    stars: [[0.502, 0.466]],
    obs: [
      { t: "gate", x: 0.5, y: 0.58, gap: 0.32, span: 0.26 },
      {
        t: "wind",
        x: 0.5,
        y: 0.44,
        w: 0.6,
        h: 0.12,
        ax: 300,
        ay: -100,
      },
      {
        t: "orbiter",
        x: 0.62,
        y: 0.38,
        rad: 0.1,
        r: 0.036,
        spd: 2.4,
      },
    ],
  },
  {
    n: "Gauntlet III",
    tip: "Shatter, dodge, swing.",
    src: [0.23, 0.77, -0.1],
    goal: [0.77, 0.27, -0.38],
    stars: [[0.379, 0.33]],
    obs: [
      { t: "glass", x: 0.5, y: 0.66, len: 0.32, ang: -0.2 },
      {
        t: "laser",
        x: 0.5,
        y: 0.52,
        len: 0.26,
        ang: 0,
        on: 0.6,
        off: 1.2,
      },
      {
        t: "pendulum",
        x: 0.52,
        y: 0.3,
        len: 0.16,
        amp: 0.8,
        spd: 2.4,
      },
    ],
  },
  {
    n: "The Vault",
    tip: "Everything is in the way. Almost.",
    src: [0.26, 0.77, -0.1],
    goal: [0.74, 0.27, -0.38],
    stars: [[0.318, 0.263]],
    obs: [
      { t: "wall", x: 0.42, y: 0.68, h: 0.17 },
      { t: "wall", x: 0.6, y: 0.46, h: 0.17 },
      {
        t: "conveyor",
        x: 0.48,
        y: 0.6,
        len: 0.13,
        ang: -0.5,
        push: 320,
      },
      { t: "bumper", x: 0.3, y: 0.38, r: 0.042 },
    ],
  },
  {
    n: "Trick Shot",
    tip: "The whole kit. Good luck.",
    src: [0.24, 0.78, -0.1],
    goal: [0.78, 0.26, -0.4],
    stars: [
      [0.057, 0.584],
      [0.687, 0.337],
    ],
    obs: [
      { t: "gate", x: 0.5, y: 0.58, gap: 0.26, span: 0.26 },
      {
        t: "portal",
        x: 0.14,
        y: 0.44,
        ex: 0.66,
        ey: 0.4,
        r: 0.055,
      },
      { t: "spinner", x: 0.5, y: 0.32, len: 0.11, spd: 2.6 },
      { t: "wind", x: 0.5, y: 0.28, w: 0.6, h: 0.1, ax: -200, ay: 0 },
    ],
  },
];

export const CHALLENGE_LEVEL_COUNT = LEVELS.length;
