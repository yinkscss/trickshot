/** Shared constants & types — stack lock: docs/STACK_LOCK.md */

import type { GameMode, InputLog } from "./input-log.js";

export const CELO_SEPOLIA_CHAIN_ID = 11142220;
export const CELO_MAINNET_CHAIN_ID = 42220;

export const TOURNAMENT_HOUSE_RAKE_BPS = 1500; // 15%
export const TOURNAMENT_PLAYER_SHARE_BPS = 8500; // 85%

/** Locked: no continues in paid tournaments */
export const TOURNAMENT_ALLOWS_CONTINUES = false;

/** Locked: powerups banned in tournament mode */
export const TOURNAMENT_ALLOWS_POWERUPS = false;

export type { GameMode } from "./input-log.js";
export {
  INPUT_LOG_MAX_BYTES,
  INPUT_LOG_MAX_FRAMES,
  INPUT_LOG_VERSION,
  deserializeInputLog,
  inputLogFrameSchema,
  inputLogFrameTypeSchema,
  inputLogSchema,
  parseInputLog,
  serializeInputLog,
  validateInputLog,
  type InputLog,
  type InputLogFrame,
  type InputLogFrameType,
  type InputLogValidationError,
  type InputLogValidationResult,
} from "./input-log.js";

export interface RunSummary {
  mode: GameMode;
  chainLength: number;
  score: number;
  /** Soft-currency stars collected this run */
  stars: number;
  continuesUsed: number;
  powerupsUsed: string[];
  seed: string;
  /** Client input log for hybrid server replay (Alpha+) */
  inputLog?: InputLog;
}
