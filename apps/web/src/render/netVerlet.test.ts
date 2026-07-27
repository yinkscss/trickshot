import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isNearCord,
  makeNet,
  netStep,
  NET_COLS,
  NET_ROWS,
} from "./netVerlet.js";

describe("isNearCord (camera looks UP)", () => {
  it("treats bottom arc (sin >= 0) as near — player-facing lip", () => {
    assert.equal(isNearCord(Math.PI / 2), true);
    assert.equal(isNearCord(0), true);
  });

  it("treats top arc (sin < 0) as far", () => {
    assert.equal(isNearCord(-Math.PI / 2), false);
    assert.equal(isNearCord((3 * Math.PI) / 2), false);
  });
});

describe("makeNet / netStep", () => {
  it("builds pinned rim row and free depth rows", () => {
    const net = makeNet();
    assert.equal(net.grid.length, NET_COLS);
    assert.equal(net.grid[0].length, NET_ROWS + 1);
    assert.equal(net.grid[0][0].pin, true);
    assert.equal(net.grid[0][1].pin, false);
    assert.ok(net.links.length > 0);
  });

  it("keeps pinned nodes fixed across a step", () => {
    const net = makeNet();
    const pin = net.grid[0][0];
    const x0 = pin.x;
    const y0 = pin.y;
    netStep(net, 1 / 120, null);
    assert.equal(pin.x, x0);
    assert.equal(pin.y, y0);
  });
});
