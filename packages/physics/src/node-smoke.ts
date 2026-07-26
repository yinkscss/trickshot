/**
 * Node entry for hybrid replay (#8): import from `@trickshot/physics/node`
 * or run `npm run smoke -w @trickshot/physics`.
 */
import { aimFrom, predictPath } from "./aim.js";
import { FIXED_DT } from "./constants.js";
import { cloneProjectile, stepProjectile } from "./integrate.js";

const W = 390;
const H = 780;
const origin = { x: W * 0.22, y: H * 0.7 };
const aim = aimFrom(origin, { x: 120, y: 680 }, W, H);
const flight = cloneProjectile({
  x: origin.x,
  y: origin.y,
  vx: aim.x,
  vy: aim.y,
});
const dots = predictPath(origin, aim.x, aim.y, W, H);

for (let i = 0; i < 30; i++) {
  stepProjectile(flight, FIXED_DT, W);
}

console.log(
  JSON.stringify({
    ok: true,
    fixedDt: FIXED_DT,
    aim,
    flight: { x: flight.x, y: flight.y, vx: flight.vx, vy: flight.vy },
    previewDots: dots.length,
  }),
);
