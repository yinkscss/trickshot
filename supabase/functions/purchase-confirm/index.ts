// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { requireAuth } from "../_shared/auth.ts";
import { handlePurchaseConfirm, type IntentRow, type ReceiptVerification } from "./handler.ts";
import { verifyPowerupReceipt } from "./receipt-verifier.ts";

/**
 * Purchase confirm — verify on-chain receipt + credit inventory (issue #9).
 *
 * POST /functions/v1/purchase-confirm
 * Headers: Authorization: Bearer <sessionJWT>, apiKey: <anonKey>
 * Body: { intentId, txHash, logIndex }
 *
 * Returns:
 *   200  { status: "confirmed", purchaseId, sku, quantity, newInventoryQuantity, idempotent }
 *   422  { error: "buyer_mismatch" | "sku_mismatch" | "amount_mismatch" | "receipt_invalid" }
 *
 * Idempotent: duplicate confirm for the same (txHash, logIndex) → 200, no double-credit.
 *
 * On-chain verification via the configured Celo RPC (CELO_RPC_URL env var).
 * Contract address: POWERUP_SHOP_ADDRESS env var.
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    return handlePurchaseConfirm(req, {
      requireAuth: (r) => requireAuth(r),
      now: () => Date.now(),

      async findExistingPurchase(txHash, logIndex) {
        const { data } = await ctx.supabaseAdmin
          .from("purchases")
          .select("id")
          .eq("tx_hash", txHash)
          .eq("log_index", logIndex)
          .maybeSingle();
        return data ? (data as { id: string }).id : null;
      },

      async getIntent(intentId): Promise<IntentRow | null> {
        const { data, error } = await ctx.supabaseAdmin
          .from("purchase_intents")
          .select(`
            id, user_id, sku, quantity, price_cents, status, expires_at,
            powerup_skus!inner(on_chain_sku_id),
            users!inner(wallet_address)
          `)
          .eq("id", intentId)
          .maybeSingle();

        if (error) throw error;
        if (!data) return null;

        const d = data as {
          id: string;
          user_id: string;
          sku: string;
          quantity: number;
          price_cents: number;
          status: "pending" | "confirmed" | "expired";
          expires_at: string;
          powerup_skus: { on_chain_sku_id: number | null };
          users: { wallet_address: string };
        };

        return {
          id: d.id,
          userId: d.user_id,
          sku: d.sku,
          quantity: d.quantity,
          priceCents: d.price_cents,
          onChainSkuId: d.powerup_skus.on_chain_sku_id,
          walletAddress: d.users.wallet_address,
          status: d.status,
          expiresAt: d.expires_at,
        };
      },

      async verifyReceipt(txHash, logIndex): Promise<ReceiptVerification> {
        const shopAddress = Deno.env.get("POWERUP_SHOP_ADDRESS") ?? "";
        const rpcUrl = Deno.env.get("CELO_RPC_URL") ?? "";
        if (!shopAddress || !rpcUrl) {
          throw new Error("POWERUP_SHOP_ADDRESS or CELO_RPC_URL not configured");
        }
        return verifyPowerupReceipt({ txHash, logIndex, shopAddress, rpcUrl });
      },

      async confirmPurchase({ intentId, userId, sku, quantity, priceCents, txHash, logIndex, paymentToken }) {
        // 1. Insert confirmed purchase (idempotency key: tx_hash + log_index)
        const { data: purchase, error: purchaseErr } = await ctx.supabaseAdmin
          .from("purchases")
          .insert({
            user_id: userId,
            sku,
            quantity,
            price_cents: priceCents,
            tx_hash: txHash,
            log_index: logIndex,
            payment_token: paymentToken,
            status: "confirmed",
          })
          .select("id")
          .single();

        if (purchaseErr || !purchase) throw purchaseErr ?? new Error("purchase insert failed");
        const purchaseId = (purchase as { id: string }).id;

        // 2. Upsert inventory (increment quantity)
        const { error: invErr } = await ctx.supabaseAdmin.rpc("increment_inventory", {
          p_user_id: userId,
          p_sku: sku,
          p_quantity: quantity,
        });
        if (invErr) throw invErr;

        // 3. Mark intent confirmed
        await ctx.supabaseAdmin
          .from("purchase_intents")
          .update({ status: "confirmed", tx_hash: txHash })
          .eq("id", intentId);

        // 4. Get updated quantity
        const { data: inv } = await ctx.supabaseAdmin
          .from("inventory")
          .select("quantity")
          .eq("user_id", userId)
          .eq("sku", sku)
          .maybeSingle();

        return {
          purchaseId,
          newQuantity: (inv as { quantity: number } | null)?.quantity ?? quantity,
        };
      },
    });
  }),
};

/* To invoke locally:

  1. npx supabase start && npx supabase db reset
  2. Get session JWT + create a purchase intent
   3. Broadcast the PowerupShop.buy() tx on the configured Celo network
  4. Get the txHash + logIndex from the receipt

  curl -i -X POST 'http://127.0.0.1:54321/functions/v1/purchase-confirm' \
    --header 'apiKey: <anon-key>' \
    --header 'Authorization: Bearer <sessionJWT>' \
    --header 'Content-Type: application/json' \
    --data '{"intentId":"...","txHash":"0x...","logIndex":0}'

*/
