// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

/**
 * Backend health check (issue #6).
 *
 * Confirms the Edge runtime is reachable AND that it can round-trip a query
 * against Postgres through the service role. `ctx.supabaseAdmin` bypasses RLS
 * (as it does for every Edge Function in this repo) -- appropriate here since
 * this route reports infrastructure health, not user data.
 *
 * Auth: requires the publishable (anon) or secret (service) API key in the
 * `apiKey` header. Intentionally not fully public/unauthenticated, consistent
 * with this repo's deny-by-default posture (see supabase/README.md).
 */
export default {
  fetch: withSupabase({ auth: ["publishable", "secret"] }, async (_req, ctx) => {
    const startedAt = Date.now();

    const { error } = await ctx.supabaseAdmin
      .from("powerup_skus")
      .select("id", { count: "exact", head: true });

    const dbOk = !error;

    return Response.json(
      {
        ok: dbOk,
        service: "trickshot-supabase",
        db: dbOk ? "reachable" : "unreachable",
        error: error?.message,
        tookMs: Date.now() - startedAt,
      },
      { status: dbOk ? 200 : 503 },
    );
  }),
};

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request GET 'http://127.0.0.1:54321/functions/v1/health' \
    --header 'apiKey: <anon/publishable key from `supabase status`>'

*/

