import type { Obstacle } from "@trickshot/physics";

const CACHE = new Map<string, HTMLImageElement | null>();
let preloadStarted = false;

function key(type: Obstacle["type"], variant: "idle" | "pulse"): string {
  return `${type}/${variant}`;
}

function load(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (typeof Image === "undefined") {
      resolve(null);
      return;
    }
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Preload all kit idle (and pulse) sprites — never blocks physics. */
export async function preloadObstacleArt(): Promise<void> {
  if (preloadStarted) return;
  preloadStarted = true;
  const types: Obstacle["type"][] = [
    "wall",
    "bumper",
    "gate",
    "spinner",
    "pendulum",
    "slider",
    "orbiter",
    "conveyor",
    "wind",
    "glass",
    "portal",
    "laser",
  ];
  await Promise.all(
    types.flatMap((t) => {
      const jobs = [
        load(`/obstacles/${t}/idle.png`).then((img) => {
          CACHE.set(key(t, "idle"), img);
        }),
      ];
      if (t === "bumper" || t === "orbiter") {
        jobs.push(
          load(`/obstacles/${t}/pulse.png`).then((img) => {
            CACHE.set(key(t, "pulse"), img);
          }),
        );
      }
      return jobs;
    }),
  );
}

export function getObstacleSprite(
  type: Obstacle["type"],
  variant: "idle" | "pulse" = "idle",
): HTMLImageElement | null {
  return CACHE.get(key(type, variant)) ?? null;
}

/**
 * Draw a centered sprite if loaded. Returns true when art was used.
 * Caller falls back to procedural draw when false.
 *
 * Only disc-like kit types use a single sprite — gate/wall/spinner/etc. need
 * segment geometry (e.g. gate gap). Stretching one PNG over `span` sealed the
 * lane as a solid red bar.
 */
export function tryDrawObstacleSprite(
  ctx: CanvasRenderingContext2D,
  o: Obstacle,
  timeMs: number,
): boolean {
  if (o.type !== "bumper" && o.type !== "orbiter" && o.type !== "portal") {
    return false;
  }

  const pulse =
    (o.type === "bumper" || o.type === "orbiter") &&
    "pulse" in o &&
    (o as { pulse: number }).pulse > 0.15;
  const img =
    getObstacleSprite(o.type, pulse ? "pulse" : "idle") ??
    getObstacleSprite(o.type, "idle");
  if (!img) return false;

  let x = o.x;
  let y = o.y;
  let w = 48;
  let h = 48;

  if (o.type === "bumper") {
    w = h = o.r * 2.4;
  } else if (o.type === "orbiter") {
    x = o.cx ?? o.x;
    y = o.cy ?? o.y;
    w = h = o.r * 2.4;
  } else {
    w = h = o.r * 2.4;
  }

  const bob = Math.sin(timeMs / 400) * 0.5;
  ctx.save();
  ctx.translate(x, y + bob);
  ctx.globalAlpha = 0.92;
  ctx.drawImage(img, -w / 2, -h / 2, w, h);
  ctx.restore();
  return true;
}
