import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  classifyDunk,
  comboLabel,
  createScoreState,
  dunkPoints,
  dunkQualityLabel,
  DUNK_BASE_POINTS,
  reduceScoreEvent,
  shouldSpawnStar,
  STAR_GUARANTEE_BELOW_SCORE,
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

describe("classifyDunk", () => {
  it("swish when clean (no wall, no rim)", () => {
    assert.equal(
      classifyDunk({ wallBounced: false, rimTouched: false }),
      "swish",
    );
  });

  it("bank when wall bounced", () => {
    assert.equal(
      classifyDunk({ wallBounced: true, rimTouched: false }),
      "bank",
    );
    assert.equal(
      classifyDunk({ wallBounced: true, rimTouched: true }),
      "bank",
    );
  });

  it("rim when rim only (no wall)", () => {
    assert.equal(
      classifyDunk({ wallBounced: false, rimTouched: true }),
      "rim",
    );
  });
});

describe("dunkPoints", () => {
  it("swish awards ×2 base; bank/rim award +1", () => {
    assert.equal(dunkPoints("swish"), DUNK_BASE_POINTS * 2);
    assert.equal(dunkPoints("bank"), DUNK_BASE_POINTS);
    assert.equal(dunkPoints("rim"), DUNK_BASE_POINTS);
    assert.equal(DUNK_BASE_POINTS, 1);
  });
});

describe("dunkQualityLabel", () => {
  it("maps qualities to popup tags", () => {
    assert.equal(dunkQualityLabel("swish"), "SWISH");
    assert.equal(dunkQualityLabel("bank"), "BANK");
    assert.equal(dunkQualityLabel("rim"), "RIM");
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

  it("dunk increments chain; points follow quality not chain", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk", quality: "swish" });
    assert.equal(s.chainLength, 1);
    assert.equal(s.score, 2);

    s = reduceScoreEvent(s, { type: "dunk", quality: "bank" });
    assert.equal(s.chainLength, 2);
    assert.equal(s.score, 3);
    assert.equal(comboLabel(s.chainLength), "x2");

    s = reduceScoreEvent(s, { type: "dunk", quality: "rim" });
    assert.equal(s.chainLength, 3);
    assert.equal(s.score, 4);
  });

  it("auto-collects star on dunk when starActive (no score bump)", () => {
    let s = reduceScoreEvent(createScoreState(), {
      type: "prepareShot",
      fromScore: 0,
      rngUnit: 0,
    });
    s = reduceScoreEvent(s, { type: "dunk", quality: "swish" });
    assert.equal(s.stars, 1);
    assert.equal(s.score, 2);
    assert.equal(s.starActive, false);
  });

  it("collectStar adds soft currency only once", () => {
    let s = reduceScoreEvent(createScoreState(), {
      type: "prepareShot",
      fromScore: 1,
      rngUnit: 0,
    });
    s = reduceScoreEvent(s, { type: "collectStar" });
    assert.equal(s.stars, 1);
    assert.equal(s.score, 0);
    assert.equal(s.starActive, false);

    const again = reduceScoreEvent(s, { type: "collectStar" });
    assert.deepEqual(again, s);
  });

  it("miss resets combo but keeps score and stars", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk", quality: "swish" });
    s = reduceScoreEvent(s, { type: "dunk", quality: "bank" });
    s = reduceScoreEvent(s, { type: "miss" });
    assert.equal(s.chainLength, 0);
    assert.equal(s.score, 3);
    assert.equal(s.stars, 0);
  });

  it("acceptContinue resets combo but preserves totals", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk", quality: "swish" });
    s = reduceScoreEvent(s, { type: "dunk", quality: "swish" });
    s = reduceScoreEvent(s, { type: "dunk", quality: "bank" });
    s = reduceScoreEvent(s, { type: "acceptContinue" });
    assert.equal(s.chainLength, 0);
    assert.equal(s.score, 5);
  });

  it("declineContinue leaves counters unchanged", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk", quality: "swish" });
    const declined = reduceScoreEvent(s, { type: "declineContinue" });
    assert.deepEqual(declined, s);
  });

  it("streak juice still reaches ON FIRE without multiplying points", () => {
    let s = createScoreState();
    for (let i = 0; i < 4; i++) {
      s = reduceScoreEvent(s, { type: "dunk", quality: "bank" });
    }
    assert.equal(s.chainLength, 4);
    assert.equal(s.score, 4);
    assert.equal(comboLabel(s.chainLength), "ON FIRE");
  });
});

describe("buildRunSummary", () => {
  it("maps score state into shared RunSummary", () => {
    let s = createScoreState();
    s = reduceScoreEvent(s, { type: "dunk", quality: "swish" });
    const summary = buildRunSummary({
      mode: "daily",
      scoreState: s,
      continuesUsed: 1,
      seed: "daily-2026-07-26",
      powerupsUsed: ["wideHoop"],
    });
    assert.equal(summary.mode, "daily");
    assert.equal(summary.chainLength, 1);
    assert.equal(summary.score, 2);
    assert.equal(summary.stars, 0);
    assert.equal(summary.continuesUsed, 1);
    assert.deepEqual(summary.powerupsUsed, ["wideHoop"]);
    assert.equal(summary.seed, "daily-2026-07-26");
  });
});
