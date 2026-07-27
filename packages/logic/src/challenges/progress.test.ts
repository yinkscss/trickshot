import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CHALLENGES_PROGRESS_KEY,
  emptyChallengesProgress,
  isChallengeUnlocked,
  loadChallengesProgress,
  recordChallengeClear,
  saveChallengesProgress,
  type ProgressStorage,
} from "./progress.js";

function memStorage(init: Record<string, string> = {}): ProgressStorage {
  const map = new Map(Object.entries(init));
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => {
      map.set(k, v);
    },
  };
}

describe("challenges progress", () => {
  it("level 0 is unlocked; later levels need previous clear", () => {
    const p = emptyChallengesProgress();
    assert.equal(isChallengeUnlocked(0, p), true);
    assert.equal(isChallengeUnlocked(1, p), false);
    const cleared = recordChallengeClear(p, 0, 1);
    assert.equal(isChallengeUnlocked(1, cleared), true);
    assert.equal(cleared.stars["0"], 1);
  });

  it("keeps best star count and round-trips storage", () => {
    const storage = memStorage();
    let p = recordChallengeClear(emptyChallengesProgress(), 0, 1);
    p = recordChallengeClear(p, 0, 2);
    saveChallengesProgress(p, storage);
    const loaded = loadChallengesProgress(storage);
    assert.equal(loaded.cleared["0"], true);
    assert.equal(loaded.stars["0"], 2);
    assert.ok(storage.getItem(CHALLENGES_PROGRESS_KEY));
  });

  it("unlockAll opens every level", () => {
    assert.equal(
      isChallengeUnlocked(29, { cleared: {}, stars: {}, unlockAll: true }),
      true,
    );
  });
});
