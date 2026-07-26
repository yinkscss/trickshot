import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createRng, dailySeedFromUtcDate } from "./rng.js";
import {
  buildObstacles,
  generateShotLayout,
  layoutForSide,
  nextSide,
  shotRng,
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

  it("Alpha types are only wall peg or bumper disc", () => {
    for (let score = 1; score <= 12; score++) {
      const [o] = generateShotLayout({
        side: 1,
        score,
        seed: TEST_SEED,
        mode: "casual",
        width: W,
        height: H,
      }).obstacles;
      assert.ok(o.type === "wall" || o.type === "bumper");
    }
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
    const forceWall = {
      next: () => 0.1,
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
    );
    assert.equal(hard.length, 1);
    assert.equal(hard[0]!.type, "wall");
    assert.equal((hard[0] as { h: number }).h, 100);

    const soft = buildObstacles(
      W * 0.22,
      H * 0.68,
      W * 0.78,
      H * 0.29,
      2,
      W,
      forceWall,
    );
    assert.equal((soft[0] as { h: number }).h, 90);
  });

  it("shotRng differs per score while daily seed stays stable", () => {
    const daily = dailySeedFromUtcDate(new Date("2026-07-26T00:00:00.000Z"));
    const a = shotRng(daily, 1, 1, "daily").next();
    const b = shotRng(daily, 2, 1, "daily").next();
    assert.notEqual(a, b);
  });
});
