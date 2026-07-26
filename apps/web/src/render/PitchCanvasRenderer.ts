import Phaser from "phaser";
import { drawPitchFrame, type PitchDrawState } from "./pitchDraw";

const TEX_KEY = "pitch-canvas-frame";

/**
 * Offscreen Canvas2D pitch draw → Phaser CanvasTexture Image blit.
 * Each frame: clear (DPR-aware) → pitch draw order → texture.refresh().
 */
export class PitchCanvasRenderer {
  private readonly texture: Phaser.Textures.CanvasTexture;
  private readonly image: Phaser.GameObjects.Image;
  private dpr = 1;
  private W = 390;
  private H = 780;

  constructor(private readonly scene: Phaser.Scene) {
    if (scene.textures.exists(TEX_KEY)) {
      scene.textures.remove(TEX_KEY);
    }
    const tex = scene.textures.createCanvas(TEX_KEY, 390, 780);
    if (!tex) {
      throw new Error("PitchCanvasRenderer: createCanvas failed");
    }
    this.texture = tex;
    this.image = scene.add
      .image(0, 0, TEX_KEY)
      .setOrigin(0, 0)
      .setDepth(0)
      .setScrollFactor(0);
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
    this.texture.setSize(pw, ph);
    const ctx = this.texture.getContext();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.image.setPosition(0, 0);
    this.image.setDisplaySize(this.W, this.H);
  }

  render(state: PitchDrawState): void {
    const ctx = this.texture.getContext();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    drawPitchFrame(ctx, state);
    this.texture.refresh();
  }

  /** PNG data URL of the offscreen pitch canvas (logical CSS size via draw). */
  toDataURL(type = "image/png"): string {
    return this.texture.getCanvas().toDataURL(type);
  }

  getCanvas(): HTMLCanvasElement {
    return this.texture.getCanvas();
  }

  destroy(): void {
    this.image.destroy();
    if (this.scene.textures.exists(TEX_KEY)) {
      this.scene.textures.remove(TEX_KEY);
    }
  }
}

export function safeTopInset(): number {
  if (typeof document === "undefined") return 0;
  const el = document.getElementById("game");
  if (!el) return 0;
  const pad = getComputedStyle(el).paddingTop;
  const n = parseFloat(pad);
  return Number.isFinite(n) ? n : 0;
}
