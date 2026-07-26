import { drawPitchFrame, type PitchDrawState } from "./pitchDraw";

/**
 * Direct Canvas2D renderer — draws pitch frames onto the visible `<canvas>`.
 * No Phaser blit / CanvasTexture.
 */
export class DirectCanvasRenderer {
  private dpr = 1;
  private W = 390;
  private H = 780;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("DirectCanvasRenderer: 2d context unavailable");
    }
    this.ctx = ctx;
  }

  resize(W: number, H: number): void {
    this.W = Math.max(1, Math.floor(W));
    this.H = Math.max(1, Math.floor(H));
    this.dpr = Math.min(
      typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1,
      2,
    );
    const pw = Math.max(1, (this.W * this.dpr) | 0);
    const ph = Math.max(1, (this.H * this.dpr) | 0);
    if (this.canvas.width !== pw || this.canvas.height !== ph) {
      this.canvas.width = pw;
      this.canvas.height = ph;
    }
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  get size(): { W: number; H: number } {
    return { W: this.W, H: this.H };
  }

  render(state: PitchDrawState): void {
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.W, this.H);
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

/** Map pointer client coords → logical court pixels. */
export function clientToCourt(
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  W: number,
  H: number,
): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const rw = Math.max(1, rect.width);
  const rh = Math.max(1, rect.height);
  return {
    x: ((clientX - rect.left) / rw) * W,
    y: ((clientY - rect.top) / rh) * H,
  };
}
