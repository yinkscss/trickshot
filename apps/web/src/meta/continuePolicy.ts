import {
  TOURNAMENT_ALLOWS_CONTINUES,
  type GameMode,
} from "@trickshot/shared";

export type ContinueBlockReason = "no_continue_tourney" | "run_not_missed";

export type ContinueAvailability =
  | { allowed: true; kind: "sandbox_stub" }
  | { allowed: false; reason: ContinueBlockReason };

/** Mode-aware continue gate — tournament never exposes a continue CTA. */
export function continueAvailability(
  mode: GameMode,
  missed: boolean,
): ContinueAvailability {
  if (!missed) return { allowed: false, reason: "run_not_missed" };
  if (!continuesAllowedForMode(mode)) {
    return { allowed: false, reason: "no_continue_tourney" };
  }
  return { allowed: true, kind: "sandbox_stub" };
}

export function continuesAllowedForMode(mode: GameMode): boolean {
  if (mode === "tournament") return TOURNAMENT_ALLOWS_CONTINUES;
  return true;
}
