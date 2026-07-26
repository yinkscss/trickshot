import type { GameMode } from "@trickshot/shared";

export interface LeaderboardEntry {
  score: number;
  stars: number;
  chainLength: number;
  mode: GameMode;
  seed: string;
  at: string; // ISO
}

const KEY = "trickshot.leaderboard.v1";
const MAX = 10;

type Store = Record<"casual" | "daily", LeaderboardEntry[]>;

function emptyStore(): Store {
  return { casual: [], daily: [] };
}

function readStore(): Store {
  if (typeof localStorage === "undefined") return emptyStore();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyStore();
    const parsed = JSON.parse(raw) as Partial<Store>;
    return {
      casual: Array.isArray(parsed.casual) ? parsed.casual : [],
      daily: Array.isArray(parsed.daily) ? parsed.daily : [],
    };
  } catch {
    return emptyStore();
  }
}

function writeStore(store: Store): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(store));
}

function boardKey(mode: GameMode): "casual" | "daily" | null {
  if (mode === "casual" || mode === "daily") return mode;
  return null;
}

/** Persist a finished run; returns updated top-N for that mode (or []). */
export function recordLocalScore(entry: LeaderboardEntry): LeaderboardEntry[] {
  const key = boardKey(entry.mode);
  if (!key) return [];
  const store = readStore();
  const next = [...store[key], entry]
    .sort((a, b) => b.score - a.score || b.chainLength - a.chainLength)
    .slice(0, MAX);
  store[key] = next;
  writeStore(store);
  return next;
}

export function getLocalLeaderboard(mode: "casual" | "daily"): LeaderboardEntry[] {
  return readStore()[mode];
}

/** Future global board payload shape (not posted yet). */
export function toGlobalBoardPayload(entry: LeaderboardEntry) {
  return {
    mode: entry.mode,
    score: entry.score,
    stars: entry.stars,
    chainLength: entry.chainLength,
    seed: entry.seed,
    clientAt: entry.at,
  };
}
