import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COURT_H, COURT_W } from "@trickshot/physics";
import { LEVELS } from "./levels.js";
import {
  SOLVE_ANGLES,
  SOLVE_PHASES,
  SOLVE_POWERS,
  solveLevel,
} from "./solve.js";

describe("challenges solvability (390×780)", () => {
  it("has 30 authored levels", () => {
    assert.equal(LEVELS.length, 30);
  });

  it(
    "every level has ≥1 clear and ≥1 full-star on the pitch grid",
    { timeout: 300_000 },
    () => {
      assert.equal(COURT_W, 390);
      assert.equal(COURT_H, 780);

      const full = LEVELS.map((_, i) =>
        solveLevel(i, {
          angles: SOLVE_ANGLES,
          powers: SOLVE_POWERS,
          phases: SOLVE_PHASES,
        }),
      );

      for (const r of full) {
        assert.ok(
          r.hits >= 1,
          `level ${r.i} ${r.name}: expected ≥1 clear, got ${r.hits}`,
        );
        assert.ok(
          r.starHits >= 1,
          `level ${r.i} ${r.name}: expected ≥1 full-star, got ${r.starHits}`,
        );
      }

      const minClear = Math.min(...full.map((r) => r.hits));
      const minFullStars = Math.min(...full.map((r) => r.starHits));
      console.log(
        JSON.stringify({
          court: `${COURT_W}x${COURT_H}`,
          grid: `${SOLVE_ANGLES}x${SOLVE_POWERS}x${SOLVE_PHASES}`,
          minClear,
          minFullStars,
          perLevel: full.map((r) => ({
            i: r.i,
            name: r.name,
            hits: r.hits,
            starHits: r.starHits,
          })),
        }),
      );
    },
  );
});
