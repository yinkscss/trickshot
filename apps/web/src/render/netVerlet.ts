/**
 * Verlet rope net — port of docs/challenges-pitch.html (makeNet / netStep / draw*).
 * Cosmetic only: never feeds physics or scoring.
 *
 * Camera looks slightly UP at each rim (ball launched from below).
 * Near cords = top ellipse arc (sin(a) < 0); far = bottom (sin(a) > 0).
 */
import { BALL_RADIUS, FIXED_DT, RIM_RX, RIM_RY, hypot } from "../physics";

const RX = RIM_RX;
const RY = RIM_RY;
const BR = BALL_RADIUS;

export const NET_COLS = 14;
export const NET_ROWS = 8;
export const NET_DEPTH = 54;
export const NET_SHAPE = 1500;
export const NET_GRAV = 340;
export const NET_DAMP = 0.9;

export interface NetPoint {
  x: number;
  y: number;
  px: number;
  py: number;
  rx: number;
  ry: number;
  a: number;
  pin: boolean;
}

export interface NetLink {
  a: NetPoint;
  b: NetPoint;
  len: number;
  k: number;
}

export interface VerletNet {
  grid: NetPoint[][];
  links: NetLink[];
  acc: number;
}

/**
 * Camera looks slightly UP at rims. Near (occludes ball) = top arc where sin(a) < 0.
 * Far (drawn first, shaded) = bottom arc where sin(a) > 0.
 */
export function isNearCord(a: number): boolean {
  return Math.sin(a) < 0;
}

function netRest(i: number, j: number): { a: number; x: number; y: number } {
  const a = (i / NET_COLS) * Math.PI * 2;
  const v = j / NET_ROWS;
  const taper = 1 - 0.62 * Math.pow(v, 0.88);
  const depth = NET_DEPTH * Math.pow(v, 1.05);
  return {
    a,
    x: Math.cos(a) * RX * taper,
    y: Math.sin(a) * RY * taper + depth,
  };
}

export function makeNet(): VerletNet {
  const grid: NetPoint[][] = [];
  for (let i = 0; i < NET_COLS; i++) {
    const col: NetPoint[] = [];
    for (let j = 0; j <= NET_ROWS; j++) {
      const r = netRest(i, j);
      col.push({
        x: r.x,
        y: r.y,
        px: r.x,
        py: r.y,
        rx: r.x,
        ry: r.y,
        a: r.a,
        pin: j === 0,
      });
    }
    grid.push(col);
  }
  const links: NetLink[] = [];
  const link = (A: NetPoint, B: NetPoint, k: number) => {
    links.push({
      a: A,
      b: B,
      len: hypot(B.rx - A.rx, B.ry - A.ry),
      k,
    });
  };
  for (let i = 0; i < NET_COLS; i++) {
    const i2 = (i + 1) % NET_COLS;
    for (let j = 0; j < NET_ROWS; j++) link(grid[i][j], grid[i][j + 1], 1);
    for (let j = 1; j <= NET_ROWS; j++) link(grid[i][j], grid[i2][j], 0.85);
    for (let j = 0; j < NET_ROWS; j++) {
      link(grid[i][j], grid[i2][j + 1], 0.3);
    }
  }
  return { grid, links, acc: 0 };
}

export function kickNet(net: VerletNet, power: number): void {
  for (let i = 0; i < NET_COLS; i++) {
    for (let j = 1; j <= NET_ROWS; j++) {
      const p = net.grid[i][j];
      const v = j / NET_ROWS;
      p.y += power * v * 1.4;
      p.x += (Math.random() - 0.5) * power * v;
    }
  }
}

export function netStep(
  net: VerletNet,
  dt: number,
  ballLocal: { x: number; y: number } | null,
): void {
  for (let i = 0; i < NET_COLS; i++) {
    for (let j = 1; j <= NET_ROWS; j++) {
      const p = net.grid[i][j];
      const vx = (p.x - p.px) * NET_DAMP;
      const vy = (p.y - p.py) * NET_DAMP;
      const ax = (p.rx - p.x) * NET_SHAPE;
      const ay = (p.ry - p.y) * NET_SHAPE + NET_GRAV;
      p.px = p.x;
      p.py = p.y;
      p.x += vx + ax * dt * dt;
      p.y += vy + ay * dt * dt;
    }
  }

  if (ballLocal) {
    const R = BR * 1.04;
    for (let i = 0; i < NET_COLS; i++) {
      for (let j = 1; j <= NET_ROWS; j++) {
        const p = net.grid[i][j];
        const dx = p.x - ballLocal.x;
        const dy = p.y - ballLocal.y;
        const d = hypot(dx, dy);
        if (d < R && d > 0.0001) {
          p.x = ballLocal.x + (dx / d) * R;
          p.y = ballLocal.y + (dy / d) * R;
        }
      }
    }
  }

  for (let it = 0; it < 3; it++) {
    for (const L of net.links) {
      const A = L.a;
      const B = L.b;
      const dx = B.x - A.x;
      const dy = B.y - A.y;
      const d = hypot(dx, dy) || 1;
      const k = ((d - L.len) / d) * 0.5 * L.k;
      const ox = dx * k;
      const oy = dy * k;
      if (!A.pin) {
        A.x += ox;
        A.y += oy;
      }
      if (!B.pin) {
        B.x -= ox;
        B.y -= oy;
      }
    }
  }
}

