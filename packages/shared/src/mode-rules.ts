import type { GameMode } from "./input-log.js";

/** How run seeds are derived — see `docs/STACK_LOCK.md` mode matrix. */
export type SeedSource = "per_run" | "utc_daily" | "tournament_id";

/** Leaderboard scope for a mode. */
export type GlobalBoardPolicy = "optional" | "required" | "tournament";

/** Authoritative per-mode policy row — single source for client, API, contracts. */
export interface ModeRules {
  mode: GameMode;
  allowsContinues: boolean;
  allowsPowerups: boolean;
  seedSource: SeedSource;
  allowsSoftCurrencyStars: boolean;
  globalBoard: GlobalBoardPolicy;
}

export type ModePolicyErrorCode = "continue_forbidden" | "powerup_forbidden";

/** Typed rejection when a mode forbids an action (`legal=no_continue_tourney`, etc.). */
export class ModePolicyError extends Error {
  readonly code: ModePolicyErrorCode;

  constructor(code: ModePolicyErrorCode, message: string) {
    super(message);
    this.name = "ModePolicyError";
    this.code = code;
  }
}

const MODE_RULES: Record<GameMode, ModeRules> = {
  casual: {
    mode: "casual",
    allowsContinues: true,
    allowsPowerups: true,
    seedSource: "per_run",
    allowsSoftCurrencyStars: true,
    globalBoard: "optional",
  },
  daily: {
    mode: "daily",
    allowsContinues: true,
    allowsPowerups: true,
    seedSource: "utc_daily",
    allowsSoftCurrencyStars: true,
    globalBoard: "required",
  },
  tournament: {
    mode: "tournament",
    allowsContinues: false,
    allowsPowerups: false,
    seedSource: "tournament_id",
    allowsSoftCurrencyStars: true,
    globalBoard: "tournament",
  },
  challenges: {
    mode: "challenges",
    allowsContinues: false,
    allowsPowerups: false,
    seedSource: "per_run",
    allowsSoftCurrencyStars: false,
    globalBoard: "optional",
  },
};

/** Locked mode rules matrix — mirrors `GameEconomics` / `docs/STACK_LOCK.md`. */
export function getModeRules(mode: GameMode): ModeRules {
  return MODE_RULES[mode];
}

/** All modes for exhaustive table tests and contract parity checks. */
export const GAME_MODES = [
  "casual",
  "daily",
  "tournament",
  "challenges",
] as const satisfies readonly GameMode[];

export function assertCanContinue(mode: GameMode): void {
  const rules = getModeRules(mode);
  if (!rules.allowsContinues) {
    throw new ModePolicyError(
      "continue_forbidden",
      `continues are forbidden in ${mode} mode`,
    );
  }
}

export function assertCanUsePowerup(mode: GameMode, sku: string): void {
  const rules = getModeRules(mode);
  if (!rules.allowsPowerups) {
    throw new ModePolicyError(
      "powerup_forbidden",
      `powerup ${sku} is forbidden in ${mode} mode`,
    );
  }
}
