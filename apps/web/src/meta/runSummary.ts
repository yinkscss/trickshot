import type { RunSummary } from "@trickshot/shared";

export { buildRunSummary } from "@trickshot/logic";

/** Emit finished run payload for shell / analytics hooks. */
export function emitRunSummary(summary: RunSummary): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<RunSummary>("trickshot:run-summary", { detail: summary }),
  );
}
