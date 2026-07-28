import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pitchJitter, isMuted, setMuted } from "./audioContext.js";

describe("pitchJitter", () => {
  it("stays within ±span of base", () => {
    for (let i = 0; i < 40; i++) {
      const p = pitchJitter(1, 0.05);
      assert.ok(p >= 0.95 && p <= 1.05);
    }
  });
});

describe("mute flag", () => {
  it("setMuted toggles isMuted", () => {
    const prev = isMuted();
    setMuted(true);
    assert.equal(isMuted(), true);
    setMuted(false);
    assert.equal(isMuted(), false);
    setMuted(prev);
  });
});
