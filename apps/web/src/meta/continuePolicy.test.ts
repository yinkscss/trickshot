import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  continueAvailability,
  continuesAllowedForMode,
} from "./continuePolicy.js";

describe("continue policy", () => {
  it("allows sandbox stub for casual + daily after miss", () => {
    assert.deepEqual(continueAvailability("casual", true), {
      allowed: true,
      kind: "sandbox_stub",
    });
    assert.deepEqual(continueAvailability("daily", true), {
      allowed: true,
      kind: "sandbox_stub",
    });
  });

  it("never allows tournament continues", () => {
    assert.equal(continuesAllowedForMode("tournament"), false);
    assert.deepEqual(continueAvailability("tournament", true), {
      allowed: false,
      reason: "no_continue_tourney",
    });
  });

  it("blocks continue when not missed", () => {
    assert.deepEqual(continueAvailability("casual", false), {
      allowed: false,
      reason: "run_not_missed",
    });
  });
});
