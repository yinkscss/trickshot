import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { predictPath } from "./aim.js";
import {
  FLIGHT_EPSILON,
  PREVIEW_DT,
  SUBSTEP_EPSILON,
  WALL_REST,
} from "./constants.js";
import {
  cloneProjectile,
  stepProjectile,
  stepProjectileSubsteps,
} from "./integrate.js";
import type { Projectile, Vec2 } from "./types.js";
import { applyWallBounce, collideScreenEdges, edgePad } from "./walls.js";

const W = 390;
const H = 780;

/** Scripted golden shots that must bank L and/or R before leaving the window. */
const GOLDEN_BANKS = {
  leftOnce: {
    origin: { x: edgePad() + 24, y: 420 },
    vx: -920,
    vy: -780,
    expectSides: ["left"] as const,
  },
  rightOnce: {
    origin: { x: W - edgePad() - 24, y: 420 },
    vx: 920,
    vy: -780,
    expectSides: ["right"] as const,
  },
  leftThenRight: {
    origin: { x: W * 0.5, y: H * 0.62 },
    vx: -1050,
    vy: -1180,
    expectSides: ["left", "right"] as const,
  },
} as const;

function countWallHits(
  p: Projectile,
  worldWidth: number,
  steps: number,
  dt = PREVIEW_DT,
): { left: number; right: number } {
  const counts = { left: 0, right: 0 };
  for (let i = 0; i < steps; i++) {
    stepProjectile(p, dt, worldWidth, undefined, (side) => {
      counts[side]++;
    });
    if (p.y > H + 40 || p.y < -60) break;
  }
  return counts;
}

function replayPreviewDots(
  origin: Vec2,
  vx: number,
  vy: number,
  worldWidth: number,
  worldHeight: number,
) {
  const dots = predictPath(origin, vx, vy, worldWidth, worldHeight);
  const flight = cloneProjectile({ x: origin.x, y: origin.y, vx, vy });
  let drawn = 0;
  for (let i = 0; i < 90; i++) {
    const bounced = stepProjectile(flight, PREVIEW_DT, worldWidth);
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
    if (flight.y > worldHeight + 40 || flight.y < -60 || drawn > 28) break;
  }
  assert.equal(drawn, dots.length);
  return dots;
}

describe("wall bank golden scenarios", () => {
  for (const [name, shot] of Object.entries(GOLDEN_BANKS)) {
    it(`${name}: banks expected sides with WALL_REST`, () => {
      const p = cloneProjectile({
        x: shot.origin.x,
        y: shot.origin.y,
        vx: shot.vx,
        vy: shot.vy,
      });
      const hits = countWallHits(p, W, 90);
      for (const side of shot.expectSides) {
        assert.ok(hits[side] >= 1, `expected at least one ${side} bank`);
      }
      const dots = replayPreviewDots(
        shot.origin,
        shot.vx,
        shot.vy,
        W,
        H,
      );
      assert.ok(
        dots.some((d) => d.bounced),
        "preview should highlight at least one bank dot",
      );
    });
  }

  it("left wall reflects vx by -WALL_REST", () => {
    const pad = edgePad();
    const p = { x: pad - 1, y: 200, vx: -500, vy: 0 };
    applyWallBounce(p, W);
    assert.equal(p.x, pad);
    assert.ok(Math.abs(p.vx - 500 * WALL_REST) < FLIGHT_EPSILON);
  });

  it("right wall reflects vx by -WALL_REST", () => {
    const pad = edgePad();
    const p = { x: W - pad + 1, y: 200, vx: 500, vy: 0 };
    applyWallBounce(p, W);
    assert.equal(p.x, W - pad);
    assert.ok(Math.abs(p.vx - -500 * WALL_REST) < FLIGHT_EPSILON);
  });
});

describe("preview ≡ flight parity", () => {
  it("predictPath matches fixed-step flight for left-bank golden shot", () => {
    const shot = GOLDEN_BANKS.leftOnce;
    const dots = replayPreviewDots(shot.origin, shot.vx, shot.vy, W, H);
    assert.ok(dots.some((d) => d.bounced));
  });

  it("predictPath matches fixed-step flight for right-bank golden shot", () => {
    const shot = GOLDEN_BANKS.rightOnce;
    const dots = replayPreviewDots(shot.origin, shot.vx, shot.vy, W, H);
    assert.ok(dots.some((d) => d.bounced));
  });

  it("substep flight matches fixed-step integrator through L+R banks", () => {
    const shot = GOLDEN_BANKS.leftThenRight;
    const fixed = cloneProjectile({
      x: shot.origin.x,
      y: shot.origin.y,
      vx: shot.vx,
      vy: shot.vy,
    });
    const sub = cloneProjectile(fixed);
    const frameDt = 1 / 60;
    let subTime = 0;

    for (let i = 0; i < 90; i++) {
      stepProjectile(fixed, PREVIEW_DT, W);
      const target = (i + 1) * PREVIEW_DT;
      while (subTime < target - 1e-12) {
        const dt = Math.min(frameDt, target - subTime);
        stepProjectileSubsteps(sub, dt, W);
        subTime += dt;
      }
      assert.ok(
        Math.abs(fixed.x - sub.x) < SUBSTEP_EPSILON &&
          Math.abs(fixed.y - sub.y) < SUBSTEP_EPSILON &&
          Math.abs(fixed.vx - sub.vx) < SUBSTEP_EPSILON &&
          Math.abs(fixed.vy - sub.vy) < SUBSTEP_EPSILON,
        `substep flight diverged at integrator step ${i}`,
      );
      if (fixed.y > H + 40 || fixed.y < -60) break;
    }
  });

  it("collideScreenEdges invokes onHit only when callback provided", () => {
    const pad = edgePad();
    const p = { x: pad - 2, y: 100, vx: -200, vy: 0 };
    let fxCount = 0;
    collideScreenEdges(p, W, () => {
      fxCount++;
    });
    assert.equal(fxCount, 1);

    const previewBall = { x: pad - 2, y: 100, vx: -200, vy: 0 };
    applyWallBounce(previewBall, W);
    assert.equal(fxCount, 1, "preview path must not call FX hook");
  });

  it("predictPath uses stepProjectile without FX hook", () => {
    const shot = GOLDEN_BANKS.leftOnce;
    let fxCount = 0;
    const p = cloneProjectile({
      x: shot.origin.x,
      y: shot.origin.y,
      vx: shot.vx,
      vy: shot.vy,
    });
    for (let i = 0; i < 40; i++) {
      stepProjectile(p, PREVIEW_DT, W, undefined, () => {
        fxCount++;
      });
    }
    const before = fxCount;
    predictPath(shot.origin, shot.vx, shot.vy, W, H);
    assert.equal(fxCount, before, "predictPath must not invoke wall FX");
    assert.ok(before >= 1, "stepped flight with hook should have banked");
  });
});
