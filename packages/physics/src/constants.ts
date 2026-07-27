/** Pitch-parity physics constants from docs/animation-pitch.html */

/** Fixed logical court — matches docs/challenges-pitch.html (W×H). */
export const COURT_W = 390;
export const COURT_H = 780;

export const G = 2000;
export const BALL_RADIUS = 15;
export const RIM_RX = 40;
export const RIM_RY = 13;
export const MAX_POW = 1450;
/** Must match flight + aim preview */
export const WALL_REST = 0.9;
export const MIN_SHOT = 160;

/**
 * Max position/velocity delta when comparing preview dots vs stepped flight.
 * Float64 integrator noise stays below 1e-9 for fixed PREVIEW_DT steps;
 * use 1e-6 when comparing variable frameDt via substeps.
 */
export const FLIGHT_EPSILON = 1e-9;
export const SUBSTEP_EPSILON = 1e-6;

/**
 * Fixed integrator step (1/120 s). Used by aim preview and server replay.
 * Flight may pass variable frame dt; use `stepProjectileSubsteps` for parity.
 */
export const FIXED_DT = 1 / 120;

/** @deprecated Use FIXED_DT — kept for pitch-parity call sites */
export const PREVIEW_DT = FIXED_DT;
export const PREVIEW_STEPS = 90;
export const PREVIEW_MAX_DOTS = 28;
