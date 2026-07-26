export interface TrailParticle {
  x: number;
  y: number;
  life: number;
  rot: number;
}

export interface LaunchRing {
  x: number;
  y: number;
  rx: number;
  ry: number;
  a: number;
}

export type VisualMode =
  | "aim"
  | "flying"
  | "scored"
  | "continue"
  | "transition"
  | "boot"
  | "ended";

export interface PitchHoop {
  x: number;
  y: number;
  ang: number;
  wobble?: number;
}

export interface PitchPull {
  lx: number;
  ly: number;
  amt: number;
}
