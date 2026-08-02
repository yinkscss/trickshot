// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { handleCatalog } from "./handler.ts";

/**
 * Powerup catalog — public, no auth (issue #9).
 *
 * GET /functions/v1/catalog
 * Headers: apiKey: <anonKey>
 *
 * Returns: { skus: [{ id, name, priceCents, onChainSkuId }] }
 *
 * No random rolls — deterministic fixed-price catalog only.
 * STACK_LOCK: monetization=continue_powerup, no loot-box RNG.
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (_req, ctx) => {
    return handleCatalog(_req, {
      async fetchCatalog() {
        const { data, error } = await ctx.supabaseAdmin.rpc(
          "active_powerup_catalog",
        );
        if (error) throw error;
        return ((data ?? []) as Array<{
          id: string;
          name: string;
          price_cents: number;
          on_chain_sku_id: number | null;
        }>).map((row) => ({
          id: row.id,
          name: row.name,
          priceCents: row.price_cents,
          onChainSkuId: row.on_chain_sku_id,
        }));
      },
    });
  }),
};

/* To invoke locally:

  curl 'http://127.0.0.1:54321/functions/v1/catalog' \
    --header 'apiKey: <anon-key>'

  Response: { skus: [{ id, name, priceCents, onChainSkuId }] }

*/
