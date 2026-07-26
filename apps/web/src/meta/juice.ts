import { comboLabel } from "@trickshot/logic";

/** Camera shake intensity scaled by dunk chain (pitch parity). */
export function shakeIntensity(chainLength: number): number {
  if (chainLength >= 4) return 12;
  if (chainLength === 3) return 8;
  if (chainLength === 2) return 5;
  return 3;
}

/** Combo popup scale burst — higher chains punch harder. */
export function comboBurstScale(label: string): number {
  if (label === "ON FIRE") return 1.35;
  if (label === "x3") return 1.28;
  return 1.22;
}

/** Subtitle under combo popup label (pitch `triggerComboAnim`). */
export function comboSubtext(chainLength: number): string {
  const label = comboLabel(chainLength);
  if (!label) return "SWISH";
  if (label === "ON FIRE") return `x${chainLength} CHAIN`;
  if (chainLength >= 5) return "INSANE";
  if (chainLength >= 3) return "COMBO";
  if (label === "x2") return "COMBO";
  return "SWISH";
}
