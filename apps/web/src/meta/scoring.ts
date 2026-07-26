/** Pitch-style chain multipliers and soft-currency stars. */

export type ComboLabel = null | "x2" | "x3" | "ON FIRE";

/** Dunks in the current unbroken chain (1 after first dunk). */
export function comboLabel(chainLength: number): ComboLabel {
  if (chainLength >= 4) return "ON FIRE";
  if (chainLength === 3) return "x3";
  if (chainLength === 2) return "x2";
  return null;
}

/** Point multiplier from unbroken dunk chain. */
export function comboMultiplier(chainLength: number): number {
  if (chainLength >= 4) return 4;
  if (chainLength === 3) return 3;
  if (chainLength === 2) return 2;
  return 1;
}

/** Base dunk points before multiplier. */
export const DUNK_BASE_POINTS = 100;
export const STAR_POINTS = 25;

export function dunkScore(chainLength: number): number {
  return DUNK_BASE_POINTS * comboMultiplier(chainLength);
}

export function shakeIntensity(chainLength: number): number {
  if (chainLength >= 4) return 0.012;
  if (chainLength === 3) return 0.008;
  if (chainLength === 2) return 0.005;
  return 0.003;
}
