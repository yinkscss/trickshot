import { COURT_H, COURT_W, clamp } from "../physics";
import { COURT } from "./colors";
import { drawPitchFrame, type PitchDrawState } from "./pitchDraw";

/**
 * Direct Canvas2D renderer — draws pitch frames onto the visible `<canvas>`.
 * Canvas fills the container; gameplay is letterboxed into a fixed logical court.
 */
export class DirectCanvasRenderer {
  private dpr = 1;
  private viewW = COURT_W;
  private viewH = COURT_H;
  private viewScale = 1;
  private viewOffX = 0;
  private viewOffY = 0;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("DirectCanvasRenderer: 2d context unavailable");
    }
    this.ctx = ctx;
  }

  /** Size the backing store to the container and recompute letterbox. */
  resize(viewW: number, viewH: number): void {
    this.viewW = Math.max(1, Math.floor(viewW));
    this.viewH = Math.max(1, Math.floor(viewH));
    this.dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2,
    );
    const pw = Math.max(1, (this.viewW * this.dpr) | 0);
    const ph = Math.max(1, (this.viewH * this.dpr) | 0);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.viewScale = Math.min(this.viewW / COURT_W, this.viewH / COURT_H);
    this.viewOffX = (this.viewW - COURT_W * this.viewScale) / 2;
    this.viewOffY = (this.viewH - COURT_H * this.viewScale) / 2;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get size(): { W: number; H: number } {
    return { W: COURT_W, H: COURT_H };
  }

  render(state: PitchDrawState): void {
    // Letterbox first, then work entirely in logical court units (pitch parity).
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.fillStyle = COURT;
    this.ctx.fillRect(0, 0, this.viewW, this.viewH);
    this.ctx.setTransform(
      this.dpr * this.viewScale,
      0,
      0,
      this.dpr * this.viewScale,
      this.dpr * this.viewOffX,
      this.dpr * this.viewOffY,
    );
    drawPitchFrame(this.ctx, state);
  }

  toDataURL(type = "image/png"): string {
    return this.canvas.toDataURL(type);
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}

export function safeTopInset(): number {
  if (typeof document === "undefined") return 0;
  const el =
    document.getElementById("phone") ?? document.getElementById("game");
  if (!el) return 0;
  const pad = getComputedStyle(el).paddingTop;
  const n = parseFloat(pad);
  return Number.isFinite(n) ? n : 0;
}

export function safeBottomInset(): number {
  if (typeof document === "undefined") return 0;
  const el =
    document.getElementById("phone") ?? document.getElementById("game");
  if (!el) return 0;
  const pad = getComputedStyle(el).paddingBottom;
  const n = parseFloat(pad);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Map pointer client coords → logical court pixels.
 * Inverts the letterbox transform from DirectCanvasRenderer / challenges-pitch ptr().
 */
export function clientToCourt(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  courtW: number = COURT_W,
  courtH: number = COURT_H,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const rw = Math.max(1, rect.width);
  const rh = Math.max(1, rect.height);
  const viewW = rw;
  const viewH = rh;
  const viewScale = Math.min(viewW / courtW, viewH / courtH);
  const viewOffX = (viewW - courtW * viewScale) / 2;
  const viewOffY = (viewH - courtH * viewScale) / 2;
  const x =
    ((clientX - rect.left) * (viewW / rw) - viewOffX) / viewScale;
  const y =
    ((clientY - rect.top) * (viewH / rh) - viewOffY) / viewScale;
  return {
    x: clamp(x, 0, courtW),
    y: clamp(y, 0, courtH),
  };
}
