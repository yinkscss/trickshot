/**
 * Leaderboard business logic (issue #8).
 *
 * Calls the `daily_leaderboard()` SECURITY DEFINER RPC defined in the
 * runs_support migration. No auth required — public scores.
 *
 * All DB access injected so tests can run without Supabase.
 */

import type { GameMode } from "../../../packages/shared/dist/index.js";

export interface LeaderboardRow {
  rank: number;
  userId: string;
  walletAddress: string;
  score: number;
  chainLength: number;
  createdAt: string;
}

export interface LeaderboardDeps {
  queryBoard(params: {
    mode: GameMode;
    date: string;
    limit: number;
  }): Promise<LeaderboardRow[]>;
}

const VALID_MODES: GameMode[] = ["casual", "daily", "tournament", "challenges"];
const MAX_LIMIT = 500;
const DEFAULT_LIMIT = 100;

function isoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function handleLeaderboard(
  req: Request,
  deps: LeaderboardDeps,
): Promise<Response> {
  // -- Method guard ----------------------------------------------------------
  if (req.method !== "GET") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  // -- Query params ----------------------------------------------------------
  const url = new URL(req.url);
  const modeParam = url.searchParams.get("mode") ?? "daily";
  const dateParam = url.searchParams.get("date") ?? todayUtc();
  const limitParam = parseInt(url.searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);

  if (!VALID_MODES.includes(modeParam as GameMode)) {
    return Response.json(
      { error: "invalid_mode", validModes: VALID_MODES },
      { status: 400 },
    );
  }
  if (!isoDate(dateParam)) {
    return Response.json(
      { error: "invalid_date", detail: "use YYYY-MM-DD format" },
      { status: 400 },
    );
  }
  const limit = Math.max(1, Math.min(limitParam || DEFAULT_LIMIT, MAX_LIMIT));

  // -- Query -----------------------------------------------------------------
  let board: LeaderboardRow[];
  try {
    board = await deps.queryBoard({
      mode: modeParam as GameMode,
      date: dateParam,
      limit,
    });
  } catch (err) {
    return Response.json(
      { error: "db_error", detail: String(err) },
      { status: 500 },
    );
  }

  return Response.json({ board, mode: modeParam, date: dateParam });
}
