import Phaser from "phaser";
import { RIM_RX, RIM_RY, type Hoop, type NetPull } from "../physics";
import { cssToColor, hoopToWorld } from "./math";
import { drawDragGlow, drawFireAura, drawMarble } from "./ball";

export interface DrawHoopOptions {
  withBall?: boolean;
  ballX?: number;
  ballY?: number;
  pullNet?: boolean;
  pull?: NetPull | null;
  timeMs?: number;
  comboHeat?: number;
  alpha?: number;
}

function strokeEllipseWorld(
  g: Phaser.GameObjects.Graphics,
  h: Hoop,
  tipAng: number,
  rx: number,
  ry: number,
  color: number,
  width: number,
  alpha: number,
): void {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const p = hoopToWorld(h, tipAng, Math.cos(t) * rx, Math.sin(t) * ry);
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  g.closePath();
  g.strokePath();
}

function strokeRimArc(
  g: Phaser.GameObjects.Graphics,
  h: Hoop,
  tipAng: number,
  color: number,
  a0: number,
  a1: number,
  ccw: boolean,
  width: number,
  alpha: number,
): void {
  g.lineStyle(width, color, alpha);
  g.beginPath();
  const steps = 24;
  const span = a1 - a0;
  for (let i = 0; i <= steps; i++) {
    const t = a0 + (span * i) / steps;
    const p = hoopToWorld(h, tipAng, Math.cos(t) * RIM_RX, Math.sin(t) * RIM_RY);
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  g.strokePath();
}

function drawWovenNet(
  g: Phaser.GameObjects.Graphics,
  h: Hoop,
  tipAng: number,
  wob: number,
  pull: NetPull,
  alpha: number,
): void {
  const amt = pull.amt || 0;
  const depth = 52 + wob * 16 + amt * 28;
  const attachY = RIM_RY * 0.35;
  const topW = RIM_RX * 0.92;
  const botW = RIM_RX * (0.28 - amt * 0.06);
  const cols = 8;
  const rows = 5;
  const yankX = (pull.lx || 0) * 0.55;
  const yankY = (pull.ly || 0) * 0.55;

  const pt = (i: number, j: number) => {
    const u = i / (cols - 1);
    const v = j / rows;
    const spread = topW + (botW - topW) * v;
    let x = -spread + u * spread * 2;
    let y = attachY + v * depth + wob * v * 8;
    const belly = Math.sin(u * Math.PI) * (4 + v * 6);
    x *= 1 - v * 0.04;
    y += belly * 0.15;
    const falloff = v * v * amt;
    x += yankX * falloff;
    y += yankY * falloff;
    x *= 1 - falloff * 0.12;
    return hoopToWorld(h, tipAng, x, y);
  };

  g.fillStyle(0xffffff, (0.2 + amt * 0.12) * alpha);
  g.beginPath();
  const p00 = pt(0, 0);
  g.moveTo(p00.x, p00.y);
  for (let i = 1; i < cols; i++) {
    const q = pt(i, 0);
    g.lineTo(q.x, q.y);
  }
  const pbr = pt(cols - 1, rows);
  const pbl = pt(0, rows);
  g.lineTo(pbr.x, pbr.y);
  g.lineTo(pbl.x, pbl.y);
  g.closePath();
  g.fillPath();

  g.lineStyle(2.3, 0xffffff, 0.98 * alpha);
  for (let i = 0; i < cols; i++) {
    g.beginPath();
    const a = pt(i, 0);
    g.moveTo(a.x, a.y);
    for (let j = 1; j <= rows; j++) {
      const q = pt(i, j);
      g.lineTo(q.x, q.y);
    }
    g.strokePath();
  }

  g.lineStyle(2.05, 0xffffff, 0.98 * alpha);
  for (let j = 1; j <= rows; j++) {
    g.beginPath();
    for (let i = 0; i < cols; i++) {
      const q = pt(i, j);
      if (i === 0) g.moveTo(q.x, q.y);
      else g.lineTo(q.x, q.y);
    }
    g.strokePath();
  }

  g.lineStyle(1.7, 0xffffff, 0.9 * alpha);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = pt(i, j);
      const b = pt(i + 1, j + 1);
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
      const c = pt(i + 1, j);
      const d = pt(i, j + 1);
      g.beginPath();
      g.moveTo(c.x, c.y);
      g.lineTo(d.x, d.y);
      g.strokePath();
    }
  }

  g.lineStyle(2.6, 0xffffff, alpha);
  for (let i = 0; i < cols; i++) {
    const p = pt(i, 0);
    g.strokeCircle(p.x, p.y - 1, 2.8);
  }

  const bl = pt(0, rows);
  const br = pt(cols - 1, rows);
  const bm = pt((cols - 1) / 2, rows);
  const ctrlX = (bl.x + br.x) / 2 + (bm.x - (bl.x + br.x) / 2) * 0.5;
  const ctrlY = bm.y + 6 + wob * 8;
  g.lineStyle(2.2, 0xffffff, 0.95 * alpha);
  g.beginPath();
  g.moveTo(bl.x, bl.y);
  for (let i = 1; i <= 10; i++) {
    const t = i / 10;
    const u = 1 - t;
    const x = u * u * bl.x + 2 * u * t * ctrlX + t * t * br.x;
    const y = u * u * bl.y + 2 * u * t * ctrlY + t * t * br.y;
    g.lineTo(x, y);
  }
  g.strokePath();

  if (amt > 0.08) {
    const tip = pt((cols - 1) / 2, rows);
    const n = 5 + ((amt * 6) | 0);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const px = tip.x + yankX * t * 0.85 * amt;
      const py = tip.y + yankY * t * 0.85 * amt;
      const s = (5 + (1 - t) * 10) * (0.55 + amt * 0.6);
      const rot = Math.atan2(yankY, yankX) + Math.PI / 2;
      drawStretchDiamond(g, px, py, rot, s, (1 - t) * 0.75 * amt);
    }
  }
}

function drawStretchDiamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  rot: number,
  s: number,
  alpha: number,
): void {
  const c = Math.cos(rot);
  const sn = Math.sin(rot);
  const local = [
    { x: 0, y: -s * 1.3 },
    { x: s * 0.55, y: 0 },
    { x: 0, y: s * 0.7 },
    { x: -s * 0.55, y: 0 },
  ];
  g.fillStyle(0xffffff, alpha);
  g.beginPath();
  for (let i = 0; i < local.length; i++) {
    const p = local[i];
    const wx = x + p.x * c - p.y * sn;
    const wy = y + p.x * sn + p.y * c;
    if (i === 0) g.moveTo(wx, wy);
    else g.lineTo(wx, wy);
  }
  g.closePath();
  g.fillPath();
}

/** Woven net + split steel rim (pitch `drawHoop`). */
export function drawHoop(
  g: Phaser.GameObjects.Graphics,
  h: Hoop,
  colorCss: string,
  opts: DrawHoopOptions = {},
): void {
  const {
    withBall = false,
    ballX = 0,
    ballY = 0,
    pullNet = false,
    pull: pullIn = null,
    timeMs = 0,
    comboHeat = 0,
    alpha = 1,
  } = opts;

  const color = cssToColor(colorCss);
  const pull = pullIn ?? { lx: 0, ly: 0, amt: 0 };
  const tip = pull.amt * 0.22;
  const tipAng = h.ang + Math.atan2(pull.lx, 40) * tip;
  const wob = h.wobble || 0;

  const shadow = hoopToWorld(
    h,
    tipAng,
    2 + pull.lx * pull.amt * 0.04,
    10 + pull.ly * pull.amt * 0.04,
  );
  g.fillStyle(0x000000, 0.08 * alpha);
  g.fillEllipse(shadow.x, shadow.y, RIM_RX * 1.9, RIM_RY * 2.2);

  strokeRimArc(g, h, tipAng, color, Math.PI, 0, true, 8, alpha);
  drawWovenNet(g, h, tipAng, wob, pull, alpha);

  if (withBall) {
    if (pullNet && pull.amt > 0.05) {
      drawDragGlow(g, ballX, ballY, 15, pull.amt);
    } else {
      drawFireAura(g, ballX, ballY, 15, timeMs, comboHeat, alpha);
    }
    drawMarble(g, ballX, ballY, 15, alpha);
  }

  strokeRimArc(g, h, tipAng, color, 0, Math.PI, false, 8, alpha);

  strokeEllipseWorld(
    g,
    h,
    tipAng,
    RIM_RX - 3.5,
    RIM_RY - 2.2,
    0x000000,
    2,
    0.18 * alpha,
  );

  const specSteps = 16;
  for (let i = 0; i <= specSteps; i++) {
    const t = 0.2 + (Math.PI - 0.4) * (i / specSteps);
    const p = hoopToWorld(
      h,
      tipAng,
      Math.cos(t) * RIM_RX * 0.88,
      Math.sin(t) * RIM_RY * 0.65,
    );
    if (i === 0) g.moveTo(p.x, p.y);
    else g.lineTo(p.x, p.y);
  }
  g.strokePath();
}
