// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { requireAuth } from "../_shared/auth.ts";
import { handleContinueIntent, type ContinueIntentRecord } from "./handler.ts";
import type { GameMode } from "@trickshot/shared";

/**
 * Continue intent — create a pre-tx purchase record for a continue (issue #52).
 *
 * POST /functions/v1/continue-intent
 * Headers: Authorization: Bearer <sessionJWT>, apiKey: <anonKey>
 * Body: { mode: GameMode, runId?: string }
 *
 * Returns: { intentId, runId, mode, expiresAt }
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    return handleContinueIntent(req, {
      requireAuth: (r) => requireAuth(r),

      async insertIntent(userId, mode, runId): Promise<ContinueIntentRecord> {
        const { data, error } = await ctx.supabaseAdmin
          .from("continue_intents")
          .insert({
            user_id: userId,
            mode: mode as GameMode,
            run_id: runId ?? null,
          })
          .select("id, run_id, mode, expires_at")
          .single();

        if (error || !data) throw error ?? new Error("insertIntent returned no data");
        const d = data as { id: string; run_id: string | null; mode: string; expires_at: string };
        return {
          id: d.id,
          runId: d.run_id ?? undefined,
          mode: d.mode as GameMode,
          expiresAt: d.expires_at,
        };
      },
    });
  }),
};

/* To invoke locally:

  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/continue-intent' \
    --header 'apiKey: <anon-key>' \
    --header 'Authorization: Bearer <sessionJWT>' \
    --header 'Content-Type: application/json' \
    --data '{"mode":"casual","runId":"<uuid>"}'

*/
