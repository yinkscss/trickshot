import type { Hoop, Vec2 } from "../physics";

export function hoopToWorld(
  h: Hoop,
  tipAng: number,
  lx: number,
  ly: number,
): Vec2 {
  const c = Math.cos(tipAng);
  const s = Math.sin(tipAng);
  return {
    x: h.x + lx * c - ly * s,
    y: h.y + lx * s + ly * c,
  };
}

export function cssToColor(colorCss: string): number {
  if (colorCss.startsWith("rgb")) {
    const m = colorCss.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (m) {
      return (Number(m[1]) << 16) | (Number(m[2]) << 8) | Number(m[3]);
    }
  }
  return parseInt(colorCss.replace("#", ""), 16);
}

export function safeTopInset(): number {
  if (typeof document === "undefined") return 0;
  const el = document.getElementById("game");
  if (!el) return 0;
  const pad = getComputedStyle(el).paddingTop;
  const n = parseFloat(pad);
  return Number.isFinite(n) ? n : 0;
}
