// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { PHYSICS_BUILD_ID } from "@trickshot/physics";
import { requireAuth } from "../_shared/auth.ts";
import { handleRunsFinish, type NonceRecord } from "./handler.ts";
import type { GameMode, InputLog } from "@trickshot/shared";

/**
 * Run finish + hybrid replay anti-cheat (issue #8).
 *
 * POST /functions/v1/runs-finish
 * Headers: Authorization: Bearer <sessionJWT>, apiKey: <anonKey>
 * Body: RunSummary + runId
 *   { runId, mode, score, chainLength, stars, continuesUsed, powerupsUsed,
 *     seed, inputLog? }
 *
 * Returns:
 *   200  { runId, status: "verified", chainLength, score, replayChainLength }
 *   422  { error: "run_rejected", reason }
 *
 * Anti-cheat (Option A):
 *   - Server verifies nonce (runId from runs-start)
 *   - Replays inputLog through @trickshot/logic replayRunFromInputLog
 *   - continuesUsed and chainLength from replay are authoritative
 *   - Client score stored as-is (display only); leaderboard sorts by chainLength
 *   - Tournament/challenges: requires full inputLog; rejects truncated logs
 *   - Casual/daily: accepts truncated logs (partial replay still catches continues)
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    return handleRunsFinish(req, {
      requireAuth: (r) => requireAuth(r),
      physicsBuildId: PHYSICS_BUILD_ID,
      now: () => Date.now(),

      async getNonce(runId: string): Promise<NonceRecord | null> {
        const { data, error } = await ctx.supabaseAdmin
          .from("runs_start_nonces")
          .select("id, user_id, mode, seed, expires_at, used")
          .eq("id", runId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const d = data as {
          id: string;
          user_id: string;
          mode: GameMode;
          seed: string;
          expires_at: string;
          used: boolean;
        };

        return {
          id: d.id,
          userId: d.user_id,
          mode: d.mode,
          seed: d.seed,
          expiresAt: d.expires_at,
          used: d.used,
        };
      },

      async markNonceUsed(runId: string): Promise<void> {
        const { error } = await ctx.supabaseAdmin
          .from("runs_start_nonces")
          .update({ used: true })
          .eq("id", runId)
          .eq("used", false); // Optimistic lock — fails silently if already used

        if (error) throw error;
      },

      async insertRun(row) {
        const { data, error } = await ctx.supabaseAdmin
          .from("runs")
          .insert({
            id: row.id,
            user_id: row.userId,
            mode: row.mode,
            score: row.score,
            chain_length: row.chainLength,
            seed: row.seed,
            continues_used: row.continuesUsed,
            status: row.status,
            input_log: row.inputLog as unknown as InputLog ?? null,
          })
          .select("id")
          .single();

        if (error || !data) throw error ?? new Error("insertRun returned no data");
        return { id: (data as { id: string }).id };
      },

      async pruneNonces(userId: string): Promise<void> {
        // Delete used or expired nonces for this user (best-effort housekeeping)
        await ctx.supabaseAdmin
          .from("runs_start_nonces")
          .delete()
          .eq("user_id", userId)
          .or("used.eq.true,expires_at.lt." + new Date().toISOString());
      },
    });
  }),
};

/* To invoke locally:

  1. npx supabase start
  2. Get { runId, seed } from runs-start
  3. Play the run, record the inputLog

  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/runs-finish' \
    --header 'apiKey: <anon-key>' \
    --header 'Authorization: Bearer <sessionJWT>' \
    --header 'Content-Type: application/json' \
    --data '{
      "runId": "<from runs-start>",
      "mode": "casual",
      "score": 8,
      "chainLength": 5,
      "stars": 3,
      "continuesUsed": 0,
      "powerupsUsed": [],
      "seed": "<from runs-start>",
      "inputLog": { "version": 1, "seed": "...", "mode": "casual", ... }
    }'

*/
