import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GAME_MODES, getModeRules } from "@trickshot/shared";
import { resolveRunSeed } from "./run-seed.js";

const RUN = "casual-uuid-abc";
const TOURNEY = "event-summer-2026";

describe("resolveRunSeed", () => {
  for (const mode of GAME_MODES) {
    const { seedSource } = getModeRules(mode);
    it(`${mode} uses ${seedSource} seed source`, () => {
      const ctx = {
        runSeed: RUN,
        utcDate: new Date("2026-07-26T12:00:00.000Z"),
        tournamentId: TOURNEY,
      };
      const seed = resolveRunSeed(mode, ctx);
      switch (seedSource) {
        case "per_run":
          assert.equal(seed, RUN);
          break;
        case "utc_daily":
          assert.equal(seed, "2026-07-26");
          break;
        case "tournament_id":
          assert.equal(seed, TOURNEY);
          break;
      }
    });
  }

  it("throws when tournament mode lacks tournamentId", () => {
    assert.throws(
      () => resolveRunSeed("tournament", { runSeed: RUN }),
      /tournamentId/,
    );
  });
});
