export type CosmeticPreset = {
  id: string;
  name: string;
  starCost: number;
  ballCss: string;
  trailCss: string;
};

export const COSMETIC_PRESETS: readonly CosmeticPreset[] = [
  {
    id: "default",
    name: "Classic",
    starCost: 0,
    ballCss: "#1e5fff",
    trailCss: "#4ecbff",
  },
  {
    id: "ember",
    name: "Ember",
    starCost: 5,
    ballCss: "#ff4d1a",
    trailCss: "#ff9800",
  },
  {
    id: "mint",
    name: "Mint",
    starCost: 12,
    ballCss: "#00b894",
    trailCss: "#55efc4",
  },
  {
    id: "violet",
    name: "Violet",
    starCost: 20,
    ballCss: "#7c4dff",
    trailCss: "#b388ff",
  },
] as const;

const UNLOCKED_KEY = "trickshot.cosmetics.unlocked";
const EQUIPPED_KEY = "trickshot.cosmetics.equipped";
const LIFETIME_STARS_KEY = "trickshot.cosmetics.lifetimeStars";

/** In-memory fallback when localStorage is unavailable (node tests). */
const memory = new Map<string, string>();

function storageGet(key: string): string | null {
  try {
    if (globalThis.localStorage) return globalThis.localStorage.getItem(key);
  } catch {
    /* private mode */
  }
  return memory.get(key) ?? null;
}

function storageSet(key: string, value: string): void {
  memory.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    /* private mode */
  }
}

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = storageGet(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson(key: string, value: unknown): void {
  storageSet(key, JSON.stringify(value));
}

export function getLifetimeStars(): number {
  const n = readJson<number>(LIFETIME_STARS_KEY, 0);
  return typeof n === "number" && n >= 0 ? n : 0;
}

/** Add stars earned this run to lifetime soft-currency total. */
export function addLifetimeStars(n: number): number {
  const next = getLifetimeStars() + Math.max(0, Math.floor(n));
  writeJson(LIFETIME_STARS_KEY, next);
  return next;
}

export function getUnlockedPresetIds(): string[] {
  const ids = readJson<string[]>(UNLOCKED_KEY, ["default"]);
  if (!ids.includes("default")) ids.unshift("default");
  return ids;
}

export function isPresetUnlocked(id: string): boolean {
  return getUnlockedPresetIds().includes(id);
}

export function unlockAffordablePresets(
  lifetimeStars = getLifetimeStars(),
): string[] {
  const unlocked = new Set(getUnlockedPresetIds());
  for (const p of COSMETIC_PRESETS) {
    if (lifetimeStars >= p.starCost) unlocked.add(p.id);
  }
  const list = [...unlocked];
  writeJson(UNLOCKED_KEY, list);
  return list;
}

export function getEquippedPresetId(): string {
  const id = readJson<string>(EQUIPPED_KEY, "default");
  return isPresetUnlocked(id) ? id : "default";
}

export function equipPreset(id: string): boolean {
  if (!isPresetUnlocked(id)) return false;
  writeJson(EQUIPPED_KEY, id);
  return true;
}

export function getEquippedPreset(): CosmeticPreset {
  const id = getEquippedPresetId();
  return COSMETIC_PRESETS.find((p) => p.id === id) ?? COSMETIC_PRESETS[0]!;
}
