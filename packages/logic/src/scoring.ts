import type { GameMode, InputLog, RunSummary } from "@trickshot/shared";

/** Juice label thresholds (visual streak only — no longer multiplies points). */
export type ComboLabel = null | "x2" | "x3" | "ON FIRE";

/** Dunk quality for point award + popup label. */
export type DunkQuality = "swish" | "bank" | "rim";

/** Base dunk points (perfect swish uses ×2). */
export const DUNK_BASE_POINTS = 1;

/** Soft-currency unit when a star is collected (does not add to run score). */
export const STAR_POINTS = 25;

/** Pitch `starOn`: 90% spawn chance, always on for early climb. */
export const STAR_SPAWN_PROBABILITY = 0.9;

/** Guaranteed star while layout dunk count is below this threshold. */
export const STAR_GUARANTEE_BELOW_SCORE = 2;

export interface ScoreState {
  /** Total point score (dunk quality points only). */
  score: number;
  /** Soft-currency stars collected this run. */
  stars: number;
  /** Unbroken dunk chain length (resets on miss / continue accept). */
  chainLength: number;
  /** Whether the current shot has an active star pickup (spawn decision). */
  starActive: boolean;
}

export type ScoreEvent =
  | { type: "dunk"; quality: DunkQuality }
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

/** Combo juice label — visual/audio streak only. */
export function comboLabel(chainLength: number): ComboLabel {
  if (chainLength >= 4) return "ON FIRE";
  if (chainLength === 3) return "x3";
  if (chainLength === 2) return "x2";
  return null;
}

/**
 * Classify dunk from per-flight flags.
 * - swish: no wall bounce, no rim contact
 * - bank: ≥1 screen-edge wall bounce
 * - rim: rim contact without wall bounce (dirty +1)
 */
export function classifyDunk(flags: {
  wallBounced: boolean;
  rimTouched: boolean;
}): DunkQuality {
  if (!flags.wallBounced && !flags.rimTouched) return "swish";
  if (flags.wallBounced) return "bank";
  return "rim";
}

/** Points awarded for a dunk by quality (swish ×2, else +1). */
export function dunkPoints(quality: DunkQuality): number {
  return quality === "swish" ? DUNK_BASE_POINTS * 2 : DUNK_BASE_POINTS;
}

/** Uppercase popup tag for dunk quality. */
export function dunkQualityLabel(quality: DunkQuality): string {
  if (quality === "swish") return "SWISH";
  if (quality === "bank") return "BANK";
  return "RIM";
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
 * Pure scoring reducer. Chain resets on miss and on continue accept.
 * Stars are soft-currency only (collectStar does not add run score).
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
        score: state.score + dunkPoints(event.quality),
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
  inputLog?: InputLog;
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
