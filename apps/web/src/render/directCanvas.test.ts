import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COURT_H, COURT_W } from "@trickshot/physics";
import { clientToCourt } from "./directCanvas.js";

function mockCanvas(width: number, height: number, left = 0, top = 0): HTMLCanvasElement {
  return {
    getBoundingClientRect: () => ({
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height,
      x: left,
      y: top,
      toJSON: () => ({}),
    }),
  } as HTMLCanvasElement;
}

describe("clientToCourt letterbox", () => {
  it("maps 1:1 when view equals logical court", () => {
    const canvas = mockCanvas(COURT_W, COURT_H);
    const mid = clientToCourt(canvas, COURT_W / 2, COURT_H / 2);
    assert.equal(mid.x, COURT_W / 2);
    assert.equal(mid.y, COURT_H / 2);

    const corner = clientToCourt(canvas, COURT_W, COURT_H);
    assert.equal(corner.x, COURT_W);
    assert.equal(corner.y, COURT_H);
  });

  it("subtracts side letterbox on a wider view", () => {
    // 780×780 view → scale=1, offX=195, offY=0
    const viewW = 780;
    const viewH = 780;
    const scale = Math.min(viewW / COURT_W, viewH / COURT_H);
    const offX = (viewW - COURT_W * scale) / 2;
    assert.equal(scale, 1);
    assert.equal(offX, 195);

    const canvas = mockCanvas(viewW, viewH);
    const left = clientToCourt(canvas, offX, 0);
    assert.equal(left.x, 0);
    assert.equal(left.y, 0);

    const right = clientToCourt(canvas, offX + COURT_W, COURT_H);
    assert.equal(right.x, COURT_W);
    assert.equal(right.y, COURT_H);

    const center = clientToCourt(canvas, viewW / 2, viewH / 2);
    assert.equal(center.x, COURT_W / 2);
    assert.equal(center.y, COURT_H / 2);
  });

  it("clamps pointers in the letterbox bars to court edges", () => {
    const viewW = 780;
    const viewH = 780;
    const canvas = mockCanvas(viewW, viewH);

    const leftBar = clientToCourt(canvas, 10, 100);
    assert.equal(leftBar.x, 0);
    assert.ok(leftBar.y >= 0 && leftBar.y <= COURT_H);

    const rightBar = clientToCourt(canvas, viewW - 5, COURT_H / 2);
    assert.equal(rightBar.x, COURT_W);

    const above = clientToCourt(canvas, viewW / 2, -20);
    assert.equal(above.y, 0);

    const below = clientToCourt(canvas, viewW / 2, viewH + 40);
    assert.equal(below.y, COURT_H);
  });

  it("divides by scale when the view is smaller than the court", () => {
    // Half-size portrait: 195×390 → scale=0.5, no offset
    const viewW = COURT_W / 2;
    const viewH = COURT_H / 2;
    const canvas = mockCanvas(viewW, viewH);

    const mid = clientToCourt(canvas, viewW / 2, viewH / 2);
    assert.equal(mid.x, COURT_W / 2);
    assert.equal(mid.y, COURT_H / 2);

    const br = clientToCourt(canvas, viewW, viewH);
    assert.equal(br.x, COURT_W);
    assert.equal(br.y, COURT_H);
  });
});
