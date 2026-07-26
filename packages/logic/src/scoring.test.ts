import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  comboLabel,
  comboMultiplier,
  createScoreState,
  dunkPoints,
  DUNK_BASE_POINTS,
  reduceScoreEvent,
  shouldSpawnStar,
  STAR_GUARANTEE_BELOW_SCORE,
  STAR_POINTS,
  STAR_SPAWN_PROBABILITY,
  buildRunSummary,
} from "./scoring.js";

describe("comboLabel", () => {
  const cases: Array<[number, ReturnType<typeof comboLabel>]> = [
    [0, null],
    [1, null],
    [2, "x2"],
    [3, "x3"],
    [4, "ON FIRE"],
    [9, "ON FIRE"],
  ];

  for (const [chain, label] of cases) {
    it(`chain ${chain} → ${label ?? "null"}`, () => {
      assert.equal(comboLabel(chain), label);
    });
  }
});

describe("comboMultiplier", () => {
  it("scales 1 / 2 / 3 / 4+ by chain length", () => {
    assert.equal(comboMultiplier(0), 1);
    assert.equal(comboMultiplier(1), 1);
    assert.equal(comboMultiplier(2), 2);
    assert.equal(comboMultiplier(3), 3);
    assert.equal(comboMultiplier(4), 4);
    assert.equal(comboMultiplier(10), 4);
  });
});

describe("dunkPoints", () => {
  it("applies base × multiplier", () => {
    assert.equal(dunkPoints(1), DUNK_BASE_POINTS);
    assert.equal(dunkPoints(2), DUNK_BASE_POINTS * 2);
    assert.equal(dunkPoints(3), DUNK_BASE_POINTS * 3);
    assert.equal(dunkPoints(4), DUNK_BASE_POINTS * 4);
  });
});

describe("shouldSpawnStar", () => {
  it("always spawns below guarantee threshold", () => {
    for (let score = 0; score < STAR_GUARANTEE_BELOW_SCORE; score++) {
      assert.equal(shouldSpawnStar(score, 0.99), true);
      assert.equal(shouldSpawnStar(score, 0), true);
    }
  });

  it("uses 90% probability at or above threshold", () => {
    assert.equal(shouldSpawnStar(2, 0), true);
    assert.equal(shouldSpawnStar(2, STAR_SPAWN_PROBABILITY - 0.01), true);
    assert.equal(shouldSpawnStar(2, STAR_SPAWN_PROBABILITY), false);
    assert.equal(shouldSpawnStar(5, 0.95), false);
  });
});

describe("reduceScoreEvent", () => {
  it("starts empty", () => {
    const s = createScoreState();
    assert.deepEqual(s, {
      score: 0,
      stars: 0,
      chainLength: 0,
      starActive: false,
    });
  });

  it("prepareShot sets starActive from seeded roll", () => {
    const s = reduceScoreEvent(createScoreState(), {
      type: "prepareShot",
      fromScore: 0,
      rngUnit: 0.5,
    });
    assert.equal(s.starActive, true);

    const off = reduceScoreEvent(createScoreState(), {
      type: "prepareShot",
      fromScore: 5,
      rngUnit: 0.95,
    });
    assert.equal(off.starActive, false);
  });

  it("dunk increments chain and adds multiplied points", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk" });
    assert.equal(s.chainLength, 1);
    assert.equal(s.score, DUNK_BASE_POINTS);

    s = reduceScoreEvent(s, { type: "dunk" });
    assert.equal(s.chainLength, 2);
    assert.equal(s.score, DUNK_BASE_POINTS + DUNK_BASE_POINTS * 2);
    assert.equal(comboLabel(s.chainLength), "x2");
  });

  it("auto-collects star on dunk when starActive", () => {
    let s = reduceScoreEvent(createScoreState(), {
      type: "prepareShot",
      fromScore: 0,
      rngUnit: 0,
    });
    s = reduceScoreEvent(s, { type: "dunk" });
    assert.equal(s.stars, 1);
    assert.equal(s.starActive, false);
  });

  it("collectStar adds bonus points once", () => {
    let s = reduceScoreEvent(createScoreState(), {
      type: "prepareShot",
      fromScore: 1,
      rngUnit: 0,
    });
    s = reduceScoreEvent(s, { type: "collectStar" });
    assert.equal(s.stars, 1);
    assert.equal(s.score, STAR_POINTS);
    assert.equal(s.starActive, false);

    const again = reduceScoreEvent(s, { type: "collectStar" });
    assert.deepEqual(again, s);
  });

  it("miss resets combo but keeps score and stars", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk" });
    s = reduceScoreEvent(s, { type: "dunk" });
    s = reduceScoreEvent(s, { type: "miss" });
    assert.equal(s.chainLength, 0);
    assert.equal(s.score, DUNK_BASE_POINTS + DUNK_BASE_POINTS * 2);
    assert.equal(s.stars, 0);
  });

  it("acceptContinue resets combo but preserves totals", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk" });
    s = reduceScoreEvent(s, { type: "dunk" });
    s = reduceScoreEvent(s, { type: "dunk" });
    s = reduceScoreEvent(s, { type: "acceptContinue" });
    assert.equal(s.chainLength, 0);
    assert.equal(s.score, DUNK_BASE_POINTS * (1 + 2 + 3));
    assert.equal(comboLabel(3), "x3");
  });

  it("declineContinue leaves counters unchanged", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk" });
    const declined = reduceScoreEvent(s, { type: "declineContinue" });
    assert.deepEqual(declined, s);
  });

  it("streak table: four dunks → ON FIRE scoring", () => {
    let s = createScoreState();
    const expected = [
      DUNK_BASE_POINTS,
      DUNK_BASE_POINTS * 2,
      DUNK_BASE_POINTS * 3,
      DUNK_BASE_POINTS * 4,
    ];
    let total = 0;
    for (let i = 0; i < 4; i++) {
      s = reduceScoreEvent(s, { type: "dunk" });
      total += expected[i]!;
      assert.equal(s.chainLength, i + 1);
      assert.equal(s.score, total);
    }
    assert.equal(comboLabel(s.chainLength), "ON FIRE");
  });
});

describe("buildRunSummary", () => {
  it("maps score state into shared RunSummary", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk" });
    const summary = buildRunSummary({
      mode: "daily",
      scoreState: s,
      continuesUsed: 1,
      seed: "daily-2026-07-26",
      powerupsUsed: ["wideHoop"],
    });
    assert.equal(summary.mode, "daily");
    assert.equal(summary.chainLength, 1);
    assert.equal(summary.score, DUNK_BASE_POINTS);
    assert.equal(summary.stars, 0);
    assert.equal(summary.continuesUsed, 1);
    assert.deepEqual(summary.powerupsUsed, ["wideHoop"]);
    assert.equal(summary.seed, "daily-2026-07-26");
  });
});
