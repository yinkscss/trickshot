/** localStorage key — pitch parity; Supabase persistence is issue #43. */
export const CHALLENGES_PROGRESS_KEY = "trickshot.challenges.v1";

export interface ChallengesProgress {
  /** Level index → cleared. */
  cleared: Record<string, boolean>;
  /** Level index → best star count collected on a clear. */
  stars: Record<string, number>;
  unlockAll?: boolean;
}

export type ProgressStorage = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
};

const memory = new Map<string, string>();

function memoryStorage(): ProgressStorage {
  return {
    getItem(key) {
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
    },
  };
}

function defaultStorage(): ProgressStorage {
  try {
    const ls = globalThis.localStorage;
    if (typeof ls !== "undefined") return ls;
  } catch {
    /* SecurityError / storage disabled — same class as setItem failures */
  }
  return memoryStorage();
}

export function emptyChallengesProgress(): ChallengesProgress {
  return { cleared: {}, stars: {} };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function normalizeClearedMap(raw: unknown): Record<string, boolean> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (v === true) out[k] = true;
  }
  return out;
}

function normalizeStarsMap(raw: unknown): Record<string, number> {
  if (!isPlainObject(raw)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "number" && Number.isFinite(v) && v >= 0) {
      out[k] = v;
    }
  }
  return out;
}

export function loadChallengesProgress(
  storage: ProgressStorage = defaultStorage(),
): ChallengesProgress {
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(CHALLENGES_PROGRESS_KEY) || "{}",
    );
    if (!isPlainObject(parsed)) return emptyChallengesProgress();
    return {
      cleared: normalizeClearedMap(parsed.cleared),
      stars: normalizeStarsMap(parsed.stars),
      ...(parsed.unlockAll === true ? { unlockAll: true } : {}),
    };
  } catch {
    return emptyChallengesProgress();
  }
}

export function saveChallengesProgress(
  progress: ChallengesProgress,
  storage: ProgressStorage = defaultStorage(),
): void {
  try {
    storage.setItem(CHALLENGES_PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    /* private mode / quota */
  }
}

/** Level 0 is free; otherwise previous level must be cleared (or unlockAll). */
export function isChallengeUnlocked(
  levelIndex: number,
  progress: ChallengesProgress,
): boolean {
  if (levelIndex <= 0) return true;
  if (progress.unlockAll) return true;
  return !!progress.cleared[String(levelIndex - 1)] || !!progress.cleared[levelIndex - 1];
}

/** Record a clear — keeps the best star count for the level. */
export function recordChallengeClear(
  progress: ChallengesProgress,
  levelIndex: number,
  starsCollected: number,
): ChallengesProgress {
  const key = String(levelIndex);
  const prev = progress.stars[key] ?? progress.stars[levelIndex] ?? 0;
  return {
    ...progress,
    cleared: { ...progress.cleared, [key]: true },
    stars: {
      ...progress.stars,
      [key]: Math.max(prev, starsCollected),
    },
  };
}
