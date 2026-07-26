import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { layoutForSide } from "../game/layout";
import {
  buildObstacles,
  collideObstacles,
  type Obstacle,
} from "./obstacles";

const W = 390;
const H = 780;

function setupForScore(score: number, side = 1): Obstacle[] {
  const L = layoutForSide(side, score, W, H);
  return buildObstacles(L.sx, L.sy, L.tx, L.ty, score, W);
}

describe("obstacle count invariant", () => {
  it("tutorial shot (score 0) has a clean lane", () => {
    assert.equal(setupForScore(0).length, 0);
  });

  it("every post-tutorial shot has exactly one obstacle", () => {
    for (let score = 1; score <= 20; score++) {
      const side = score % 2 === 0 ? -1 : 1;
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
    const L = layoutForSide(1, 5, W, H);
    const a = buildObstacles(L.sx, L.sy, L.tx, L.ty, 5, W);
    const b = buildObstacles(L.sx, L.sy, L.tx, L.ty, 5, W);
    assert.equal(a.length, 1);
    assert.equal(b.length, 1);
    assert.deepEqual(a, b);
  });
});

describe("zigzag side alternation", () => {
  it("10 dunks alternate source side left/right", () => {
    let side = 1;
    const sides: number[] = [];
    for (let dunk = 0; dunk < 10; dunk++) {
      sides.push(side);
      const L = layoutForSide(side, dunk === 0 ? 0 : dunk, W, H);
      const sourceOnLeft = L.sx < L.tx;
      assert.equal(sourceOnLeft, side === 1);
      assert.ok(L.sy > L.ty, "source must sit below goal (climb)");
      side *= -1;
    }
    for (let i = 1; i < sides.length; i++) {
      assert.equal(sides[i], -sides[i - 1]);
    }
  });
});

describe("collideObstacles", () => {
  it("wall peg reflects via segment bounce", () => {
    const wall: Obstacle = { type: "wall", x: 200, y: 300, h: 90, w: 7 };
    // Offset into the peg so collision resolves (exact center has zero normal)
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