type Pose2 = { x: number; y: number; ang: number };

/** Fixed-timestep driver with ball-proximity gating (pitch `stepNetFor`). */
export function stepNetFor(
  net: VerletNet,
  hoop: Pose2,
  ball: { x: number; y: number },
  dtReal: number,
  hoopLocalFn: (h: Pose2, x: number, y: number) => { x: number; y: number },
): void {
  net.acc = Math.min(net.acc + dtReal, 0.08);
  const L = hoopLocalFn(hoop, ball.x, ball.y);
  const near =
    Math.abs(L.x) < RX + BR * 2 &&
    L.y > -BR * 2 &&
    L.y < NET_DEPTH + BR * 2;
  while (net.acc >= FIXED_DT) {
    net.acc -= FIXED_DT;
    netStep(net, FIXED_DT, near ? L : null);
  }
}

function netHalfPath(
  net: VerletNet,
  back: boolean,
  j0: number,
  j1: number,
): Path2D {
  const p = new Path2D();
  const step = (Math.PI * 2) / NET_COLS;
  for (let i = 0; i < NET_COLS; i++) {
    const i2 = (i + 1) % NET_COLS;
    const midA = net.grid[i][0].a + step / 2;
    // back=true → far cords (!isNearCord); back=false → near cords
    if (isNearCord(midA) === back) continue;
    for (let j = j0; j < j1; j++) {
      const A = net.grid[i][j];
      const B = net.grid[i2][j + 1];
      const C = net.grid[i2][j];
      const D = net.grid[i][j + 1];
      p.moveTo(A.x, A.y);
      p.lineTo(B.x, B.y);
      p.moveTo(C.x, C.y);
      p.lineTo(D.x, D.y);
    }
    for (let j = Math.max(1, j0); j <= j1; j++) {
      const A = net.grid[i][j];
      const C = net.grid[i2][j];
      p.moveTo(A.x, A.y);
      p.lineTo(C.x, C.y);
    }
  }
  return p;
}

export function drawNetHalf(
  ctx: CanvasRenderingContext2D,
  net: VerletNet,
  back: boolean,
): void {
  const split = Math.round(NET_ROWS * 0.55);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const band of [
    [0, split, 1],
    [split, NET_ROWS, 0.78],
  ] as const) {
    const path = netHalfPath(net, back, band[0], band[1]);
    ctx.strokeStyle = back
      ? "rgba(78,84,99,0.13)"
      : "rgba(52,57,70,0.40)";
    ctx.lineWidth = (back ? 2.3 : 3.3) * band[2];
    ctx.stroke(path);
    ctx.strokeStyle = back
      ? "rgba(208,214,228,0.58)"
      : "rgba(255,255,255,0.99)";
    ctx.lineWidth = (back ? 1.15 : 1.95) * band[2];
    ctx.stroke(path);
  }
}

/**
 * Looking UP at the rim underside (not down into an opening).
 * Shade bias toward the far (+y) side; lighten the near lip.
 */
export function drawMouthShade(ctx: CanvasRenderingContext2D): void {
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(0, 0, RX - 2, RY - 1, 0, 0, Math.PI * 2);
  ctx.clip();
  const g = ctx.createLinearGradient(0, -RY, 0, RY);
  g.addColorStop(0, "rgba(38,42,52,0.02)");
  g.addColorStop(1, "rgba(38,42,52,0.17)");
  ctx.fillStyle = g;
  ctx.fillRect(-RX, -RY, RX * 2, RY * 2);
  ctx.restore();
}

export function drawNetHem(
  ctx: CanvasRenderingContext2D,
  net: VerletNet,
): void {
  ctx.beginPath();
  for (let i = 0; i <= NET_COLS; i++) {
    const p = net.grid[i % NET_COLS][NET_ROWS];
    if (i === 0) ctx.moveTo(p.x, p.y);
    else ctx.lineTo(p.x, p.y);
  }
  ctx.closePath();
  ctx.strokeStyle = "rgba(58,63,76,0.35)";
  ctx.lineWidth = 3.4;
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.97)";
  ctx.lineWidth = 2.0;
  ctx.stroke();
}

export function drawNetLoops(
  ctx: CanvasRenderingContext2D,
  net: VerletNet,
): void {
  ctx.lineWidth = 1.7;
  ctx.lineCap = "round";
  for (let i = 0; i < NET_COLS; i++) {
    const p = net.grid[i][0];
    const front = isNearCord(p.a);
    ctx.strokeStyle = front ? "#fff" : "rgba(255,255,255,0.5)";
    ctx.beginPath();
    ctx.arc(
      p.x,
      p.y - (front ? 0.5 : -0.5),
      2.1,
      front ? 0 : Math.PI,
      front ? Math.PI : Math.PI * 2,
    );
    ctx.stroke();
  }
}
