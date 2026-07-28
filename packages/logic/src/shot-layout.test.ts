import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRng, dailySeedFromUtcDate } from "./rng.js";
import {
  ENDLESS_OBSTACLE_UNLOCK_ORDER,
  buildObstacles,
  generateShotLayout,
  layoutForSide,
  nextSide,
  shotRng,
  unlockedObstacleTypes,
  stepHoopOsc,
  type HoopOsc,
  type Side,
} from "./shot-layout.js";

const W = 390;
const H = 780;
const TEST_SEED = "alpha-test-seed";

describe("createRng", () => {
  it("is deterministic for the same seed", () => {
    const a = createRng("daily-2026-07-26");
    const b = createRng("daily-2026-07-26");
    const seqA = Array.from({ length: 5 }, () => a.next());
    const seqB = Array.from({ length: 5 }, () => b.next());
    assert.deepEqual(seqA, seqB);
  });

  it("shuffle is stable for the same seed", () => {
    const a = createRng(42).shuffle(["a", "b", "c", "d"]);
    const b = createRng(42).shuffle(["a", "b", "c", "d"]);
    assert.deepEqual(a, b);
    assert.notDeepEqual(a, ["a", "b", "c", "d"]);
  });
});

describe("daily seed stability", () => {
  it("UTC date string is stable for a fixed instant", () => {
    const d = new Date("2026-07-26T15:30:00.000Z");
    assert.equal(dailySeedFromUtcDate(d), "2026-07-26");
  });

  it("same daily seed + score sequence yields identical layouts", () => {
    const seed = dailySeedFromUtcDate(new Date("2026-07-26T00:00:00.000Z"));
    let side: Side = 1;
    const layoutsA = [];
    const layoutsB = [];

    for (let score = 0; score < 10; score++) {
      const input = {
        side,
        score,
        seed,
        mode: "daily" as const,
        width: W,
        height: H,
      };
      layoutsA.push(generateShotLayout(input));
      layoutsB.push(generateShotLayout(input));
      side = nextSide(side);
    }

    assert.deepEqual(layoutsA, layoutsB);
  });
});

describe("tutorial clean lane", () => {
  it("score 0 has no obstacles", () => {
    const layout = generateShotLayout({
      side: 1,
      score: 0,
      seed: TEST_SEED,
      mode: "casual",
      width: W,
      height: H,
    });
    assert.equal(layout.obstacles.length, 0);
  });
});

describe("obstacle count invariant", () => {
  it("post-tutorial shots always have exactly one obstacle", () => {
    for (let score = 1; score <= 20; score++) {
      const side = (score % 2 === 0 ? -1 : 1) as Side;
      const layout = generateShotLayout({
        side,
        score,
        seed: TEST_SEED,
        mode: "casual",
        width: W,
        height: H,
      });
      assert.equal(
        layout.obstacles.length,
        1,
        `score ${score}: expected exactly one obstacle`,
      );
    }
  });

  it("fuzz: 1000 generations never yield more than one obstacle", () => {
    for (let i = 0; i < 1000; i++) {
      const layout = generateShotLayout({
        side: i % 2 === 0 ? 1 : -1,
        score: (i % 25) + 1,
        seed: `fuzz-${i}`,
        mode: i % 3 === 0 ? "daily" : "casual",
        width: W,
        height: H,
      });
      assert.ok(layout.obstacles.length <= 1);
    }
  });

  it("unlocks kit types by score and randomizes among them", () => {
    assert.deepEqual(unlockedObstacleTypes(0), []);
    assert.deepEqual(unlockedObstacleTypes(1), ["wall", "bumper"]);
    assert.deepEqual(unlockedObstacleTypes(2), ["wall", "bumper", "gate"]);
    assert.equal(unlockedObstacleTypes(11).length, 12);
    assert.deepEqual(
      unlockedObstacleTypes(20),
      [...ENDLESS_OBSTACLE_UNLOCK_ORDER],
    );

    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const [o] = generateShotLayout({
        side: 1,
        score: 11,
        seed: `mix-${i}`,
        mode: "casual",
        width: W,
        height: H,
      }).obstacles;
      assert.ok(o);
      seen.add(o.type);
      assert.ok(
        (ENDLESS_OBSTACLE_UNLOCK_ORDER as readonly string[]).includes(o.type),
      );
    }
    assert.ok(
      seen.size >= 8,
      `expected broad type mix at score 11, got ${[...seen].join(",")}`,
    );
  });
});

