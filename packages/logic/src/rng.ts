/** Deterministic PRNG — same seed yields identical streams in Node and browsers. */

export interface Rng {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Fisher–Yates shuffle (returns new array). */
  shuffle<T>(items: readonly T[]): T[];
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
}

function hashSeed(seed: string | number): number {
  const str = String(seed);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0 || 1;
}

/** Mulberry32 — compact, portable, no Math.random. */
export function createRng(seed: string | number): Rng {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    next,
    range(min: number, max: number): number {
      return min + next() * (max - min);
    },
    shuffle<T>(items: readonly T[]): T[] {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
}

/** UTC calendar date → stable daily seed (`YYYY-MM-DD`). */
export function dailySeedFromUtcDate(date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
