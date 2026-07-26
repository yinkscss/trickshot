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
