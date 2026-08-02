// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { getModeRules, type GameMode } from "@trickshot/shared";
import { dailySeedFromUtcDate } from "@trickshot/logic";
import { requireAuth } from "../_shared/auth.ts";
import { handleRunsStart } from "./handler.ts";

/**
 * Run start — server mints authoritative seed (issue #8).
 *
 * POST /functions/v1/runs-start
 * Headers: Authorization: Bearer <sessionJWT>, apiKey: <anonKey>
 * Body: { mode: GameMode, tournamentId?: string }
 *
 * Returns: { runId, seed, mode, expiresAt, serverTime }
 *
 * The returned `runId` is a nonce UUID that the client MUST include in the
 * subsequent POST /functions/v1/runs-finish. This lets runs-finish confirm
 * the seed was server-issued, belongs to this user, is unexpired, and
 * hasn't been submitted before (prevents double-submit + seed stuffing).
 *
 * Auth: requires session JWT from auth-magic in Authorization header.
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    return handleRunsStart(req, {
      requireAuth: (r) => requireAuth(r),

      resolveSeed(mode: GameMode, tournamentId?: string): string {
        const { seedSource } = getModeRules(mode);
        switch (seedSource) {
          case "per_run":
            // Server-generated UUID — unpredictable by the client
            return crypto.randomUUID();
          case "utc_daily":
            // Same derivation as the client: YYYY-MM-DD UTC
            return dailySeedFromUtcDate(new Date());
          case "tournament_id":
            if (!tournamentId) throw new Error("tournamentId required");
            return tournamentId;
          default: {
            const _exhaustive: never = seedSource;
            return _exhaustive;
          }
        }
      },

      async insertNonce(userId, mode, seed) {
        const { data, error } = await ctx.supabaseAdmin
          .from("runs_start_nonces")
          .insert({ user_id: userId, mode, seed })
          .select("id, seed, mode, expires_at")
          .single();

        if (error || !data) {
          throw error ?? new Error("insertNonce returned no data");
        }
        return {
          id: (data as { id: string }).id,
          seed: (data as { seed: string }).seed,
          mode: (data as { mode: GameMode }).mode,
          expiresAt: (data as { expires_at: string }).expires_at,
        };
      },

      now: () => Date.now(),
    });
  }),
};

/* To invoke locally:

  1. Run `npx supabase start`
  2. Get session JWT from auth-magic

  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/runs-start' \
    --header 'apiKey: <anon-key>' \
    --header 'Authorization: Bearer <sessionJWT>' \
    --header 'Content-Type: application/json' \
    --data '{"mode":"casual"}'

  Response: { runId, seed, mode, expiresAt, serverTime }

*/
