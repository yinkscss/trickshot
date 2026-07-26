import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  GAME_MODES,
  ModePolicyError,
  assertCanContinue,
  assertCanUsePowerup,
  getModeRules,
} from "./mode-rules.js";
import {
  TOURNAMENT_ALLOWS_CONTINUES,
  TOURNAMENT_ALLOWS_POWERUPS,
} from "./index.js";

/** Locked matrix from issue #24 / STACK_LOCK — exhaustive table driver. */
const EXPECTED_MATRIX: Record<
  (typeof GAME_MODES)[number],
  ReturnType<typeof getModeRules>
> = {
  casual: {
    mode: "casual",
    allowsContinues: true,
    allowsPowerups: true,
    seedSource: "per_run",
    allowsSoftCurrencyStars: true,
    globalBoard: "optional",
  },
  daily: {
    mode: "daily",
    allowsContinues: true,
    allowsPowerups: true,
    seedSource: "utc_daily",
    allowsSoftCurrencyStars: true,
    globalBoard: "required",
  },
  tournament: {
    mode: "tournament",
    allowsContinues: false,
    allowsPowerups: false,
    seedSource: "tournament_id",
    allowsSoftCurrencyStars: true,
    globalBoard: "tournament",
  },
};

describe("getModeRules matrix", () => {
  for (const mode of GAME_MODES) {
    it(`${mode} matches locked policy row`, () => {
      assert.deepEqual(getModeRules(mode), EXPECTED_MATRIX[mode]);
    });
  }
});

describe("assertCanContinue", () => {
  for (const mode of GAME_MODES) {
    const rules = EXPECTED_MATRIX[mode];
    it(`${mode}: ${rules.allowsContinues ? "allows" : "forbids"} continues`, () => {
      if (rules.allowsContinues) {
        assert.doesNotThrow(() => assertCanContinue(mode));
      } else {
        assert.throws(() => assertCanContinue(mode), (err: unknown) => {
          assert.ok(err instanceof ModePolicyError);
          assert.equal(err.code, "continue_forbidden");
          return true;
        });
      }
    });
  }
});

describe("assertCanUsePowerup", () => {
  for (const mode of GAME_MODES) {
    const rules = EXPECTED_MATRIX[mode];
    it(`${mode}: ${rules.allowsPowerups ? "allows" : "forbids"} powerups`, () => {
      if (rules.allowsPowerups) {
        assert.doesNotThrow(() => assertCanUsePowerup(mode, "wide_hoop"));
      } else {
        assert.throws(() => assertCanUsePowerup(mode, "slow_drop"), (err: unknown) => {
          assert.ok(err instanceof ModePolicyError);
          assert.equal(err.code, "powerup_forbidden");
          assert.match(String(err.message), /slow_drop/);
          return true;
        });
      }
    });
  }
});

describe("GameEconomics parity", () => {
  it("tournament flags match shared tournament row", () => {
    const t = getModeRules("tournament");
    assert.equal(TOURNAMENT_ALLOWS_CONTINUES, t.allowsContinues);
    assert.equal(TOURNAMENT_ALLOWS_POWERUPS, t.allowsPowerups);
  });
});
