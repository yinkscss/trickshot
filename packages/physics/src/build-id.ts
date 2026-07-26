import {
  BALL_RADIUS,
  FIXED_DT,
  G,
  MAX_POW,
  MIN_SHOT,
  RIM_RX,
  RIM_RY,
  WALL_REST,
} from "./constants.js";

/** FNV-1a 32-bit — stable across Node and browsers. */
function fnv1a(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const PHYSICS_FINGERPRINT = [
  G,
  BALL_RADIUS,
  RIM_RX,
  RIM_RY,
  MAX_POW,
  WALL_REST,
  MIN_SHOT,
  FIXED_DT,
].join(":");

/**
 * Changes when integrator constants change — embed in input logs for hybrid replay.
 * Server rejects logs whose `physicsBuildId` ≠ current build.
 */
export const PHYSICS_BUILD_ID = `physics-${fnv1a(PHYSICS_FINGERPRINT).toString(16)}`;
