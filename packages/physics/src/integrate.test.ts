import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { aimFrom, predictPath } from "./aim.js";
import { FIXED_DT, G, PREVIEW_DT, FLIGHT_EPSILON, WALL_REST } from "./constants.js";
import {
  cloneProjectile,
  stepProjectile,
  stepProjectileSubsteps,
} from "./integrate.js";
import { applyWallBounce, edgePad } from "./walls.js";

describe("applyWallBounce", () => {
  it("reflects left wall with WALL_REST", () => {
    const pad = edgePad();
    const p = { x: pad - 2, y: 100, vx: -200, vy: 10 };
    const hit = applyWallBounce(p, 390);
    assert.equal(hit, true);
    assert.equal(p.x, pad);
    assert.ok(Math.abs(p.vx - 200 * WALL_REST) < FLIGHT_EPSILON);
  });

  it("reflects right wall with WALL_REST", () => {
    const W = 390;
    const pad = edgePad();
    const p = { x: W - pad + 2, y: 100, vx: 200, vy: 10 };
    const hit = applyWallBounce(p, W);
    assert.equal(hit, true);
    assert.equal(p.x, W - pad);
    assert.ok(Math.abs(p.vx - -200 * WALL_REST) < FLIGHT_EPSILON);
  });
});

describe("stepProjectile", () => {
  it("applies gravity each step (free fall)", () => {
    const p = { x: 100, y: 100, vx: 0, vy: 0 };
    const dt = 1 / 60;
    stepProjectile(p, dt, 390);
    assert.ok(Math.abs(p.vy - G * dt) < 1e-9);
    assert.ok(Math.abs(p.y - (100 + G * dt * dt)) < 1e-6);
  });
});

describe("stepProjectileSubsteps", () => {
  it("matches repeated fixed steps for the same frame duration", () => {
    const W = 390;
    const frameDt = 1 / 60;
    const a = { x: 86, y: 545, vx: -900, vy: -1100 };
    const b = cloneProjectile(a);
    stepProjectileSubsteps(a, frameDt, W);
    for (let i = 0; i < Math.round(frameDt / FIXED_DT); i++) {
      stepProjectile(b, FIXED_DT, W);
    }
    assert.ok(Math.abs(a.x - b.x) < FLIGHT_EPSILON);
    assert.ok(Math.abs(a.y - b.y) < FLIGHT_EPSILON);
    assert.ok(Math.abs(a.vx - b.vx) < FLIGHT_EPSILON);
    assert.ok(Math.abs(a.vy - b.vy) < FLIGHT_EPSILON);
  });
});

describe("preview / flight determinism", () => {
  it("predictPath uses wall banks (bounced dots appear)", () => {
    const W = 390;
    const H = 780;
    const origin = { x: W * 0.22, y: H * 0.7 };
    const dots = predictPath(origin, -900, -1100, W, H);
    assert.ok(dots.length > 5);
    assert.ok(
      dots.some((d) => d.bounced),
      "expected a bank highlight in preview",
    );
  });

  it("predictPath positions match stepped flight at each sample", () => {
    const W = 390;
    const H = 780;
    const origin = { x: W * 0.22, y: H * 0.7 };
    const vx = -900;
    const vy = -1100;
    const dots = predictPath(origin, vx, vy, W, H);

    const flight = { x: origin.x, y: origin.y, vx, vy };
    let drawn = 0;
    for (let i = 0; i < 90; i++) {
      const bounced = stepProjectile(flight, PREVIEW_DT, W);
      if (i % 3 !== 0 && !bounced) continue;
      const dot = dots[drawn];
      if (!dot) break;
      assert.ok(
        Math.abs(dot.x - flight.x) < FLIGHT_EPSILON &&
          Math.abs(dot.y - flight.y) < FLIGHT_EPSILON,
        `preview dot ${drawn} diverged at step ${i}`,
      );
      assert.equal(dot.bounced, bounced);
      drawn++;
      if (flight.y > H + 40 || flight.y < -60 || drawn > 28) break;
    }
    assert.equal(drawn, dots.length);
  });

  it("identical clones stay in lockstep through the integrator", () => {
    const W = 390;
    const a = { x: 86, y: 545, vx: -900, vy: -1100 };
    const b = cloneProjectile(a);
    for (let i = 0; i < 60; i++) {
      stepProjectile(a, PREVIEW_DT, W);
      stepProjectile(b, PREVIEW_DT, W);
      assert.equal(a.x, b.x);
      assert.equal(a.y, b.y);
      assert.equal(a.vx, b.vx);
      assert.equal(a.vy, b.vy);
    }
  });

  it("same pull vector → identical aim + landing within epsilon", () => {
    const W = 390;
    const H = 780;
    const origin = { x: 86, y: 545 };
    const finger = { x: 120, y: 680 };
    const aim1 = aimFrom(origin, finger, W, H);
    const aim2 = aimFrom(origin, finger, W, H);
    assert.deepEqual(aim1, aim2);

    const a = { x: origin.x, y: origin.y, vx: aim1.x, vy: aim1.y };
    const b = { x: origin.x, y: origin.y, vx: aim2.x, vy: aim2.y };
    const dt = 1 / 60;
    for (let i = 0; i < 120; i++) {
      stepProjectile(a, dt, W);
      stepProjectile(b, dt, W);
    }
    assert.ok(Math.abs(a.x - b.x) < FLIGHT_EPSILON);
    assert.ok(Math.abs(a.y - b.y) < FLIGHT_EPSILON);
  });
});
