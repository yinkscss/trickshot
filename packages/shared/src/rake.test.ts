import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  TOURNAMENT_ALLOWS_CONTINUES,
  TOURNAMENT_ALLOWS_POWERUPS,
  TOURNAMENT_HOUSE_RAKE_BPS,
  TOURNAMENT_PLAYER_SHARE_BPS,
} from "./index.js";

describe("tournament economic constants", () => {
  it("keeps 15% house rake and 85% player share", () => {
    assert.equal(TOURNAMENT_HOUSE_RAKE_BPS, 1500);
    assert.equal(TOURNAMENT_PLAYER_SHARE_BPS, 8500);
    assert.equal(TOURNAMENT_HOUSE_RAKE_BPS + TOURNAMENT_PLAYER_SHARE_BPS, 10_000);
  });

  it("honors stack-lock tournament posture", () => {
    assert.equal(TOURNAMENT_ALLOWS_CONTINUES, false);
    assert.equal(TOURNAMENT_ALLOWS_POWERUPS, false);
  });
});
