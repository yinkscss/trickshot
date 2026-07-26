import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeHoop } from "./layout";
import {
  beginDunkTransition,
  finishDunkTransition,
  updateDunkTransition,
} from "./transition";

const W = 390;
const H = 780;

describe("seamless dunk transition", () => {
  it("carries ball with the hoop — no hard teleport of ball pose", () => {
    const source = makeHoop(W * 0.22, H * 0.68, -0.13);
    const target = makeHoop(W * 0.78, H * 0.29, -0.38);
    const { transition } = beginDunkTransition({
      side: 1,
      score: 3,
      width: W,
      height: H,
      source,
      target,
      obstacles: [{ type: "wall", x: 195, y: 380, h: 90, w: 7 }],
    });

    const ball = { x: target.x, y: target.y - 1, vx: 0, vy: 0 };
    const samples: number[] = [];
    for (let i = 0; i < 20; i++) {
      const done = updateDunkTransition(transition, ball, 0.03);
      samples.push(ball.y);
      assert.equal(ball.vx, 0);
      assert.equal(ball.vy, 0);
      if (done) break;
    }

    // Continuous downward carry — each sample moves smoothly (no giant jump)
    for (let i = 1; i < samples.length; i++) {
      const dy = samples[i]! - samples[i - 1]!;
      assert.ok(dy >= -2, "ball should not teleport upward during carry");
      assert.ok(dy < 80, "carry step should stay continuous");
    }
  });

  it("swaps in next zigzag layout + exactly one new obstacle", () => {
    const source = makeHoop(W * 0.22, H * 0.68, -0.13);
    const target = makeHoop(W * 0.78, H * 0.29, -0.38);
    const { side, transition } = beginDunkTransition({
      side: 1,
      score: 4,
      width: W,
      height: H,
      source,
      target,
      obstacles: [{ type: "bumper", x: 195, y: 380, r: 22, pulse: 0 }],
    });

    assert.equal(side, -1);
    assert.equal(transition.nextObstacles.length, 1);
    assert.equal(transition.oldObstacles.length, 1);

    // Drive to completion
    const ball = { x: target.x, y: target.y - 1, vx: 0, vy: 0 };
    while (!updateDunkTransition(transition, ball, 0.05)) {
      /* advance */
    }
    const next = finishDunkTransition(transition);
    assert.equal(next.obstacles.length, 1);
    assert.ok(next.source.x > next.target.x, "side flip: source on right");
    assert.ok(next.source.y > next.target.y, "source still below goal");
    assert.equal(next.ball.x, next.source.x);
    assert.equal(next.ball.y, next.source.y - 1);
  });
});
