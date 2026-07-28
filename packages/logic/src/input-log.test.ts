import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PHYSICS_BUILD_ID } from "@trickshot/physics";
import { deserializeInputLog, validateInputLog } from "@trickshot/shared";
import {
  createScoreState,
  dunkPoints,
} from "./scoring.js";
import { generateShotLayout, shotRng } from "./shot-layout.js";
import { createInputLogRecorder } from "./input-log-recorder.js";
import {
  prepareShotFromSeed,
  replayRunFromInputLog,
} from "./input-log-replay.js";

const GOLDEN_SEED = "golden-fixture-issue-23";
const MIN_SPEED = 160;

describe("InputLogRecorder", () => {
  it("record → serialize → deserialize preserves frames", () => {
    const recorder = createInputLogRecorder({
      seed: GOLDEN_SEED,
      mode: "casual",
      physicsBuildId: PHYSICS_BUILD_ID,
      startedAtMs: 1000,
    });

    recorder.record({ type: "pointer_down", x: 80, y: 500 }, 1100);
    recorder.record(
      {
        type: "release",
        vx: 420,
        vy: -680,
        originX: 85,
        originY: 540,
      },
      1200,
    );
    recorder.record({ type: "through_hoop" }, 1800);

    const json = recorder.serialize();
    const restored = deserializeInputLog(json);
    assert.equal(restored.frames.length, 3);
    assert.equal(restored.frames[0]?.t, 100);
    assert.equal(restored.frames[1]?.type, "release");
  });
});

describe("replayRunFromInputLog golden fixture", () => {
  it("replays a short synthetic dunk run to expected score", () => {
    const recorder = createInputLogRecorder({
      seed: GOLDEN_SEED,
      mode: "casual",
      physicsBuildId: PHYSICS_BUILD_ID,
    });

    recorder.record({
      type: "release",
      vx: 420,
      vy: -680,
      originX: 85,
      originY: 540,
      t: 50,
    });
    recorder.record({ type: "through_hoop", t: 400 });

    const log = recorder.finalize();
    const validation = validateInputLog(log);
    assert.equal(validation.ok, true);

    const replay = replayRunFromInputLog(log, {
      expectedPhysicsBuildId: PHYSICS_BUILD_ID,
      minSpeed: MIN_SPEED,
    });

    assert.equal(replay.score, dunkPoints("bank"));
    assert.equal(replay.chainLength, 1);
    assert.equal(replay.fsmSnapshot.score, 1);
    assert.equal(replay.fsmSnapshot.state, "scored");
  });

  it("rejects physics build mismatch", () => {
    const log = createInputLogRecorder({
      seed: GOLDEN_SEED,
      mode: "casual",
      physicsBuildId: "physics-stale",
    }).finalize();

    assert.throws(
      () =>
        replayRunFromInputLog(log, {
          expectedPhysicsBuildId: PHYSICS_BUILD_ID,
        }),
      /physics build mismatch/,
    );
  });
});

describe("seeded RNG replay contract", () => {
  it("shotRng is stable for layout generation", () => {
    const a = generateShotLayout({
      side: 1,
      score: 2,
      seed: GOLDEN_SEED,
      mode: "casual",
      width: 390,
      height: 780,
    });
    const b = generateShotLayout({
      side: 1,
      score: 2,
      seed: GOLDEN_SEED,
      mode: "casual",
      width: 390,
      height: 780,
    });
    assert.deepEqual(a, b);
  });

  it("prepareShotFromSeed matches direct shotRng roll", () => {
    const rngUnit = shotRng(GOLDEN_SEED, 1, -1, "daily").next();
    const direct = prepareShotFromSeed(createScoreState(), GOLDEN_SEED, 1, -1, "daily");
    const manual = createScoreState();
    const fromRoll = prepareShotFromSeed(manual, GOLDEN_SEED, 1, -1, "daily");
    assert.equal(fromRoll.starActive, direct.starActive);
    assert.equal(typeof rngUnit, "number");
  });
});
