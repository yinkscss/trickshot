import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateShotLayout, layoutForSide, nextSide, type Side } from "@trickshot/logic";
import { collideObstacles, type Obstacle } from "./obstacles";

const W = 390;
const H = 780;
const TEST_SEED = "web-parity-seed";

function setupForScore(score: number, side: Side = 1): Obstacle[] {
  return generateShotLayout({
    side,
    score,
    seed: TEST_SEED,
    mode: "casual",
    width: W,
    height: H,
  }).obstacles;
}

describe("obstacle count invariant", () => {
  it("tutorial shot (score 0) has a clean lane", () => {
    assert.equal(setupForScore(0).length, 0);
  });

  it("every post-tutorial shot has exactly one obstacle", () => {
    for (let score = 1; score <= 20; score++) {
      const side = (score % 2 === 0 ? -1 : 1) as Side;
      const obstacles = setupForScore(score, side);
      assert.equal(
        obstacles.length,
        1,
        `score ${score}: expected obstacles.length === 1`,
      );
    }
  });

  it("Alpha types are only wall peg or bumper disc", () => {
    for (let score = 1; score <= 12; score++) {
      const [o] = setupForScore(score);
      assert.ok(o.type === "wall" || o.type === "bumper");
    }
  });

  it("never stacks extras even if called repeatedly", () => {
    const input = {
      side: 1 as Side,
      score: 5,
      seed: TEST_SEED,
      mode: "casual" as const,
      width: W,
      height: H,
    };
    const a = generateShotLayout(input).obstacles;
    const b = generateShotLayout(input).obstacles;
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.deepEqual(a, b);
  });
});

describe("zigzag side alternation", () => {
  it("10 dunks alternate source side left/right", () => {
    let side: Side = 1;
    const sides: Side[] = [];
    for (let dunk = 0; dunk < 10; dunk++) {
      sides.push(side);
      const L = layoutForSide(side, dunk === 0 ? 0 : dunk, W, H);
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

describe("collideObstacles", () => {
  it("wall peg reflects via segment bounce", () => {
    const wall: Obstacle = { type: "wall", x: 200, y: 300, h: 90, w: 7 };
    const ball = { x: 202, y: 300, vx: -400, vy: 0 };
    collideObstacles([wall], ball, 1 / 60);
    assert.ok(ball.x > 202, "ball pushed off the peg");
    assert.ok(ball.vx > -400, "incoming velocity damped/reflected");
  });

  it("bumper disc boosts outward", () => {
    const bumper: Obstacle = {
      type: "bumper",
      x: 200,
      y: 300,
      r: 22,
      pulse: 0,
    };
    const ball = { x: 205, y: 300, vx: -200, vy: 0 };
    collideObstacles([bumper], ball, 1 / 60);
    assert.ok(ball.vx > 0, "incoming leftward velocity should bounce out");
    assert.ok(bumper.pulse > 0);
  });
});
