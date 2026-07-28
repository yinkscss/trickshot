import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comboLabel,
  dunkPoints,
  DUNK_BASE_POINTS,
} from "@trickshot/logic";
import {
  comboBurstScale,
  makeDunkPopup,
  shakeIntensity,
  stepDunkPopups,
} from "./juice.js";

describe("combo juice", () => {
  it("labels x2 / x3 / ON FIRE at pitch thresholds", () => {
    assert.equal(comboLabel(1), null);
    assert.equal(comboLabel(2), "x2");
    assert.equal(comboLabel(3), "x3");
    assert.equal(comboLabel(4), "ON FIRE");
    assert.equal(comboLabel(9), "ON FIRE");
  });

  it("dunk points follow quality not chain", () => {
    assert.equal(DUNK_BASE_POINTS, 1);
    assert.equal(dunkPoints("swish"), 2);
    assert.equal(dunkPoints("bank"), 1);
    assert.equal(dunkPoints("rim"), 1);
  });

  it("ramps shake and burst with chain length", () => {
    assert.ok(shakeIntensity(4) > shakeIntensity(2));
    assert.ok(comboBurstScale("ON FIRE") > comboBurstScale("x2"));
  });

  it("dunk popup text matches dunkPoints", () => {
    const p = makeDunkPopup(10, 20, "swish");
    assert.equal(p.text, "+2 SWISH");
    const bank = makeDunkPopup(0, 0, "bank");
    assert.equal(bank.text, "+1 BANK");
  });

  it("expires dunk popups after dur", () => {
    const list = [makeDunkPopup(0, 0, "rim")];
    stepDunkPopups(list, 0.5);
    assert.equal(list.length, 1);
    stepDunkPopups(list, 0.5);
    assert.equal(list.length, 0);
  });
});
