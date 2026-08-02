// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { handleLeaderboard, type LeaderboardRow } from "./handler.ts";
import type { GameMode } from "@trickshot/shared";

/**
 * Daily leaderboard — public, no auth required (issue #8).
 *
 * GET /functions/v1/leaderboard?mode=daily&date=2026-07-29&limit=100
 * Headers: apiKey: <anonKey>
 *
 * Calls the `daily_leaderboard(p_mode, p_date, p_limit)` SECURITY DEFINER RPC.
 * SECURITY DEFINER bypasses RLS for the join, so anon callers can read
 * public leaderboard data without service role access.
 *
 * Sorted by: chain_length DESC (replay-authoritative), score DESC
 * (client-declared tiebreak), created_at ASC (first-in wins).
 *
 * Auth: anon API key only — no session JWT required (public scores).
 * verify_jwt = false in config.toml (we don't issue JWTs for anon reads).
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    return handleLeaderboard(req, {
      async queryBoard({ mode, date, limit }) {
        const { data, error } = await ctx.supabaseAdmin.rpc(
          "daily_leaderboard",
          {
            p_mode: mode,
            p_date: date,
            p_limit: limit,
          },
        );

        if (error) throw error;

        return ((data ?? []) as Array<{
          rank: number;
          user_id: string;
          wallet_address: string;
          score: number;
          chain_length: number;
          created_at: string;
        }>).map((row) => ({
          rank: row.rank,
          userId: row.user_id,
          walletAddress: row.wallet_address,
          score: row.score,
          chainLength: row.chain_length,
          createdAt: row.created_at,
        } satisfies LeaderboardRow));
      },
    });
  }),
};

/* To invoke locally:

  1. npx supabase start && npx supabase db reset
  2. Submit some verified runs via runs-start + runs-finish

  curl 'http://127.0.0.1:54321/functions/v1/leaderboard?mode=daily&limit=10' \
    --header 'apiKey: <anon-key>'

  Response: { board: [{ rank, userId, walletAddress, score, chainLength, createdAt }], mode, date }

*/
