import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aimFrom, launchFromPull } from "./aim.js";
import { MIN_SHOT } from "./constants.js";
import { hoopLocal, rimHit, throughHoop } from "./hoop.js";
import { hypot } from "./math.js";
import type { Hoop, Projectile } from "./types.js";

const W = 390;
const H = 780;

function hoop(x: number, y: number, ang = 0): Hoop {
  return { x, y, ang, wobble: 0 };
}

describe("launchFromPull", () => {
  const origin = { x: W * 0.22, y: H * 0.7 };

  it("returns null for tiny tap (aim deadzone)", () => {
    const finger = { x: origin.x + 0.5, y: origin.y + 0.5 };
    assert.equal(launchFromPull(origin, finger, W, H), null);
  });

  it("returns null when pull speed is below MIN_SHOT", () => {
    const finger = { x: origin.x + 8, y: origin.y + 6 };
    const aim = aimFrom(origin, finger, W, H);
    assert.ok(hypot(aim.x, aim.y) < MIN_SHOT);
    assert.equal(launchFromPull(origin, finger, W, H), null);
  });

  it("matches aimFrom for a known-good dunk pull", () => {
    const finger = { x: 120, y: 680 };
    const aim = aimFrom(origin, finger, W, H);
    const launch = launchFromPull(origin, finger, W, H);
    assert.ok(launch !== null);
    assert.ok(hypot(launch.vx, launch.vy) >= MIN_SHOT);
    assert.equal(launch.vx, aim.x);
    assert.equal(launch.vy, aim.y);
    assert.equal(launch.pull, aim.pull);
  });
});

describe("hoopLocal", () => {
  it("maps world origin to hoop center in local space", () => {
    const h = hoop(200, 300, Math.PI / 6);
    const L = hoopLocal(h, h.x, h.y);
    assert.ok(Math.abs(L.x) < 1e-9);
    assert.ok(Math.abs(L.y) < 1e-9);
  });

  it("rotates offset by negative hoop angle", () => {
    const h = hoop(100, 200, 0);
    const L = hoopLocal(h, 110, 200);
    assert.ok(Math.abs(L.x - 10) < 1e-9);
    assert.ok(Math.abs(L.y) < 1e-9);
  });
});

describe("throughHoop", () => {
  const target = hoop(W * 0.78, H * 0.28);

  it("scores center swish with upward speed", () => {
    const ball: Projectile = {
      x: target.x,
      y: target.y - 5,
      vx: 0,
      vy: -400,
    };
    assert.equal(throughHoop(target, ball), true);
  });

  it("rejects ball outside rim ellipse", () => {
    const ball: Projectile = {
      x: target.x + 80,
      y: target.y,
      vx: 0,
      vy: -400,
    };
    assert.equal(throughHoop(target, ball), false);
  });

  it("rejects slow ball even when centered", () => {
    const ball: Projectile = {
      x: target.x,
      y: target.y - 5,
      vx: 0,
      vy: -30,
    };
    assert.equal(throughHoop(target, ball), false);
  });

  it("rejects ball arriving from far above hoop", () => {
    const ball: Projectile = {
      x: target.x,
      y: target.y - 80,
      vx: 0,
      vy: -400,
    };
    assert.equal(throughHoop(target, ball), false);
  });
});

describe("rimHit", () => {
  it("bounces ball off rim edge and wobbles hoop", () => {
    const h = hoop(200, 300);
    const ball: Projectile = {
      x: 200 + 40,
      y: 300,
      vx: -300,
      vy: -100,
    };
    const vx0 = ball.vx;
    const vy0 = ball.vy;
    rimHit(h, ball);
    assert.equal(h.wobble, 1);
    assert.ok(ball.vx !== vx0 || ball.vy !== vy0);
  });

  it("ignores ball far from rim band", () => {
    const h = hoop(200, 300);
    const ball: Projectile = {
      x: 200,
      y: 200,
      vx: -300,
      vy: -100,
    };
    const snap = { ...ball };
    rimHit(h, ball);
    assert.deepEqual(ball, snap);
    assert.equal(h.wobble, 0);
  });

  it("ignores ball moving away from rim (vn >= 0)", () => {
    const h = hoop(200, 300);
    const ball: Projectile = {
      x: 200 + 40,
      y: 300,
      vx: 400,
      vy: 0,
    };
    const snap = { ...ball };
    rimHit(h, ball);
    assert.deepEqual(ball, snap);
  });
});
