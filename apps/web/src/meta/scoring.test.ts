import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comboLabel,
  comboMultiplier,
  dunkScore,
  DUNK_BASE_POINTS,
} from "./scoring";

describe("combo juice", () => {
  it("labels x2 / x3 / ON FIRE at pitch thresholds", () => {
    assert.equal(comboLabel(1), null);
    assert.equal(comboLabel(2), "x2");
    assert.equal(comboLabel(3), "x3");
    assert.equal(comboLabel(4), "ON FIRE");
    assert.equal(comboLabel(9), "ON FIRE");
  });

  it("scales dunk score by multiplier", () => {
    assert.equal(dunkScore(1), DUNK_BASE_POINTS);
    assert.equal(dunkScore(2), DUNK_BASE_POINTS * 2);
    assert.equal(dunkScore(3), DUNK_BASE_POINTS * 3);
    assert.equal(dunkScore(4), DUNK_BASE_POINTS * 4);
    assert.equal(comboMultiplier(2), 2);
  });
});
