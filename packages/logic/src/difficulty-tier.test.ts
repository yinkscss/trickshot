import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  tierFromDunks,
  tierLayoutModifiers,
} from "./difficulty-tier.js";

describe("tierFromDunks", () => {
  const cases: Array<[number, number]> = [
    [0, 1],
    [4, 1],
    [5, 2],
    [9, 2],
    [10, 3],
    [19, 3],
    [20, 4],
    [39, 4],
    [40, 5],
    [59, 5],
    [60, 6],
    [100, 6],
  ];
  for (const [dunks, tier] of cases) {
    it(`${dunks} dunks → tier ${tier}`, () => {
      assert.equal(tierFromDunks(dunks), tier);
    });
  }
});

describe("tierLayoutModifiers", () => {
  it("tier 1 never requests moving goal", () => {
    assert.equal(tierLayoutModifiers(1).movingGoal, false);
    assert.equal(tierLayoutModifiers(2).movingGoal, false);
  });

  it("tier 3+ enables moving goal", () => {
    assert.equal(tierLayoutModifiers(3).movingGoal, true);
    assert.ok(tierLayoutModifiers(6).moveSpeed > tierLayoutModifiers(3).moveSpeed);
  });

  it("hard bias from tier 4+", () => {
    assert.equal(tierLayoutModifiers(3).hard, false);
    assert.equal(tierLayoutModifiers(4).hard, true);
  });
});
