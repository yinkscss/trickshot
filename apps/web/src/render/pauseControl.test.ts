import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COURT_H } from "@trickshot/physics";
import { hitPauseControl, pauseControlRect } from "./pitchDraw.js";

describe("pause control hit target", () => {
  it("hits near the bottom-left bars and misses the center court", () => {
    const r = pauseControlRect(COURT_H, 0);
    assert.ok(hitPauseControl(r.x + r.w / 2, r.y + r.h / 2, COURT_H, 0));
    assert.equal(hitPauseControl(COURT_H / 2, COURT_H / 2, COURT_H, 0), false);
  });
});
