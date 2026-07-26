import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLocalLeaderboard,
  recordLocalScore,
  type LeaderboardEntry,
} from "./leaderboard.js";

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(k: string) {
    return this.map.has(k) ? this.map.get(k)! : null;
  }
  setItem(k: string, v: string) {
    this.map.set(k, v);
  }
  removeItem(k: string) {
    this.map.delete(k);
  }
}

describe("local leaderboard", () => {
  it("persists top scores across reads", () => {
    (globalThis as { localStorage?: Storage }).localStorage =
      new MemoryStorage() as unknown as Storage;

    const entry = (score: number): LeaderboardEntry => ({
      score,
      stars: 1,
      chainLength: score,
      mode: "casual",
      seed: "casual:1",
      at: new Date().toISOString(),
    });

    recordLocalScore(entry(100));
    recordLocalScore(entry(300));
    recordLocalScore(entry(200));
    const board = getLocalLeaderboard("casual");
    assert.equal(board.length, 3);
    assert.equal(board[0]?.score, 300);
    assert.equal(getLocalLeaderboard("casual")[0]?.score, 300);
  });
});
