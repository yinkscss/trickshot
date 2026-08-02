// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { requireAuth } from "../_shared/auth.ts";
import { handleInventoryUse } from "./handler.ts";
import type { GameMode } from "@trickshot/shared";

/**
 * Inventory use — consume powerup from user's inventory (issue #9).
 *
 * POST /functions/v1/inventory-use
 * Headers: Authorization: Bearer <sessionJWT>, apiKey: <anonKey>
 * Body: { sku: string, quantity: number, mode: GameMode, runId?: string }
 *
 * Returns:
 *   200  { status: "used", sku, quantityUsed, remainingQuantity }
 *   422  { error: "powerup_forbidden" }   — tournament mode
 *   409  { error: "insufficient_inventory" }
 *
 * STACK_LOCK: monetization=continue_powerup, TOURNAMENT_ALLOWS_POWERUPS=false.
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    return handleInventoryUse(req, {
      requireAuth: (r) => requireAuth(r),

      async decrementInventory(userId, sku, quantity) {
        const { data, error } = await ctx.supabaseAdmin.rpc("decrement_inventory", {
          p_user_id: userId,
          p_sku: sku,
          p_quantity: quantity,
        });
        if (error) throw error;
        return data as number;
      },

      async logUse({ userId, sku, quantity, runId, mode }) {
        await ctx.supabaseAdmin.from("inventory_use_log").insert({
          user_id: userId,
          sku,
          quantity,
          run_id: runId ?? null,
          mode: mode as GameMode,
        });
      },
    });
  }),
};

/* To invoke locally:

  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/inventory-use' \
    --header 'apiKey: <anon-key>' \
    --header 'Authorization: Bearer <sessionJWT>' \
    --header 'Content-Type: application/json' \
    --data '{"sku":"slow_drop","quantity":1,"mode":"casual","runId":"<uuid>"}'

  Tournament:
    --data '{"sku":"slow_drop","quantity":1,"mode":"tournament","runId":"<uuid>"}'
    → 422 powerup_forbidden

*/
