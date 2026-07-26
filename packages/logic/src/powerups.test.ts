import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applySlowDrop, applyWideHoop, assertPowerupAllowed } from "./powerups.js";

const BASE_LAYOUT = { rimRx: 20, rimRy: 13 };
const BASE_DROP = { gravity: 980, maxPull: 200 };

describe("powerup modifiers", () => {
  it("no-ops when inventory does not grant modifiers", () => {
    assert.deepEqual(applyWideHoop(BASE_LAYOUT, {}, "casual"), BASE_LAYOUT);
    assert.deepEqual(applySlowDrop(BASE_DROP, {}, "casual"), BASE_DROP);
  });

  it("applies wide hoop and slow drop in casual/daily", () => {
    const mods = { wideHoop: true, slowDrop: true };
    const wide = applyWideHoop(BASE_LAYOUT, mods, "casual");
    assert.ok(wide.rimRx > BASE_LAYOUT.rimRx);
    assert.ok(wide.rimRy > BASE_LAYOUT.rimRy);

    const slow = applySlowDrop(BASE_DROP, mods, "daily");
    assert.ok(slow.gravity < BASE_DROP.gravity);
    assert.equal(slow.maxPull, BASE_DROP.maxPull);
  });

  it("hard-disables modifiers in tournament even when granted", () => {
    const mods = { wideHoop: true, slowDrop: true };
    assert.deepEqual(
      applyWideHoop(BASE_LAYOUT, mods, "tournament"),
      BASE_LAYOUT,
    );
    assert.deepEqual(
      applySlowDrop(BASE_DROP, mods, "tournament"),
      BASE_DROP,
    );
    assert.throws(
      () => assertPowerupAllowed("tournament", "wide_hoop"),
      /forbidden/,
    );
  });
});
