// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { requireAuth } from "../_shared/auth.ts";
import { handleChallengeProgress, type LevelProgressRow } from "./handler.ts";

/**
 * Challenge progress — persist cleared levels and per-level stars (issue #43).
 *
 * GET  /functions/v1/challenge-progress
 * POST /functions/v1/challenge-progress
 * Headers: Authorization: Bearer <sessionJWT>, apiKey: <anonKey>
 *
 * GET Returns:  { cleared: { "0": true, ... }, stars: { "0": 2, ... } }
 * POST Returns: { status: "ok", levelIndex, cleared, stars, progress: { cleared, stars } }
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    return handleChallengeProgress(req, {
      requireAuth: (r) => requireAuth(r),

      async getUserProgress(userId): Promise<LevelProgressRow[]> {
        const { data, error } = await ctx.supabaseAdmin.rpc("get_user_challenge_progress", {
          p_user_id: userId,
        });

        if (error) throw error;
        return ((data ?? []) as Array<{
          level_index: number;
          cleared: boolean;
          stars: number;
        }>).map((row) => ({
          levelIndex: row.level_index,
          cleared: row.cleared,
          stars: row.stars,
        }));
      },

      async upsertLevelProgress(userId, levelIndex, cleared, stars): Promise<LevelProgressRow> {
        const { data, error } = await ctx.supabaseAdmin.rpc("upsert_challenge_progress", {
          p_user_id: userId,
          p_level_index: levelIndex,
          p_cleared: cleared,
          p_stars: stars,
        });

        if (error) throw error;
        const row = (Array.isArray(data) ? data[0] : data) as {
          level_index: number;
          cleared: boolean;
          stars: number;
        };

        return {
          levelIndex: row.level_index,
          cleared: row.cleared,
          stars: row.stars,
        };
      },
    });
  }),
};

/* To invoke locally:

  # Fetch progress
  curl -i 'http://127.0.0.1:54321/functions/v1/challenge-progress' \
    --header 'apiKey: <anon-key>' \
    --header 'Authorization: Bearer <sessionJWT>'

  # Submit level clear
  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/challenge-progress' \
    --header 'apiKey: <anon-key>' \
    --header 'Authorization: Bearer <sessionJWT>' \
    --header 'Content-Type: application/json' \
    --data '{"levelIndex":0,"cleared":true,"stars":2}'

*/
