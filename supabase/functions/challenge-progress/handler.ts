/**
 * challenge-progress business logic (issue #43).
 *
 * Persists challenge mode progress (cleared levels + per-level stars) in Supabase.
 * Enforces unlock rules: level 0 is free; level N requires level N-1 to be cleared.
 *
 * GET  /functions/v1/challenge-progress -> returns { cleared, stars }
 * POST /functions/v1/challenge-progress -> body { levelIndex, stars, cleared? } or { sync: { cleared, stars } }
 *
 * All deps injected -> testable in Node.
 */

import { isChallengeUnlocked } from "../../../packages/logic/dist/index.js";
import type { ChallengesProgress } from "../../../packages/logic/dist/index.js";

export interface LevelProgressRow {
  levelIndex: number;
  cleared: boolean;
  stars: number;
}

export interface ChallengeProgressDeps {
  requireAuth(req: Request): Promise<{ userId: string }>;
  getUserProgress(userId: string): Promise<LevelProgressRow[]>;
  upsertLevelProgress(
    userId: string,
    levelIndex: number,
    cleared: boolean,
    stars: number,
  ): Promise<LevelProgressRow>;
}

export function formatProgress(rows: LevelProgressRow[]): ChallengesProgress {
  const cleared: Record<string, boolean> = {};
  const stars: Record<string, number> = {};
  for (const row of rows) {
    if (row.cleared) {
      cleared[String(row.levelIndex)] = true;
    }
    if (row.stars > 0) {
      stars[String(row.levelIndex)] = row.stars;
    }
  }
  return { cleared, stars };
}

export async function handleChallengeProgress(
  req: Request,
  deps: ChallengeProgressDeps,
): Promise<Response> {
  if (req.method !== "GET" && req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  // Auth
  let session: { userId: string };
  try {
    session = await deps.requireAuth(req);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // GET: Fetch current user progress
  if (req.method === "GET") {
    let rows: LevelProgressRow[];
    try {
      rows = await deps.getUserProgress(session.userId);
    } catch (err) {
      return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
    }
    return Response.json(formatProgress(rows));
  }

  // POST: Record level clear / star progress or bulk sync
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  // Handle bulk sync format: { sync: { cleared: {...}, stars: {...} } }
  if (body.sync && typeof body.sync === "object") {
    const syncData = body.sync as { cleared?: Record<string, boolean>; stars?: Record<string, number> };
    const clearedMap = syncData.cleared || {};
    const starsMap = syncData.stars || {};

    const levelKeys = new Set<number>();
    for (const k of Object.keys(clearedMap)) {
      const idx = parseInt(k, 10);
      if (Number.isInteger(idx) && idx >= 0) levelKeys.add(idx);
    }
    for (const k of Object.keys(starsMap)) {
      const idx = parseInt(k, 10);
      if (Number.isInteger(idx) && idx >= 0) levelKeys.add(idx);
    }

    const sortedLevels = Array.from(levelKeys).sort((a, b) => a - b);
    try {
      for (const lvl of sortedLevels) {
        const isCleared = clearedMap[String(lvl)] === true || clearedMap[lvl] === true;
        const starCnt = typeof starsMap[String(lvl)] === "number" ? starsMap[String(lvl)]! : (typeof starsMap[lvl] === "number" ? starsMap[lvl]! : 0);
        const validStars = Math.max(0, Math.min(3, Math.floor(starCnt)));
        await deps.upsertLevelProgress(session.userId, lvl, isCleared, validStars);
      }
      const finalRows = await deps.getUserProgress(session.userId);
      return Response.json({
        status: "ok",
        progress: formatProgress(finalRows),
      });
    } catch (err) {
      return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
    }
  }

  // Single level progress submit: { levelIndex: number, stars?: number, cleared?: boolean }
  const { levelIndex, stars, cleared } = body;

  const lvlIdx = typeof levelIndex === "number" ? levelIndex : parseInt(String(levelIndex), 10);
  if (!Number.isInteger(lvlIdx) || lvlIdx < 0) {
    return Response.json({ error: "invalid_level_index", detail: "levelIndex must be an integer >= 0" }, { status: 400 });
  }

  const starCount = typeof stars === "number" ? stars : parseInt(String(stars || 0), 10);
  if (!Number.isInteger(starCount) || starCount < 0 || starCount > 3) {
    return Response.json({ error: "invalid_stars", detail: "stars must be between 0 and 3" }, { status: 400 });
  }

  const isCleared = cleared === undefined ? true : Boolean(cleared);

  // Check unlock gating
  let currentRows: LevelProgressRow[];
  try {
    currentRows = await deps.getUserProgress(session.userId);
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  const currentProgress = formatProgress(currentRows);
  if (!isChallengeUnlocked(lvlIdx, currentProgress)) {
    return Response.json(
      { error: "level_locked", detail: `Level ${lvlIdx} is locked` },
      { status: 422 },
    );
  }

  // Upsert progress
  let updatedRow: LevelProgressRow;
  try {
    updatedRow = await deps.upsertLevelProgress(session.userId, lvlIdx, isCleared, starCount);
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  // Fetch updated full progress map
  let updatedRows: LevelProgressRow[];
  try {
    updatedRows = await deps.getUserProgress(session.userId);
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  return Response.json({
    status: "ok",
    levelIndex: updatedRow.levelIndex,
    cleared: updatedRow.cleared,
    stars: updatedRow.stars,
    progress: formatProgress(updatedRows),
  });
}
