import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collideObstacles,
  MAX_LIVE_OBSTACLES,
  segmentBounce,
} from "./obstacles.js";
import type { BumperObstacle, Obstacle, Projectile, WallObstacle } from "./types.js";

describe("collideObstacles invariant", () => {
  it("throws when more than one obstacle is passed", () => {
    const wall: WallObstacle = { type: "wall", x: 200, y: 300, h: 90, w: 7 };
    const bumper: BumperObstacle = {
      type: "bumper",
      x: 220,
      y: 300,
      r: 22,
      pulse: 0,
    };
    const ball: Projectile = { x: 202, y: 300, vx: -400, vy: 0 };

    assert.throws(
      () => collideObstacles([wall, bumper], ball, 1 / 60),
      /expected at most 1 obstacle/,
    );
    assert.equal(MAX_LIVE_OBSTACLES, 1);
  });

  it("allows empty list (tutorial / score < 1)", () => {
    const ball: Projectile = { x: 100, y: 200, vx: 50, vy: -30 };
    collideObstacles([], ball, 1 / 60);
    assert.equal(ball.x, 100);
    assert.equal(ball.y, 200);
  });
});

describe("wall peg segmentBounce", () => {
  it("reflects inward velocity off vertical peg", () => {
    const ball: Projectile = { x: 202, y: 300, vx: -400, vy: 0 };
    segmentBounce(ball, 200, 255, 200, 345, 3.5 + 7.5);
    assert.ok(ball.x > 202, "ball pushed off the peg");
    assert.ok(ball.vx > -400, "incoming leftward velocity damped/reflected");
    assert.ok(ball.vx > 0, "velocity should point away from peg");
  });

  it("does not bounce when approaching from the free side", () => {
    const ball: Projectile = { x: 215, y: 300, vx: 200, vy: 0 };
    const before = { ...ball };
    segmentBounce(ball, 200, 255, 200, 345, 3.5 + 7.5);
    assert.equal(ball.x, before.x);
    assert.equal(ball.vx, before.vx);
  });
});

describe("bumper disc collideObstacles", () => {
  it("boosts outward on contact", () => {
    const bumper: Obstacle = {
      type: "bumper",
      x: 200,
      y: 300,
      r: 22,
      pulse: 0,
    };
    const ball: Projectile = { x: 205, y: 300, vx: -200, vy: 0 };
    collideObstacles([bumper], ball, 1 / 60);
    assert.ok(ball.vx > 0, "incoming leftward velocity should bounce out");
    assert.ok(bumper.pulse > 0);
  });

  it("decays pulse over time", () => {
    const bumper: BumperObstacle = {
      type: "bumper",
      x: 200,
      y: 300,
      r: 22,
      pulse: 1,
    };
    const ball: Projectile = { x: 300, y: 300, vx: 0, vy: 0 };
    collideObstacles([bumper], ball, 0.1);
    assert.ok(bumper.pulse < 1);
    assert.ok(bumper.pulse >= 0);
  });
});

describe("collideObstacles wall peg", () => {
  it("reflects via segment bounce", () => {
    const wall: Obstacle = { type: "wall", x: 200, y: 300, h: 90, w: 7 };
    const ball: Projectile = { x: 202, y: 300, vx: -400, vy: 0 };
    collideObstacles([wall], ball, 1 / 60);
    assert.ok(ball.x > 202, "ball pushed off the peg");
    assert.ok(ball.vx > -400, "incoming velocity damped/reflected");
  });
});

describe("tunneling guard", () => {
  it("wall peg resolves overlap after large dt integrator step", () => {
    const wall: Obstacle = { type: "wall", x: 200, y: 300, h: 90, w: 7 };
    const ball: Projectile = { x: 198, y: 300, vx: -600, vy: 0 };
    const rad = wall.w / 2 + 7.5;
    collideObstacles([wall], ball, 1 / 30);
    const dx = ball.x - wall.x;
    assert.ok(Math.abs(dx) >= rad - 0.01, "ball should sit outside peg radius");
  });

  it("bumper resolves overlap after large dt step", () => {
    const bumper: Obstacle = {
      type: "bumper",
      x: 200,
      y: 300,
      r: 22,
      pulse: 0,
    };
    const ball: Projectile = { x: 198, y: 300, vx: -500, vy: 0 };
    const min = bumper.r + 7.5;
    collideObstacles([bumper], ball, 1 / 30);
    const d = Math.hypot(ball.x - bumper.x, ball.y - bumper.y);
    assert.ok(d >= min - 0.01, "ball should sit outside bumper radius");
  });
});
