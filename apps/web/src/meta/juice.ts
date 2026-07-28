import { comboLabel, dunkPoints, dunkQualityLabel, type DunkQuality } from "@trickshot/logic";

/** Camera shake intensity scaled by dunk chain (visual streak). */
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

export interface DunkPopup {
  x: number;
  y: number;
  text: string;
  t: number;
  dur: number;
}

export interface ScoreRing {
  x: number;
  y: number;
  t: number;
  dur: number;
}

export function makeDunkPopup(
  x: number,
  y: number,
  quality: DunkQuality,
): DunkPopup {
  const pts = dunkPoints(quality);
  return {
    x,
    y,
    text: `+${pts} ${dunkQualityLabel(quality)}`,
    t: 0,
    dur: 0.9,
  };
}

export function makeScoreRing(x: number, y: number): ScoreRing {
  return { x, y, t: 0, dur: 0.7 };
}

export function stepDunkPopups(list: DunkPopup[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const p = list[i]!;
    p.t += dt;
    if (p.t >= p.dur) list.splice(i, 1);
  }
}

export function stepScoreRings(list: ScoreRing[], dt: number): void {
  for (let i = list.length - 1; i >= 0; i--) {
    const r = list[i]!;
    r.t += dt;
    if (r.t >= r.dur) list.splice(i, 1);
  }
}
