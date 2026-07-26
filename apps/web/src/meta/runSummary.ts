import type { GameMode, RunSummary } from "@trickshot/shared";

export function buildRunSummary(args: {
  mode: GameMode;
  chainLength: number;
  score: number;
  continuesUsed: number;
  powerupsUsed?: string[];
  seed: string;
  inputLog?: unknown;
}): RunSummary {
  return {
    mode: args.mode,
    chainLength: args.chainLength,
    score: args.score,
    continuesUsed: args.continuesUsed,
    powerupsUsed: args.powerupsUsed ?? [],
    seed: args.seed,
    ...(args.inputLog !== undefined ? { inputLog: args.inputLog } : {}),
  };
}
