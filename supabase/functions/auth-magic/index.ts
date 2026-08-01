// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { Magic } from "npm:@magic-sdk/admin@^2";
import { rateLimitByIp, rateLimitByIssuer } from "../_shared/rate-limit.ts";
import { signAccessToken } from "../_shared/auth.ts";
import { handleAuthMagic } from "./handler.ts";

/**
 * Magic.link → Supabase user bridge (issue #7).
 *
 * POST /functions/v1/auth-magic
 * Body: { didToken: string }
 *
 * This file is the Deno/Supabase runtime entrypoint only. All business logic
 * lives in `handler.ts` for testability (see `auth-magic.test.ts`).
 *
 * Auth model:
 *  - `verify_jwt = false` in config.toml — caller has no Supabase JWT yet.
 *  - `withSupabase({ auth: ["publishable"] })` — requires the anon API key
 *    in the `apiKey` header. The anon key is public (shipped via VITE env).
 *  - MAGIC_SECRET_KEY + SUPABASE_SERVICE_ROLE_KEY never leave this function.
 *  - Wallet address comes from Magic metadata, never from the client body.
 *
 * Rate limits (in-memory, per-worker):
 *  - 10 requests / IP / 15 min  (checked before body parse)
 *  - 5  requests / issuer / 15 min (checked after DID decode, before API call)
 *
 * Session token:
 *  Custom HS256 JWT signed with RUN_SIGNING_SECRET. Expires in 1 hour.
 *  Clients attach it as: Authorization: Bearer <token>
 *  Protected functions verify it via `requireAuth()` from `_shared/auth.ts`.
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    const magicSecretKey = Deno.env.get("MAGIC_SECRET_KEY");
    if (!magicSecretKey) {
      console.error("auth-magic: MAGIC_SECRET_KEY is not configured");
      return Response.json({ error: "server_misconfigured" }, { status: 500 });
    }

    const magic = new Magic(magicSecretKey);

    return handleAuthMagic(req, {
      magic,

      async upsertUser(issuer, walletAddress) {
        // ON CONFLICT (magic_issuer): update wallet_address in case Magic
        // re-provisions the Celo wallet (rare but possible in edge cases).
        const { data, error } = await ctx.supabaseAdmin
          .from("users")
          .upsert(
            { magic_issuer: issuer, wallet_address: walletAddress },
            { onConflict: "magic_issuer" },
          )
          .select("id, magic_issuer, wallet_address")
          .single();

        if (error || !data) {
          console.error("auth-magic: DB upsert failed:", error);
          throw error ?? new Error("upsert returned no data");
        }
        return data as { id: string; magic_issuer: string; wallet_address: string };
      },

      signToken: (userId, issuer, walletAddress) =>
        signAccessToken({ userId, issuer, walletAddress }),

      rateLimitIp: rateLimitByIp,
      rateLimitIssuer: rateLimitByIssuer,
    });
  }),
};

/* To invoke locally:

  1. Run `npx supabase start` (Docker required)
  2. Obtain a real Magic DID token from a sandbox login, then:

  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/auth-magic' \
    --header 'apiKey: <anon-key from supabase status>' \
    --header 'Content-Type: application/json' \
    --data '{"didToken":"<real Magic DID token>"}'

  With a valid token: HTTP 200 + { userId, walletAddress, accessToken, expiresIn }
  With an invalid token: HTTP 401

*/
