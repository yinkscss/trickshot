/** UTC calendar day seed so all clients share the daily climb. */

export function utcDateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

export function dailySeed(date: Date = new Date()): string {
  return `daily:${utcDateKey(date)}`;
}

export function casualSeed(runId: string = String(Date.now())): string {
  return `casual:${runId}`;
}

export function tournamentSeed(runId: string): string {
  return `tournament:${runId}`;
}

/** FNV-1a 32-bit — stable across browsers for layout jitter. */
export function hashSeed(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Unit float in [0, 1) from seed + salt. */
export function seededUnit(seed: string, salt: string): number {
  return (hashSeed(`${seed}|${salt}`) % 10_000) / 10_000;
}