describe("zigzag side alternation", () => {
  it("20 dunks alternate source side left/right and climb upward", () => {
    let side: Side = 1;
    const sides: Side[] = [];

    for (let dunk = 0; dunk < 20; dunk++) {
      const score = dunk === 0 ? 0 : dunk;
      sides.push(side);
      const L = layoutForSide(side, score, W, H);
      const sourceOnLeft = L.source.x < L.goal.x;
      assert.equal(sourceOnLeft, side === 1);
      assert.ok(L.source.y > L.goal.y, "source must sit below goal (climb)");
      side = nextSide(side);
    }

    for (let i = 1; i < sides.length; i++) {
      assert.equal(sides[i], nextSide(sides[i - 1]!));
    }
  });
});

describe("buildObstacles escalation", () => {
  it("hard scores (≥4) produce taller walls when RNG selects wall", () => {
    // next() < 1/n picks index 0 (wall) from the unlocked list
    const forceWall = {
      next: () => 0.01,
      range: (min: number) => min,
      shuffle: <T>(items: readonly T[]) => [...items],
    };

    const hard = buildObstacles(
      W * 0.22,
      H * 0.68,
      W * 0.78,
      H * 0.29,
      5,
      W,
      forceWall,
      H,
    );
    assert.equal(hard.length, 1);
    assert.equal(hard[0]!.type, "wall");
    assert.equal((hard[0] as { h: number }).h, 150);

    const soft = buildObstacles(
      W * 0.22,
      H * 0.68,
      W * 0.78,
      H * 0.29,
      1,
      W,
      forceWall,
      H,
    );
    assert.equal(soft[0]!.type, "wall");
    assert.equal((soft[0] as { h: number }).h, 130);
  });

  it("shotRng differs per score while daily seed stays stable", () => {
    const daily = dailySeedFromUtcDate(new Date("2026-07-26T00:00:00.000Z"));
    const a = shotRng(daily, 1, 1, "daily").next();
    const b = shotRng(daily, 2, 1, "daily").next();
    assert.notEqual(a, b);
  });
});

describe("moving rim (DunkShot-style goal osc)", () => {
  it("attaches goal.osc from dunk-count tier 2+ (score ≥ 5)", () => {
    const early = generateShotLayout({
      side: 1,
      score: 4,
      seed: TEST_SEED,
      mode: "casual",
      width: W,
      height: H,
    });
    assert.equal(early.goal.osc, undefined);

    const moving = generateShotLayout({
      side: 1,
      score: 5,
      seed: TEST_SEED,
      mode: "casual",
      width: W,
      height: H,
    });
    assert.ok(moving.goal.osc);
    assert.ok(moving.goal.osc!.amp > 0);
    assert.ok(moving.goal.osc!.spd > 0);
    assert.ok(
      moving.goal.osc!.axis === "x" || moving.goal.osc!.axis === "y",
    );
  });

  it("horizontal swing keeps the rim inside the court at max tier", () => {
    for (let i = 0; i < 200; i++) {
      const layout = generateShotLayout({
        side: i % 2 === 0 ? 1 : -1,
        score: 60 + i,
        seed: `swing-${i}`,
        mode: "casual",
        width: W,
        height: H,
      });
      const osc = layout.goal.osc;
      if (!osc || osc.axis !== "x") continue;
      assert.ok(osc.originX - osc.amp >= 0, "rim swings past left edge");
      assert.ok(osc.originX + osc.amp <= W, "rim swings past right edge");
    }
  });

  it("challenges mode never attaches goal osc", () => {
    const layout = generateShotLayout({
      side: 1,
      score: 40,
      seed: TEST_SEED,
      mode: "challenges",
      width: W,
      height: H,
    });
    assert.equal(layout.goal.osc, undefined);
  });

  it("stepHoopOsc advances position with sin motion and freezes when cleared", () => {
    const hoop: { x: number; y: number; osc?: HoopOsc } = {
      x: 100,
      y: 200,
      osc: {
        axis: "x",
        amp: 20,
        spd: 2,
        phase: 0,
        originX: 100,
        originY: 200,
      },
    };
    stepHoopOsc(hoop, Math.PI / 4);
    assert.notEqual(hoop.x, 100);
    assert.equal(hoop.y, 200);

    hoop.osc = undefined;
    const frozenX = hoop.x;
    stepHoopOsc(hoop, 1);
    assert.equal(hoop.x, frozenX);
  });

  it("same seed yields same osc axis/phase", () => {
    const a = generateShotLayout({
      side: 1,
      score: 10,
      seed: "rim-seed",
      mode: "daily",
      width: W,
      height: H,
    });
    const b = generateShotLayout({
      side: 1,
      score: 10,
      seed: "rim-seed",
      mode: "daily",
      width: W,
      height: H,
    });
    assert.deepEqual(a.goal.osc, b.goal.osc);
  });
});
