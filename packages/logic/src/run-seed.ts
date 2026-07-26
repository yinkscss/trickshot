import { getModeRules, type GameMode } from "@trickshot/shared";
import { dailySeedFromUtcDate } from "./rng.js";

export interface RunSeedContext {
  /** Per-run uuid (casual) or client-generated fallback. */
  runSeed: string;
  /** UTC anchor for daily mode (default: now). */
  utcDate?: Date;
  /** Tournament / event id — required when `mode === "tournament"`. */
  tournamentId?: string;
}

/** Resolve authoritative run seed from mode policy + client context. */
export function resolveRunSeed(mode: GameMode, ctx: RunSeedContext): string {
  const { seedSource } = getModeRules(mode);
  switch (seedSource) {
    case "per_run":
      return ctx.runSeed;
    case "utc_daily":
      return dailySeedFromUtcDate(ctx.utcDate ?? new Date());
    case "tournament_id":
      if (!ctx.tournamentId) {
        throw new Error("tournament mode requires tournamentId in RunSeedContext");
      }
      return ctx.tournamentId;
    default: {
      const _exhaustive: never = seedSource;
      return _exhaustive;
    }
  }
}
