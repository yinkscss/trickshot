import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comboLabel,
  comboMultiplier,
  dunkPoints,
  DUNK_BASE_POINTS,
} from "@trickshot/logic";
import { comboBurstScale, shakeIntensity } from "./juice.js";

describe("combo juice", () => {
  it("labels x2 / x3 / ON FIRE at pitch thresholds", () => {
    assert.equal(comboLabel(1), null);
    assert.equal(comboLabel(2), "x2");
    assert.equal(comboLabel(3), "x3");
    assert.equal(comboLabel(4), "ON FIRE");
    assert.equal(comboLabel(9), "ON FIRE");
  });

  it("scales dunk score by multiplier", () => {
    assert.equal(dunkPoints(1), DUNK_BASE_POINTS);
    assert.equal(dunkPoints(2), DUNK_BASE_POINTS * 2);
    assert.equal(dunkPoints(3), DUNK_BASE_POINTS * 3);
    assert.equal(dunkPoints(4), DUNK_BASE_POINTS * 4);
    assert.equal(comboMultiplier(2), 2);
  });

  it("ramps shake and burst with chain length", () => {
    assert.ok(shakeIntensity(4) > shakeIntensity(2));
    assert.ok(comboBurstScale("ON FIRE") > comboBurstScale("x2"));
  });
});
