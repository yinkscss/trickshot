/**
 * Canvas2D pitch draw port — animation-pitch.html visuals + challenges-pitch
 * verlet net (drawHoop depth split / drawMarble / drawFireAura / trail / HUD).
 */
import {
  BALL_RADIUS,
  RIM_RX,
  RIM_RY,
  hoopLocal,
  type Obstacle,
  type PredictDot,
  type Seg,
} from "../physics";
import {
  COURT,
  CYAN,
  GLASS,
  GREEN,
  GREY,
  LASER,
  ORANGE,
  RED,
  STAR,
  STAR_LINE,
  VIOLET,
} from "./colors";
import {
  drawMouthShade,
  drawNetHalf,
  drawNetHem,
  drawNetLoops,
  type VerletNet,
} from "./netVerlet";
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
  sourceNet: VerletNet | null;
  targetNet: VerletNet | null;
  sourcePull: PitchPull | null;
  obstacles: Obstacle[];
  star: { x: number; y: number } | null;
  starOn: boolean;
  /** Challenges pickup stars (multi). Endless soft-currency uses `star`/`starOn`. */
  challengeStars?: ReadonlyArray<{ x: number; y: number; on: boolean }>;
  /** Optional tip under the court (challenges level tip / miss prompt). */
  tip?: string | null;
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
    leaveNet: VerletNet | null;
    arriveNet: VerletNet | null;
    carryNet: VerletNet | null;
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
    net?: VerletNet | null;
    ballX?: number;
    ballY?: number;
    timeMs?: number;
    combo?: number;
  } = {},
): void {
  const { withBall = false, net = null } = opts;
  const { x, y, ang } = h;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);

  ctx.beginPath();
  ctx.ellipse(2, 12, RX * 0.95, RY * 1.1, 0, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,0.09)";
  ctx.fill();

  // Far rim = top arc (sin < 0), then far cords — camera looks UP; near lip is bottom.
  strokeRimArc(ctx, color, Math.PI, 0, true, 8);
  drawMouthShade(ctx);
  if (net) drawNetHalf(ctx, net, true);

  if (withBall) {
    const bx = opts.ballX ?? x;
    const by = opts.ballY ?? y;
    const L = hoopLocal({ x, y, ang, wobble: h.wobble ?? 0 }, bx, by);
    drawFireAura(ctx, L.x, L.y, BR, opts.timeMs ?? 0, opts.combo ?? 0);
    drawMarble(ctx, L.x, L.y, BR);
  }

  if (net) {
    drawNetHalf(ctx, net, false);
    drawNetHem(ctx, net);
    drawNetLoops(ctx, net);
  }

  // Near rim = bottom arc (sin >= 0), drawn last so it occludes the ball.
  strokeRimArc(ctx, color, 0, Math.PI, false, 8);

  ctx.beginPath();
  ctx.ellipse(0, 0, RX - 3.5, RY - 2.2, 0, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(0,0,0,0.18)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 0, RX * 0.88, RY * 0.6, 0, 0.2, Math.PI - 0.2);
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

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function roundCapBar(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  thick: number,
  color: string,
  glow?: string,
): void {
  if (glow) {
    ctx.strokeStyle = glow;
    ctx.lineWidth = thick + 8;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
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

function drawDisc(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  pulse: number,
  timeMs: number,
): void {
  const p = 1 + Math.sin(timeMs / 180) * 0.04 + (pulse || 0) * 0.15;
  ctx.beginPath();
  ctx.arc(x, y, r * p, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x, y, r * 0.45 * p, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();
  ctx.beginPath();
  ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.18, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
}

function drawPortalRing(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  color: string,
  spin: number,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(spin);
  ctx.fillStyle =
    color === CYAN ? "rgba(78,203,255,0.16)" : "rgba(255,94,168,0.16)";
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.4;
  ctx.setLineDash([r * 0.7, r * 0.45]);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.6;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function wallSegs(o: Extract<Obstacle, { type: "wall" }>): Seg[] {
  if (o.segs?.length) return o.segs;
  return [[o.x, o.y - o.h / 2, o.x, o.y + o.h / 2]];
}

/** Pitch `drawObstacles` — all 12 kit types. Visual flow uses timeMs (not physics clock). */
function drawObstacles(
  ctx: CanvasRenderingContext2D,
  obstacles: Obstacle[],
  timeMs: number,
): void {
  const perfT = timeMs / 1000;
  for (const o of obstacles) {
    if (o.type === "wall" || o.type === "gate") {
      const thick = o.type === "wall" ? o.w : o.thick;
      const segs = o.type === "wall" ? wallSegs(o) : o.segs ?? [];
      for (const s of segs) {
        roundCapBar(ctx, s[0], s[1], s[2], s[3], thick, RED);
      }
      if (o.type === "gate") {
        const c = Math.cos(o.ang);
        const s = Math.sin(o.ang);
        ctx.strokeStyle = "rgba(229,57,32,0.22)";
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 5]);
        ctx.beginPath();
        ctx.moveTo(o.x - (c * o.gap) / 2, o.y - (s * o.gap) / 2);
        ctx.lineTo(o.x + (c * o.gap) / 2, o.y + (s * o.gap) / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    } else if (o.type === "bumper") {
      drawDisc(ctx, o.x, o.y, o.r, RED, o.pulse, timeMs);
    } else if (o.type === "orbiter") {
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.rad, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(124,77,255,0.22)";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      drawDisc(ctx, o.cx ?? o.x, o.cy ?? o.y, o.r, VIOLET, o.pulse, timeMs);
    } else if (o.type === "spinner") {
      const s = o.segs?.[0];
      if (!s) continue;
      roundCapBar(ctx, s[0], s[1], s[2], s[3], o.thick, VIOLET);
      ctx.beginPath();
      ctx.arc(o.x, o.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#fff";
      ctx.fill();
    } else if (o.type === "pendulum") {
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.len, Math.PI / 2 - o.amp, Math.PI / 2 + o.amp);
      ctx.strokeStyle = "rgba(124,77,255,0.16)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.stroke();
      ctx.setLineDash([]);
      const tipX = o.tipX ?? o.x;
      const tipY = o.tipY ?? o.y + o.len;
      roundCapBar(ctx, o.x, o.y, tipX, tipY, o.thick, VIOLET);
      ctx.beginPath();
      ctx.arc(tipX, tipY, o.thick * 0.95, 0, Math.PI * 2);
      ctx.fillStyle = VIOLET;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(o.x, o.y, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = "#42465a";
      ctx.fill();
    } else if (o.type === "slider") {
      const s = o.segs?.[0];
      ctx.strokeStyle = "rgba(124,77,255,0.16)";
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      if (o.axis === "x") {
        ctx.moveTo(o.x - o.range - o.len / 2, o.y);
        ctx.lineTo(o.x + o.range + o.len / 2, o.y);
      } else {
        ctx.moveTo(o.x, o.y - o.range - o.len / 2);
        ctx.lineTo(o.x, o.y + o.range + o.len / 2);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      if (s) roundCapBar(ctx, s[0], s[1], s[2], s[3], o.thick, VIOLET);
    } else if (o.type === "conveyor") {
      const s = o.segs?.[0];
      if (!s) continue;
      roundCapBar(ctx, s[0], s[1], s[2], s[3], o.thick, GREEN);
      const c = Math.cos(o.ang);
      const sn = Math.sin(o.ang);
      const flow = (perfT * 0.55) % 1;
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      for (let k = 0; k < 4; k++) {
        const u = ((k / 4 + flow) % 1) * 2 - 1;
        const px = o.x + c * u * o.len;
        const py = o.y + sn * u * o.len;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(o.ang);
        ctx.beginPath();
        ctx.moveTo(4, 0);
        ctx.lineTo(-3, -3.4);
        ctx.lineTo(-3, 3.4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    } else if (o.type === "wind") {
      const x0 = o.x - o.w / 2;
      const y0 = o.y - o.hh / 2;
      ctx.fillStyle = "rgba(78,203,255,0.10)";
      ctx.fillRect(x0, y0, o.w, o.hh);
      ctx.strokeStyle = "rgba(78,203,255,0.35)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 5]);
      ctx.strokeRect(x0, y0, o.w, o.hh);
      ctx.setLineDash([]);
      const dir = Math.atan2(o.ay, o.ax);
      const flow = (perfT * 0.42) % 1;
      ctx.strokeStyle = "rgba(78,203,255,0.55)";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          const u = (c / 3 + flow) % 1;
          const px = x0 + (Math.cos(dir) >= 0 ? u : 1 - u) * o.w;
          const py = y0 + ((r + 0.5) / 4) * o.hh;
          ctx.beginPath();
          ctx.moveTo(px - Math.cos(dir) * 7, py - Math.sin(dir) * 7);
          ctx.lineTo(px + Math.cos(dir) * 7, py + Math.sin(dir) * 7);
          ctx.stroke();
        }
      }
    } else if (o.type === "glass") {
      if (!o.broken) {
        const s = o.segs?.[0];
        if (!s) continue;
        ctx.strokeStyle = "rgba(143,203,255,0.55)";
        ctx.lineWidth = o.thick + 6;
        ctx.lineCap = "butt";
        ctx.beginPath();
        ctx.moveTo(s[0], s[1]);
        ctx.lineTo(s[2], s[3]);
        ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(s[0], s[1]);
        ctx.lineTo(s[2], s[3]);
        ctx.stroke();
        const c = Math.cos(o.ang);
        const sn = Math.sin(o.ang);
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.lineWidth = 1.4;
        for (let k = -2; k <= 2; k++) {
          const u = (k / 2.4) * (o.len / 2);
          ctx.beginPath();
          ctx.moveTo(o.x + c * u - sn * 6, o.y + sn * u + c * 6);
          ctx.lineTo(
            o.x + c * (u + 8) + sn * 6,
            o.y + sn * (u + 8) - c * 6,
          );
          ctx.stroke();
        }
      } else if (o.shatter < 1) {
        const c = Math.cos(o.ang);
        const sn = Math.sin(o.ang);
        ctx.globalAlpha = 1 - o.shatter;
        ctx.fillStyle = GLASS;
        for (let k = 0; k < 10; k++) {
          const u = ((k / 9) * 2 - 1) * (o.len / 2);
          const d = o.shatter * (18 + (k % 3) * 10);
          ctx.beginPath();
          ctx.arc(
            o.x + c * u - sn * d * (k % 2 ? 1 : -1),
            o.y + sn * u + c * d * (k % 2 ? 1 : -1),
            3.2,
            0,
            Math.PI * 2,
          );
          ctx.fill();
        }
        ctx.globalAlpha = 1;
      }
    } else if (o.type === "portal") {
      drawPortalRing(ctx, o.x, o.y, o.r, CYAN, o.spin);
      drawPortalRing(ctx, o.ex, o.ey, o.r, "#ff5ea8", -o.spin);
    } else if (o.type === "laser") {
      const s = o.segs?.[0];
      if (!s) continue;
      const cyc = o.on + o.off;
      const phase = (((perfT + o.phase) % cyc) + cyc) % cyc;
      const live = o.live ?? phase < o.on;
      if (live) {
        const warm = clamp01(phase / 0.12);
        roundCapBar(
          ctx,
          s[0],
          s[1],
          s[2],
          s[3],
          o.thick * warm,
          LASER,
          `rgba(255,45,85,${0.22 * warm})`,
        );
      } else {
        const arming = clamp01((phase - o.on) / o.off);
        ctx.strokeStyle = `rgba(255,45,85,${0.14 + arming * 0.3})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 5]);
        ctx.beginPath();
        ctx.moveTo(s[0], s[1]);
        ctx.lineTo(s[2], s[3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      for (const e of [
        [s[0], s[1]],
        [s[2], s[3]],
      ] as const) {
        ctx.beginPath();
        ctx.arc(e[0], e[1], 5.5, 0, Math.PI * 2);
        ctx.fillStyle = "#3a3f4d";
        ctx.fill();
      }
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

  if (state.tip) {
    ctx.font = "700 13px Nunito, sans-serif";
    ctx.textAlign = "center";
    ctx.fillStyle = "#8a909a";
    ctx.fillText(state.tip, state.W / 2, state.H - 52 - state.safeBottom);
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
      drawHoop(ctx, tr.leave, GREY, { net: tr.leaveNet });
      ctx.restore();
    }
    if (tr.arrive && (tr.arrive.a ?? 1) > 0.02) {
      ctx.save();
      ctx.globalAlpha = tr.arrive.a ?? 1;
      drawHoop(ctx, tr.arrive, ORANGE, { net: tr.arriveNet });
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
        net: tr.carryNet,
        ballX: state.ball.x,
        ballY: state.ball.y,
        timeMs: state.timeMs,
        combo: state.combo,
      });
    }
  } else {
    drawObstacles(ctx, state.obstacles, state.timeMs);

    if (state.challengeStars?.length) {
      for (const s of state.challengeStars) {
        if (s.on) drawStarIcon(ctx, s.x, s.y, 12, state.timeMs / 800);
      }
    } else if (state.starOn && state.star) {
      drawStarIcon(ctx, state.star.x, state.star.y, 12, state.timeMs / 800);
    }

    if (state.source) {
      drawHoop(ctx, state.source, GREY, {
        withBall: state.mode === "aim",
        net: state.sourceNet,
        ballX: state.ball.x,
        ballY: state.ball.y,
        timeMs: state.timeMs,
        combo: state.combo,
      });
    }

    if (state.target) {
      drawHoop(ctx, state.target, ORANGE, {
        withBall: state.mode === "scored",
        net: state.targetNet,
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
