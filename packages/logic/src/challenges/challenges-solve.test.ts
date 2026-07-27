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

/** Pitch baseline at 390×780 on the 110×16×5 grid. */
const MIN_CLEARS = 15;
const MIN_FULL_STARS = 5;

describe("challenges solvability (390×780)", () => {
  it("has 30 authored levels", () => {
    assert.equal(LEVELS.length, 30);
  });

  it(
    "every level meets clear and full-star baselines on the pitch grid",
    { timeout: 600_000 },
    () => {
      assert.equal(COURT_W, 390);
      assert.equal(COURT_H, 780);

      const results = LEVELS.map((_, i) =>
        solveLevel(i, {
          angles: SOLVE_ANGLES,
          powers: SOLVE_POWERS,
          phases: SOLVE_PHASES,
        }),
      );

      for (const r of results) {
        assert.ok(
          r.hits >= MIN_CLEARS,
          `level ${r.i} ${r.name}: expected ≥${MIN_CLEARS} clears, got ${r.hits}`,
        );
        assert.ok(
          r.starHits >= MIN_FULL_STARS,
          `level ${r.i} ${r.name}: expected ≥${MIN_FULL_STARS} full-star clears, got ${r.starHits}`,
        );
      }

      const minClear = Math.min(...results.map((r) => r.hits));
      const minFullStars = Math.min(...results.map((r) => r.starHits));
      console.log(
        JSON.stringify({
          court: `${COURT_W}x${COURT_H}`,
          grid: `${SOLVE_ANGLES}x${SOLVE_POWERS}x${SOLVE_PHASES}`,
          minClear,
          minFullStars,
          perLevel: results.map((r) => ({
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
