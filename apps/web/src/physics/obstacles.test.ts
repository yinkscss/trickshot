import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collideObstacles, type Obstacle } from "@trickshot/physics";

describe("web physics re-export", () => {
  it("collideObstacles is available from @trickshot/physics", () => {
    const wall: Obstacle = { type: "wall", x: 200, y: 300, h: 90, w: 7 };
    const ball = { x: 202, y: 300, vx: -400, vy: 0 };
    collideObstacles([wall], ball, 1 / 60);
    assert.ok(ball.vx > -400);
  });
});
