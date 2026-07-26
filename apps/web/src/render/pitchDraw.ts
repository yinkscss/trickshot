/**
 * Canvas2D pitch draw port — nearly verbatim from docs/animation-pitch.html
 * (drawHoop / drawWovenNet / drawMarble / drawFireAura / drawTrail / HUD / …).
 */
import {
  BALL_RADIUS,
  RIM_RX,
  RIM_RY,
  type Obstacle,
  type PredictDot,
} from "../physics";
import { COURT, CYAN, GREY, ORANGE, RED, STAR, STAR_LINE } from "./colors";
import type {
  LaunchRing,
  PitchHoop,
  PitchPull,
  TrailParticle,
  VisualMode,
} from "./types";

const RX = RIM_RX;
const RY = RIM_RY;
const BR = BALL_RADIUS;

export interface PitchDrawState {
  W: number;
  H: number;
  timeMs: number;
  mode: VisualMode;
  score: number;
  stars: number;
  combo: number;
  safeTop: number;
  safeBottom: number;
  ball: { x: number; y: number };
  source: PitchHoop | null;
  target: PitchHoop | null;
  sourcePull: PitchPull | null;
  obstacles: Obstacle[];
  star: { x: number; y: number } | null;
  starOn: boolean;
  drag: boolean;
  dragPt: { x: number; y: number } | null;
  aimOrigin: { x: number; y: number };
  aimPull: number;
  maxPull: number;
  predictDots: PredictDot[];
  trail: TrailParticle[];
  rings: LaunchRing[];
  showHint: boolean;
  comboChip: string | null;
  /** Center-screen combo popup (pitch `drawComboFX`). */
  comboFx: { label: string; sub: string; life: number } | null;
  /** Screen shake magnitude in logical px (decays each frame). */
  shake: number;
  continueLabel: string | null;
  transition: {
    leave: (PitchHoop & { a?: number }) | null;
    arrive: (PitchHoop & { a?: number }) | null;
    arriveTo: { x: number; y: number } | null;
    carry: (PitchHoop & { color?: string }) | null;
    oldObstacles: Obstacle[];
    nextObstacles: Obstacle[];
  } | null;
}

function strokeRimArc(
  ctx: CanvasRenderingContext2D,
  color: string,
  a0: number,
  a1: number,
  ccw: boolean,
  width: number,
): void {
  ctx.beginPath();
  ctx.ellipse(0, 0, RX, RY, 0, a0, a1, ccw);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.stroke();
}

