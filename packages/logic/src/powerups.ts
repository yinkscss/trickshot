import {
  TOURNAMENT_ALLOWS_POWERUPS,
  type GameMode,
} from "@trickshot/shared";

/** Inventory-granted modifiers (stubs — no-op until #9 wires inventory). */
export interface PowerupModifiers {
  wideHoop?: boolean;
  slowDrop?: boolean;
}

export interface HoopLayout {
  rimRx: number;
  rimRy: number;
}

export interface DropConstants {
  gravity: number;
  maxPull: number;
}

const WIDE_HOOP_SCALE = 1.12;
const SLOW_DROP_SCALE = 0.85;

export function powerupsAllowed(mode: GameMode): boolean {
  if (mode === "tournament") return TOURNAMENT_ALLOWS_POWERUPS;
  return true;
}

/** Wide hoop — tournament hard-disabled even when inventory grants it. */
export function applyWideHoop(
  layout: HoopLayout,
  modifiers: PowerupModifiers,
  mode: GameMode,
): HoopLayout {
  if (!modifiers.wideHoop || !powerupsAllowed(mode)) return layout;
  return {
    rimRx: layout.rimRx * WIDE_HOOP_SCALE,
    rimRy: layout.rimRy * WIDE_HOOP_SCALE,
  };
}

/** Slow drop — tournament hard-disabled even when inventory grants it. */
export function applySlowDrop(
  constants: DropConstants,
  modifiers: PowerupModifiers,
  mode: GameMode,
): DropConstants {
  if (!modifiers.slowDrop || !powerupsAllowed(mode)) return constants;
  return {
    gravity: constants.gravity * SLOW_DROP_SCALE,
    maxPull: constants.maxPull,
  };
}
