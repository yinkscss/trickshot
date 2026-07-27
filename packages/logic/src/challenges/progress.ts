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

function defaultStorage(): ProgressStorage {
  if (typeof globalThis.localStorage !== "undefined") {
    return globalThis.localStorage;
  }
  return {
    getItem(key) {
      return memory.get(key) ?? null;
    },
    setItem(key, value) {
      memory.set(key, value);
    },
  };
}

export function emptyChallengesProgress(): ChallengesProgress {
  return { cleared: {}, stars: {} };
}

export function loadChallengesProgress(
  storage: ProgressStorage = defaultStorage(),
): ChallengesProgress {
  try {
    const raw = JSON.parse(
      storage.getItem(CHALLENGES_PROGRESS_KEY) || "{}",
    ) as Partial<ChallengesProgress>;
    return {
      cleared: raw.cleared ?? {},
      stars: raw.stars ?? {},
      ...(raw.unlockAll ? { unlockAll: true } : {}),
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
