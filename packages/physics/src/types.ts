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

/** Optional FX hook — flight may emit particles; preview must omit this. */
export type WallHitCallback = (side: WallSide, x: number, y: number) => void;

export interface WallBounceOptions {
  ballRadius?: number;
  restitution?: number;
  onHit?: WallHitCallback;
}
