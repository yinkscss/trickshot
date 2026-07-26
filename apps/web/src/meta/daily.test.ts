import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dailySeed, seededUnit, utcDateKey } from "./daily";
import { layoutForSide } from "../game/layout";

describe("daily seed", () => {
  it("is stable for a UTC calendar day", () => {
    const a = new Date("2026-07-26T01:00:00.000Z");
    const b = new Date("2026-07-26T23:59:59.000Z");
    const c = new Date("2026-07-27T00:00:00.000Z");
    assert.equal(utcDateKey(a), "2026-07-26");
    assert.equal(dailySeed(a), dailySeed(b));
    assert.notEqual(dailySeed(a), dailySeed(c));
  });

  it("yields identical daily layouts for the same seed", () => {
    const seed = dailySeed(new Date("2026-07-26T12:00:00.000Z"));
    const u = seededUnit(seed, "ty:0:1");
    assert.ok(u >= 0 && u < 1);
    const L1 = layoutForSide(1, 0, 390, 780, seed);
    const L2 = layoutForSide(1, 0, 390, 780, seed);
    assert.deepEqual(L1, L2);
    const other = layoutForSide(1, 0, 390, 780, dailySeed(new Date("2026-07-27T12:00:00.000Z")));
    assert.notEqual(L1.ty, other.ty);
  });
});
