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

  it("loadChallengesProgress falls back when localStorage access throws", () => {
    const desc = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    try {
      const loaded = loadChallengesProgress();
      assert.deepEqual(loaded, emptyChallengesProgress());
    } finally {
      if (desc) Object.defineProperty(globalThis, "localStorage", desc);
      else delete (globalThis as { localStorage?: Storage }).localStorage;
    }
  });

  it("normalizes malformed persisted progress maps", () => {
    const storage = memStorage({
      [CHALLENGES_PROGRESS_KEY]: JSON.stringify({
        cleared: { "0": true, "1": "yes", "2": false },
        stars: { "0": 2, "1": "two", "2": NaN },
        unlockAll: "yes",
      }),
    });
    const loaded = loadChallengesProgress(storage);
    assert.deepEqual(loaded.cleared, { "0": true });
    assert.deepEqual(loaded.stars, { "0": 2 });
    assert.equal(loaded.unlockAll, undefined);

    const badRoot = memStorage({
      [CHALLENGES_PROGRESS_KEY]: JSON.stringify(["not", "an", "object"]),
    });
    assert.deepEqual(loadChallengesProgress(badRoot), emptyChallengesProgress());
  });
});
