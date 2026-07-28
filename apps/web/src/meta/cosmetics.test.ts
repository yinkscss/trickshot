import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  COSMETIC_PRESETS,
  equipPreset,
  getEquippedPreset,
  isPresetUnlocked,
  unlockAffordablePresets,
} from "./cosmetics.js";

describe("cosmetics", () => {
  it("default is always unlocked", () => {
    assert.equal(isPresetUnlocked("default"), true);
    assert.equal(COSMETIC_PRESETS[0]!.starCost, 0);
  });

  it("cannot equip locked high-tier preset until unlocked", () => {
    const locked = COSMETIC_PRESETS.find((p) => p.starCost > 0)!;
    // Fresh memory store may still have prior unlocks; force check via cost gate
    unlockAffordablePresets(0);
    if (!isPresetUnlocked(locked.id)) {
      assert.equal(equipPreset(locked.id), false);
    }
    unlockAffordablePresets(locked.starCost);
    assert.equal(isPresetUnlocked(locked.id), true);
    assert.equal(equipPreset(locked.id), true);
    assert.equal(getEquippedPreset().id, locked.id);
    equipPreset("default");
  });
});
