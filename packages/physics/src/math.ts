export const clamp = (v: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, v));

export const hypot = Math.hypot;

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export function maxPull(width: number, height: number): number {
  return Math.min(width, height) * 0.42;
}
