/** Re-export core integrator from workspace package; web-only collision modules stay local. */
export {
  BALL_RADIUS,
  FIXED_DT,
  G,
  MAX_POW,
  MIN_SHOT,
  PREVIEW_DT,
  PREVIEW_MAX_DOTS,
  PREVIEW_STEPS,
  RIM_RX,
  RIM_RY,
  WALL_REST,
  aimFrom,
  applyWallBounce,
  cloneProjectile,
  edgePad,
  hypot,
  maxPull,
  clamp,
  netPullForHoop,
  predictPath,
  stepProjectile,
  stepProjectileSubsteps,
  type AimVector,
  type Hoop,
  type NetPull,
  type PredictDot,
  type Projectile,
  type Vec2,
} from "@trickshot/physics";

export * from "./hoopCollision";
export * from "./obstacles";
