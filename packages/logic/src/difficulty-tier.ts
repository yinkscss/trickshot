/**
 * Dunk-count difficulty tiers — compose on top of obstacle-type unlocks.
 * Key is cleared dunks entering the next shot (`fromScore` / PlayLoop.score).
 */

export type DifficultyTier = 1 | 2 | 3 | 4 | 5 | 6;

export interface TierLayoutModifiers {
  tier: DifficultyTier;
  /** Multiplier on spawn jitter amplitude. */
  jitterScale: number;
  /** Probability of spawning an obstacle when types are unlocked (0–1). */
  obstacleChance: number;
  /** Prefer harder obstacle params. */
  hard: boolean;
  movingGoal: boolean;
  moveSpeed: number;
  moveRange: number;
}

const TIER_THRESHOLDS: Array<{ minDunks: number; tier: DifficultyTier }> = [
  { minDunks: 60, tier: 6 },
  { minDunks: 40, tier: 5 },
  { minDunks: 20, tier: 4 },
  { minDunks: 10, tier: 3 },
  { minDunks: 5, tier: 2 },
  { minDunks: 0, tier: 1 },
];

export function tierFromDunks(dunks: number): DifficultyTier {
  const n = Math.max(0, Math.floor(dunks));
  for (const row of TIER_THRESHOLDS) {
    if (n >= row.minDunks) return row.tier;
  }
  return 1;
}

export function tierLayoutModifiers(tier: DifficultyTier): TierLayoutModifiers {
  switch (tier) {
    case 1:
      return {
        tier,
        jitterScale: 1,
        obstacleChance: 1,
        hard: false,
        movingGoal: false,
        moveSpeed: 0,
        moveRange: 0,
      };
    case 2:
      return {
        tier,
        jitterScale: 1.25,
        obstacleChance: 1,
        hard: false,
        movingGoal: false,
        moveSpeed: 0,
        moveRange: 0,
      };
    case 3:
      return {
        tier,
        jitterScale: 1.35,
        obstacleChance: 1,
        hard: false,
        movingGoal: true,
        moveSpeed: 1.6,
        moveRange: 18,
      };
    case 4:
      return {
        tier,
        jitterScale: 1.5,
        obstacleChance: 1,
        hard: true,
        movingGoal: true,
        moveSpeed: 2.2,
        moveRange: 26,
      };
    case 5:
      return {
        tier,
        jitterScale: 1.65,
        obstacleChance: 1,
        hard: true,
        movingGoal: true,
        moveSpeed: 2.8,
        moveRange: 34,
      };
    case 6:
    default:
      return {
        tier: 6,
        jitterScale: 1.8,
        obstacleChance: 1,
        hard: true,
        movingGoal: true,
        moveSpeed: 3.4,
        moveRange: 42,
      };
  }
}