function drawWovenNet(
  ctx: CanvasRenderingContext2D,
  wob: number,
  pull: PitchPull = { lx: 0, ly: 0, amt: 0 },
): void {
  const amt = pull.amt || 0;
  const depth = 52 + wob * 16 + amt * 28;
  const attachY = RY * 0.35;
  const topW = RX * 0.92;
  const botW = RX * (0.28 - amt * 0.06);
  const cols = 8;
  const rows = 5;
  const yankX = (pull.lx || 0) * 0.55;
  const yankY = (pull.ly || 0) * 0.55;

  function pt(i: number, j: number) {
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
    return { x, y };
  }

  ctx.beginPath();
  ctx.moveTo(pt(0, 0).x, pt(0, 0).y);
  for (let i = 1; i < cols; i++) {
    const p = pt(i, 0);
    ctx.lineTo(p.x, p.y);
  }
  ctx.lineTo(pt(cols - 1, rows).x, pt(cols - 1, rows).y);
  ctx.lineTo(pt(0, rows).x, pt(0, rows).y);
  ctx.closePath();
  ctx.fillStyle = `rgba(255,255,255,${0.2 + amt * 0.12})`;
  ctx.fill();

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.strokeStyle = "rgba(255,255,255,0.98)";
  ctx.lineWidth = 2.3;
  for (let i = 0; i < cols; i++) {
    ctx.beginPath();
    const a = pt(i, 0);
    ctx.moveTo(a.x, a.y);
    for (let j = 1; j <= rows; j++) {
      const p = pt(i, j);
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  ctx.lineWidth = 2.05;
  for (let j = 1; j <= rows; j++) {
    ctx.beginPath();
    for (let i = 0; i < cols; i++) {
      const p = pt(i, j);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  ctx.lineWidth = 1.7;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = pt(i, j);
      const b = pt(i + 1, j + 1);
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      const c = pt(i + 1, j);
      const d = pt(i, j + 1);
      ctx.beginPath();
      ctx.moveTo(c.x, c.y);
      ctx.lineTo(d.x, d.y);
      ctx.stroke();
    }
  }

  ctx.lineWidth = 2.6;
  ctx.strokeStyle = "#fff";
  for (let i = 0; i < cols; i++) {
    const p = pt(i, 0);
    ctx.beginPath();
    ctx.arc(p.x, p.y - 1, 2.8, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }

  const bl = pt(0, rows);
  const br = pt(cols - 1, rows);
  const bm = pt((cols - 1) / 2, rows);
  ctx.beginPath();
  ctx.moveTo(bl.x, bl.y);
  ctx.quadraticCurveTo(bm.x, bm.y + 6 + wob * 8, br.x, br.y);
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 2.2;
  ctx.stroke();

  if (amt > 0.08) {
    const tip = pt((cols - 1) / 2, rows);
    const n = 5 + ((amt * 6) | 0);
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const px = tip.x + yankX * t * 0.85 * amt;
      const py = tip.y + yankY * t * 0.85 * amt;
      const s = (5 + (1 - t) * 10) * (0.55 + amt * 0.6);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(Math.atan2(yankY, yankX) + Math.PI / 2);
      ctx.globalAlpha = (1 - t) * 0.75 * amt;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.3);
      ctx.lineTo(s * 0.55, 0);
      ctx.lineTo(0, s * 0.7);
      ctx.lineTo(-s * 0.55, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }
}

export function drawFireAura(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  timeMs: number,
  combo: number,
): void {
  const t = timeMs / 1000;
  const heat = Math.min(1, combo / 5);
  const g = ctx.createRadialGradient(x, y, r * 0.15, x, y, r * (2.4 + heat));
  g.addColorStop(0, `rgba(78,203,255,${0.38 + heat * 0.2})`);
  g.addColorStop(0.4, "rgba(40,120,255,0.14)");
  g.addColorStop(1, "rgba(40,120,255,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, r * (2.4 + heat), 0, Math.PI * 2);
  ctx.fill();

  for (let i = 0; i < 4; i++) {
    const pulse = Math.sin(t * 9 + i * 1.1) * 0.5 + 0.5;
    const yy = y + r * 0.55 + i * 7 + pulse * 2;
    const rx = r * (1.15 + i * 0.32 + pulse * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, yy, rx, 2.8 + i * 0.35, 0, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(78,203,255,${0.58 - i * 0.1})`;
    ctx.lineWidth = 2.2;
    ctx.stroke();
  }
}

export function drawMarble(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
): void {
  const g = ctx.createRadialGradient(
    x - r * 0.35,
    y - r * 0.4,
    r * 0.08,
    x,
    y,
    r,
  );
  g.addColorStop(0, "#d4efff");
  g.addColorStop(0.22, "#6eb6ff");
  g.addColorStop(0.55, "#1e5fff");
  g.addColorStop(0.82, "#1540c0");
  g.addColorStop(1, "#0a2878");
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x - r * 0.2, y, r * 0.9, -0.8, 1.2);
  ctx.stroke();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(
    x - r * 0.3,
    y - r * 0.35,
    r * 0.28,
    r * 0.16,
    -0.6,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fill();
}

function drawHoop(
  ctx: CanvasRenderingContext2D,
  h: PitchHoop,
  color: string,
  opts: {
    withBall?: boolean;
    pullNet?: boolean;
    pull?: PitchPull;
    ballX?: number;
    ballY?: number;
    timeMs?: number;
    combo?: number;
  } = {},
): void {
  const { withBall = false, pullNet = false } = opts;
  const { x, y, ang } = h;
  const wob = h.wobble || 0;
  const pull =
    pullNet && opts.pull ? opts.pull : { lx: 0, ly: 0, amt: 0 };

  const tip = pull.amt * 0.22;
  const tipAng = ang + Math.atan2(pull.lx, 40) * tip;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tipAng);

  ctx.beginPath();
  ctx.ellipse(
    2 + pull.lx * pull.amt * 0.04,
    10 + pull.ly * pull.amt * 0.04,
    RX * 0.95,
    RY * 1.1,
    0,
    0,
    Math.PI * 2,
  );
  ctx.fillStyle = "rgba(0,0,0,0.08)";
  ctx.fill();

  strokeRimArc(ctx, color, Math.PI, 0, true, 8);
  drawWovenNet(ctx, wob, pull);

  if (withBall) {
    ctx.restore();
    const bx = opts.ballX ?? x;
    const by = opts.ballY ?? y;
    if (!(pullNet && pull.amt > 0.05)) {
      drawFireAura(ctx, bx, by, BR, opts.timeMs ?? 0, opts.combo ?? 0);
    } else {
      const g = ctx.createRadialGradient(bx, by, 2, bx, by, BR * 1.6);
      g.addColorStop(0, "rgba(78,203,255,0.18)");
      g.addColorStop(1, "rgba(78,203,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(bx, by, BR * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
    drawMarble(ctx, bx, by, BR);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tipAng);
  }

  strokeRimArc(ctx, color, 0, Math.PI, false, 8);

  ctx.beginPath();
  ctx.ellipse(0, 0, RX - 3.5, RY - 2.2, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, RX * 0.88, RY * 0.65, 0, 0.2, Math.PI - 0.2);
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2.2;
  ctx.stroke();

  ctx.restore();
}

export function drawStarIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  rot = 0,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const a2 = a + Math.PI / 5;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    ctx.lineTo(Math.cos(a2) * r * 0.42, Math.sin(a2) * r * 0.42);
  }
  ctx.closePath();
  ctx.fillStyle = STAR;
  ctx.strokeStyle = STAR_LINE;
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function roundCapBar(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thick: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = thick;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = thick * 0.35;
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: Obstacle[],
  timeMs: number,
): void {
  for (const o of obstacles) {
    if (o.type === "wall") {
      roundCapBar(ctx, o.x, o.y - o.h / 2, o.x, o.y + o.h / 2, o.w, RED);
    } else if (o.type === "bumper") {
      const p = 1 + Math.sin(timeMs / 180) * 0.04 + (o.pulse || 0) * 0.15;
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * p, 0, Math.PI * 2);
      ctx.fillStyle = RED;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.r * 0.45 * p, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(o.x - o.r * 0.25, o.y - o.r * 0.25, o.r * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fill();
    }
  }
}

function drawTrail(
  ctx: CanvasRenderingContext2D,
  trail: TrailParticle[],
  rings: LaunchRing[],
): void {
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const s = 7 + p.life * 14;
    const stretch = 1.35 + (1 - p.life) * 0.8;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.globalAlpha = p.life * 0.85;
    ctx.fillStyle = i % 2 === 0 ? CYAN : "#8adfff";
    ctx.beginPath();
    ctx.moveTo(0, -s * stretch);
    ctx.lineTo(s * 0.62, 0);
    ctx.lineTo(0, s * 0.85);
    ctx.lineTo(-s * 0.62, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  for (const r of rings) {
    ctx.globalAlpha = r.a;
    ctx.strokeStyle = CYAN;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(r.x, r.y, r.rx, r.ry, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawAimPreview(
  ctx: CanvasRenderingContext2D,
  state: PitchDrawState,
): void {
  for (const d of state.predictDots) {
    const r = d.bounced ? 4.2 : 2.4 + 2.0 * d.fade;
    ctx.beginPath();
    ctx.arc(d.x, d.y, r, 0, Math.PI * 2);
    ctx.fillStyle = d.bounced
      ? `rgba(78,203,255,${0.95 * d.fade})`
      : `rgba(255,77,26,${0.95 * d.fade})`;
    ctx.fill();
  }

  if (!state.dragPt) return;
  ctx.beginPath();
  ctx.moveTo(state.aimOrigin.x, state.aimOrigin.y);
  ctx.lineTo(state.dragPt.x, state.dragPt.y);
  ctx.strokeStyle = "rgba(255,77,26,0.35)";
  ctx.lineWidth = 2.5;
  ctx.setLineDash([6, 6]);
  ctx.stroke();
  ctx.setLineDash([]);

  const t = state.maxPull > 0 ? state.aimPull / state.maxPull : 0;
  ctx.beginPath();
  ctx.arc(state.aimOrigin.x, state.aimOrigin.y, 18 + t * 22, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,77,26,${0.25 + t * 0.45})`;
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawHint(ctx: CanvasRenderingContext2D, state: PitchDrawState): void {
  if (!state.showHint || state.mode !== "aim" || state.drag || !state.source) {
    return;
  }
  const x = state.ball.x;
  const y = state.ball.y + 62;
  const bob = Math.sin(state.timeMs / 220) * 6;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.strokeStyle = "#9aa0aa";
  ctx.lineWidth = 3;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(0, -10);
  ctx.lineTo(0, 8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -14, 5, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-6, 14);
  ctx.lineTo(0, 22);
  ctx.lineTo(6, 14);
  ctx.stroke();
  ctx.font = "800 15px Nunito, sans-serif";
  ctx.fillStyle = "#9aa0aa";
  ctx.textAlign = "center";
  ctx.fillText("DRAG IT!", 0, 42);
  ctx.restore();
}

function drawHUD(ctx: CanvasRenderingContext2D, state: PitchDrawState): void {
  const top = 26 + state.safeTop;
  // Pause — bottom-left (keeps top-left clear for mode chip / combo)
  const pauseY = state.H - 36 - Math.max(16, state.safeBottom);
  ctx.fillStyle = "#a4a8b0";
  ctx.fillRect(20, pauseY, 5, 20);
  ctx.fillRect(30, pauseY, 5, 20);

  ctx.font = `900 ${Math.floor(state.W * 0.38)}px Nunito, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(110,114,124,0.16)";
  ctx.fillText(String(state.score), state.W / 2, state.H * 0.22);

  // Single top-right star counter (no duplicate DOM chip beneath)
  ctx.font = "800 22px Nunito, sans-serif";
  ctx.fillStyle = "#555964";
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(String(state.stars), state.W - 48, top + 12);
  drawStarIcon(ctx, state.W - 26, top + 12, 10, 0);

  if (state.comboChip && state.mode !== "continue") {
    ctx.font = "900 14px Nunito, sans-serif";
    ctx.textAlign = "left";
    ctx.fillStyle = ORANGE;
    ctx.fillText(state.comboChip, 20, top + 14);
  }
}

function drawComboFX(
  ctx: CanvasRenderingContext2D,
  state: PitchDrawState,
): void {
  const c = state.comboFx;
  if (!c) return;
  const life = c.life;
  if (life >= 1) return;

  const ease =
    life < 0.2
      ? (life / 0.2) * 1.15
      : life < 0.5
        ? 1.15 - (life - 0.2) * 0.5
        : Math.max(0, 1 - (life - 0.5) / 0.5);

  ctx.save();
  ctx.translate(state.W / 2, state.H * 0.42);
  ctx.scale(ease, ease);
  ctx.globalAlpha = Math.min(1, ease);

  ctx.beginPath();
  ctx.arc(0, 0, 40 + life * 50, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255,77,26,${0.55 * (1 - life)})`;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.font = "900 42px Nunito, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = ORANGE;
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 6;
  ctx.strokeText(c.label, 0, -6);
  ctx.fillText(c.label, 0, -6);

  if (c.sub) {
    ctx.font = "800 16px Nunito, sans-serif";
    ctx.fillStyle = GREY;
    ctx.lineWidth = 0;
    ctx.fillText(c.sub, 0, 24);
  }
  ctx.restore();
}

function drawContinue(
  ctx: CanvasRenderingContext2D,
  state: PitchDrawState,
): void {
  if (!state.continueLabel) return;
  ctx.save();
  ctx.globalAlpha = 0.45;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, state.W, state.H);
  ctx.globalAlpha = 1;
  ctx.font = "800 18px Nunito, sans-serif";
  ctx.fillStyle = GREY;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(state.continueLabel, state.W / 2, state.H * 0.55);
  ctx.restore();
}

function drawCourtRails(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
): void {
  ctx.fillStyle = COURT;
  ctx.fillRect(-30, -30, W + 60, H + 60);

  const rail = ctx.createLinearGradient(0, 0, 14, 0);
  rail.addColorStop(0, "rgba(90,96,110,0.14)");
  rail.addColorStop(1, "rgba(90,96,110,0)");
  ctx.fillStyle = rail;
  ctx.fillRect(0, 0, 14, H);

  const railR = ctx.createLinearGradient(W, 0, W - 14, 0);
  railR.addColorStop(0, "rgba(90,96,110,0.14)");
  railR.addColorStop(1, "rgba(90,96,110,0)");
  ctx.fillStyle = railR;
  ctx.fillRect(W - 14, 0, 14, H);
}

/** Full pitch frame — same draw order as docs/animation-pitch.html `draw()`. */
export function drawPitchFrame(
  ctx: CanvasRenderingContext2D,
  state: PitchDrawState,
): void {
  const { W, H } = state;
  const sx = (Math.random() - 0.5) * state.shake;
  const sy = (Math.random() - 0.5) * state.shake;
  ctx.save();
  ctx.translate(sx, sy);
  drawCourtRails(ctx, W, H);
  drawHUD(ctx, state);

  if (state.mode === "transition" && state.transition) {
    const tr = state.transition;
    if (tr.oldObstacles.length && tr.leave) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, (tr.leave.a ?? 1) * 0.85);
      drawObstacles(ctx, tr.oldObstacles, state.timeMs);
      ctx.restore();
    }
    if (tr.nextObstacles.length && tr.arrive) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, (tr.arrive.a ?? 1) * 0.85);
      drawObstacles(ctx, tr.nextObstacles, state.timeMs);
      ctx.restore();
    }
    if (tr.leave && (tr.leave.a ?? 1) > 0.02) {
      ctx.save();
      ctx.globalAlpha = tr.leave.a ?? 1;
      drawHoop(ctx, tr.leave, GREY);
      ctx.restore();
    }
    if (tr.arrive && (tr.arrive.a ?? 1) > 0.02) {
      ctx.save();
      ctx.globalAlpha = tr.arrive.a ?? 1;
      drawHoop(ctx, tr.arrive, ORANGE);
      ctx.restore();
      if ((tr.arrive.a ?? 0) > 0.55 && tr.arriveTo) {
        drawStarIcon(
          ctx,
          tr.arriveTo.x,
          tr.arriveTo.y - 34,
          12,
          state.timeMs / 800,
        );
      }
    }
    if (tr.carry) {
      drawHoop(ctx, tr.carry, tr.carry.color ?? ORANGE, {
        withBall: true,
        ballX: state.ball.x,
        ballY: state.ball.y,
        timeMs: state.timeMs,
        combo: state.combo,
      });
    }
  } else {
    drawObstacles(ctx, state.obstacles, state.timeMs);

    if (state.starOn && state.star) {
      drawStarIcon(ctx, state.star.x, state.star.y, 12, state.timeMs / 800);
    }

    if (state.source) {
      // No aim-drag net stretch / yank diamonds — only rimHit wobble when the ball
      // banks into the net (light settle). Aim still uses rubber-band + predict dots.
      drawHoop(ctx, state.source, GREY, {
        withBall: state.mode === "aim",
        pullNet: false,
        ballX: state.ball.x,
        ballY: state.ball.y,
        timeMs: state.timeMs,
        combo: state.combo,
      });
    }

    if (state.target) {
      drawHoop(ctx, state.target, ORANGE, {
        withBall: state.mode === "scored",
        ballX: state.ball.x,
        ballY: state.ball.y,
        timeMs: state.timeMs,
        combo: state.combo,
      });
    }
  }

  drawTrail(ctx, state.trail, state.rings);

  if (state.mode === "aim" && state.drag) {
    drawAimPreview(ctx, state);
  }

  if (state.mode === "flying" || state.mode === "continue") {
    drawMarble(ctx, state.ball.x, state.ball.y, BR);
  }

  drawHint(ctx, state);
  drawComboFX(ctx, state);
  drawContinue(ctx, state);
  ctx.restore();
}
