import type { GameMode, RunSummary } from "@trickshot/shared";

/** Juice label thresholds (pitch `triggerComboAnim` / Alpha meta). */
export type ComboLabel = null | "x2" | "x3" | "ON FIRE";

/** Base dunk points before chain multiplier. */
export const DUNK_BASE_POINTS = 100;

/** Soft-currency bonus when a star is collected mid-flight. */
export const STAR_POINTS = 25;

/** Pitch `starOn`: 90% spawn chance, always on for early climb. */
export const STAR_SPAWN_PROBABILITY = 0.9;

/** Guaranteed star while layout dunk count is below this threshold. */
export const STAR_GUARANTEE_BELOW_SCORE = 2;

export interface ScoreState {
  /** Total point score (dunks + star bonuses). */
  score: number;
  /** Soft-currency stars collected this run. */
  stars: number;
  /** Unbroken dunk chain length (resets on miss / continue accept). */
  chainLength: number;
  /** Whether the current shot has an active star pickup (spawn decision). */
  starActive: boolean;
}

export type ScoreEvent =
  | { type: "dunk" }
  | { type: "miss" }
  | { type: "acceptContinue" }
  | { type: "declineContinue" }
  | { type: "collectStar" }
  | { type: "prepareShot"; fromScore: number; rngUnit: number };

export function createScoreState(): ScoreState {
  return {
    score: 0,
    stars: 0,
    chainLength: 0,
    starActive: false,
  };
}

/** Combo juice label for Sub D — null when no popup. */
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

/** Points awarded for a dunk at the given chain length (after increment). */
export function dunkPoints(chainLength: number): number {
  return DUNK_BASE_POINTS * comboMultiplier(chainLength);
}

/**
 * Pitch `starOn` rule — pass a seeded unit in [0, 1) from `shotRng` in daily/casual.
 */
export function shouldSpawnStar(fromScore: number, rngUnit: number): boolean {
  return (
    rngUnit < STAR_SPAWN_PROBABILITY || fromScore < STAR_GUARANTEE_BELOW_SCORE
  );
}

/**
 * Pure scoring reducer. Combo resets on miss and on continue accept (pitch-aligned).
 * Point total and stars persist across continue; decline is a no-op on counters.
 */
export function reduceScoreEvent(
  state: ScoreState,
  event: ScoreEvent,
): ScoreState {
  switch (event.type) {
    case "prepareShot":
      return {
        ...state,
        starActive: shouldSpawnStar(event.fromScore, event.rngUnit),
      };

    case "dunk": {
      const chainLength = state.chainLength + 1;
      let next: ScoreState = {
        ...state,
        chainLength,
        score: state.score + dunkPoints(chainLength),
      };
      if (next.starActive) {
        next = {
          ...next,
          stars: next.stars + 1,
          starActive: false,
        };
      }
      return next;
    }

    case "collectStar":
      if (!state.starActive) return state;
      return {
        ...state,
        stars: state.stars + 1,
        score: state.score + STAR_POINTS,
        starActive: false,
      };

    case "miss":
    case "acceptContinue":
      return { ...state, chainLength: 0 };

    case "declineContinue":
      return state;

    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
}

export function buildRunSummary(args: {
  mode: GameMode;
  scoreState: ScoreState;
  continuesUsed: number;
  powerupsUsed?: string[];
  seed: string;
  inputLog?: unknown;
}): RunSummary {
  return {
    mode: args.mode,
    chainLength: args.scoreState.chainLength,
    score: args.scoreState.score,
    stars: args.scoreState.stars,
    continuesUsed: args.continuesUsed,
    powerupsUsed: args.powerupsUsed ?? [],
    seed: args.seed,
    ...(args.inputLog !== undefined ? { inputLog: args.inputLog } : {}),
  };
}
