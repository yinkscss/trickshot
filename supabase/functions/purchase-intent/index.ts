// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { requireAuth } from "../_shared/auth.ts";
import { handlePurchaseIntent } from "./handler.ts";

/**
 * Purchase intent — create a pre-tx purchase record (issue #9).
 *
 * POST /functions/v1/purchase-intent
 * Headers: Authorization: Bearer <sessionJWT>, apiKey: <anonKey>
 * Body: { sku: string, quantity: number }
 *
 * Returns: { intentId, sku, quantity, priceCents, expiresAt }
 *
 * The intentId should be passed back in purchase-confirm after the tx
 * is mined. The intent expires after 1 hour (TTL matches the tx timeout
 * window for Celo Sepolia).
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    return handlePurchaseIntent(req, {
      requireAuth: (r) => requireAuth(r),

      async getSku(skuId) {
        const { data, error } = await ctx.supabaseAdmin
          .from("powerup_skus")
          .select("id, name, price_cents, active")
          .eq("id", skuId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;
        const d = data as { id: string; name: string; price_cents: number; active: boolean };
        return { id: d.id, name: d.name, priceCents: d.price_cents, active: d.active };
      },

      async insertIntent(userId, sku, quantity, priceCents) {
        const { data, error } = await ctx.supabaseAdmin
          .from("purchase_intents")
          .insert({ user_id: userId, sku, quantity, price_cents: priceCents })
          .select("id, sku, quantity, price_cents, expires_at")
          .single();

        if (error || !data) throw error ?? new Error("insertIntent returned no data");
        const d = data as { id: string; sku: string; quantity: number; price_cents: number; expires_at: string };
        return { id: d.id, sku: d.sku, quantity: d.quantity, priceCents: d.price_cents, expiresAt: d.expires_at };
      },
    });
  }),
};

/* To invoke locally:

  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/purchase-intent' \
    --header 'apiKey: <anon-key>' \
    --header 'Authorization: Bearer <sessionJWT>' \
    --header 'Content-Type: application/json' \
    --data '{"sku":"slow_drop","quantity":1}'

  Response: { intentId, sku, quantity, priceCents, expiresAt }

*/
