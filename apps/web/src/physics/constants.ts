/** Pitch-parity physics constants from docs/animation-pitch.html */

export const G = 2000;
export const BALL_RADIUS = 15;
export const RIM_RX = 40;
export const RIM_RY = 13;
export const MAX_POW = 1450;
/** Must match flight + aim preview */
export const WALL_REST = 0.9;
export const MIN_SHOT = 160;

/** Fixed-step used by aim preview (and available for replay) */
export const PREVIEW_DT = 1 / 120;
export const PREVIEW_STEPS = 90;
export const PREVIEW_MAX_DOTS = 28;
