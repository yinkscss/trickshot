export interface Vec2 {
  x: number;
  y: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Hoop {
  x: number;
  y: number;
  ang: number;
  wobble: number;
}

export interface AimVector {
  x: number;
  y: number;
  pull: number;
}

export interface NetPull {
  lx: number;
  ly: number;
  amt: number;
}

export interface PredictDot {
  x: number;
  y: number;
  bounced: boolean;
  fade: number;
}

export type WallSide = "left" | "right";

/** Segment endpoints [x0, y0, x1, y1] — published by `updateObstacles`. */
export type Seg = [number, number, number, number];

/** Shared kinematic bookkeeping (optional so endless spawn stays minimal). */
export type ObstacleMotion = {
  segs?: Seg[];
  prev?: Seg[] | null;
};

export type WallObstacle = ObstacleMotion & {
  type: "wall";
  x: number;
  y: number;
  h: number;
  /** Thickness in px (endless spawn uses 7; challenges makeWorld uses 8). */
  w: number;
};

export type BumperObstacle = ObstacleMotion & {
  type: "bumper";
  x: number;
  y: number;
  r: number;
  pulse: number;
};

export type GateObstacle = ObstacleMotion & {
  type: "gate";
  x: number;
  y: number;
  gap: number;
  span: number;
  ang: number;
  thick: number;
};

export type SpinnerObstacle = ObstacleMotion & {
  type: "spinner";
  x: number;
  y: number;
  len: number;
  spd: number;
  ang: number;
  thick: number;
};

export type PendulumObstacle = ObstacleMotion & {
  type: "pendulum";
  x: number;
  y: number;
  len: number;
  amp: number;
  spd: number;
  phase: number;
  thick: number;
  tipX?: number;
  tipY?: number;
};

export type SliderObstacle = ObstacleMotion & {
  type: "slider";
  x: number;
  y: number;
  len: number;
  range: number;
  spd: number;
  axis: "x" | "y";
  phase: number;
  thick: number;
  cx?: number;
  cy?: number;
};

export type OrbiterObstacle = ObstacleMotion & {
  type: "orbiter";
  x: number;
  y: number;
  rad: number;
  r: number;
  spd: number;
  phase: number;
  pulse: number;
  cx?: number;
  cy?: number;
  pvx?: number;
  pvy?: number;
};

export type ConveyorObstacle = ObstacleMotion & {
  type: "conveyor";
  x: number;
  y: number;
  len: number;
  ang: number;
  push: number;
  thick: number;
};

export type WindObstacle = ObstacleMotion & {
  type: "wind";
  x: number;
  y: number;
  w: number;
  /** Height in px (named `hh` to avoid clashing with wall `h`). */
  hh: number;
  ax: number;
  ay: number;
};

export type GlassObstacle = ObstacleMotion & {
  type: "glass";
  x: number;
  y: number;
  len: number;
  ang: number;
  thick: number;
  broken: boolean;
  shatter: number;
};

export type PortalObstacle = ObstacleMotion & {
  type: "portal";
  x: number;
  y: number;
  r: number;
  ex: number;
  ey: number;
  cool: number;
  spin: number;
};

export type LaserObstacle = ObstacleMotion & {
  type: "laser";
  x: number;
  y: number;
  len: number;
  ang: number;
  on: number;
  off: number;
  phase: number;
  thick: number;
  live?: boolean;
};

export type Obstacle =
  | WallObstacle
  | BumperObstacle
  | GateObstacle
  | SpinnerObstacle
  | PendulumObstacle
  | SliderObstacle
  | OrbiterObstacle
  | ConveyorObstacle
  | WindObstacle
  | GlassObstacle
  | PortalObstacle
  | LaserObstacle;

/** Optional FX hook — flight may emit particles; preview must omit this. */
export type WallHitCallback = (side: WallSide, x: number, y: number) => void;

export interface WallBounceOptions {
  ballRadius?: number;
  restitution?: number;
  onHit?: WallHitCallback;
}

/** Contact info from a segment bounce (pitch `segmentBounce` return). */
export type SegmentHit = {
  x: number;
  y: number;
  nx: number;
  ny: number;
  speed: number;
};
