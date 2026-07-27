import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collideObstacles,
  MAX_LIVE_OBSTACLES,
  segmentBounce,
  updateObstacles,
} from "./obstacles.js";
import type {
  BumperObstacle,
  Obstacle,
  Projectile,
  SpinnerObstacle,
  WallObstacle,
} from "./types.js";

describe("collideObstacles invariant", () => {
  it("allows up to MAX_LIVE_OBSTACLES (challenges layouts)", () => {
    assert.equal(MAX_LIVE_OBSTACLES, 4);
    const walls: WallObstacle[] = [
      { type: "wall", x: 100, y: 300, h: 40, w: 7 },
      { type: "wall", x: 160, y: 300, h: 40, w: 7 },
      { type: "wall", x: 220, y: 300, h: 40, w: 7 },
      { type: "wall", x: 280, y: 300, h: 40, w: 7 },
    ];
    const ball: Projectile = { x: 50, y: 300, vx: 0, vy: 0 };
    collideObstacles(walls, ball, 1 / 60);
    assert.equal(ball.x, 50);
  });

  it("throws when more than MAX_LIVE_OBSTACLES are passed", () => {
    const walls: WallObstacle[] = Array.from({ length: 5 }, (_, i) => ({
      type: "wall" as const,
      x: 100 + i * 40,
      y: 300,
      h: 40,
      w: 7,
    }));
    const ball: Projectile = { x: 50, y: 300, vx: 0, vy: 0 };
    assert.throws(
      () => collideObstacles(walls, ball, 1 / 60),
      /expected at most 4 obstacles/,
    );
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
    const hit = segmentBounce(
      ball,
      [200, 255, 200, 345],
      null,
      3.5 + 7.5,
      1 / 60,
    );
    assert.ok(hit, "expected contact");
    assert.ok(ball.x > 202, "ball pushed off the peg");
    assert.ok(ball.vx > -400, "incoming leftward velocity damped/reflected");
    assert.ok(ball.vx > 0, "velocity should point away from peg");
  });

  it("does not bounce when approaching from the free side", () => {
    const ball: Projectile = { x: 215, y: 300, vx: 200, vy: 0 };
    const before = { ...ball };
    const hit = segmentBounce(
      ball,
      [200, 255, 200, 345],
      null,
      3.5 + 7.5,
      1 / 60,
    );
    assert.equal(hit, null);
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

  it("decays pulse over time via updateObstacles", () => {
    const bumper: BumperObstacle = {
      type: "bumper",
      x: 200,
      y: 300,
      r: 22,
      pulse: 1,
    };
    updateObstacles(0.1, [bumper], 0.1);
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

describe("multi-obstacle + kinematic", () => {
  it("collides two wall pegs without throwing", () => {
    const obs: Obstacle[] = [
      { type: "wall", x: 180, y: 300, h: 80, w: 7 },
      { type: "wall", x: 220, y: 300, h: 80, w: 7 },
    ];
    const ball: Projectile = { x: 182, y: 300, vx: -300, vy: 0 };
    collideObstacles(obs, ball, 1 / 60);
    assert.ok(ball.vx > -300);
  });

  it("spinner publishes a moving segment from worldT", () => {
    const spinner: SpinnerObstacle = {
      type: "spinner",
      x: 200,
      y: 300,
      len: 40,
      spd: 2,
      ang: 0,
      thick: 9,
      segs: [],
      prev: null,
    };
    updateObstacles(0, [spinner], 1 / 60);
    assert.equal(spinner.segs?.length, 1);
    const ang0 = spinner.ang;
    updateObstacles(1 / 60, [spinner], 1 / 60);
    assert.ok(spinner.ang > ang0, "spinner angle advances with dt");
    assert.ok(spinner.prev?.length === 1, "prev segs retained for bounce");
  });
});
