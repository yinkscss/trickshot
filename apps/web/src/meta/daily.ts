import { dailySeedFromUtcDate, resolveRunSeed } from "@trickshot/logic";
import type { GameMode } from "@trickshot/shared";

/** UTC calendar day key (`YYYY-MM-DD`). */
export function utcDateKey(date: Date = new Date()): string {
  return dailySeedFromUtcDate(date);
}

/** Daily challenge seed — stable for all clients on the same UTC day. */
export function dailySeed(date: Date = new Date()): string {
  return resolveRunSeed("daily", { runSeed: "", utcDate: date });
}

export function casualRunSeed(runId: string = String(Date.now())): string {
  return runId;
}

export function tournamentRunId(runId: string = String(Date.now())): string {
  return `tournament-${runId}`;
}

/** Resolve authoritative seed for a mode + client context. */
export function seedForMode(
  mode: GameMode,
  ctx: { runSeed: string; utcDate?: Date; tournamentId?: string },
): string {
  return resolveRunSeed(mode, ctx);
}
