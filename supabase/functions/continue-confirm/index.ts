// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { requireAuth } from "../_shared/auth.ts";
import { handleContinueConfirm, type ContinueIntentRow, type ContinueReceiptVerification } from "./handler.ts";
import { verifyContinueReceipt } from "./receipt-verifier.ts";
import type { GameMode } from "@trickshot/shared";

/**
 * Continue confirm — verify on-chain receipt & credit continue purchase (issue #52).
 *
 * POST /functions/v1/continue-confirm
 * Headers: Authorization: Bearer <sessionJWT>, apiKey: <anonKey>
 * Body: { intentId?, runId?, mode?, txHash, logIndex }
 */
export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    return handleContinueConfirm(req, {
      requireAuth: (r) => requireAuth(r),
      now: () => Date.now(),

      async getUserWallet(userId): Promise<string> {
        const { data, error } = await ctx.supabaseAdmin
          .from("users")
          .select("wallet_address")
          .eq("id", userId)
          .single();
        if (error || !data) throw error ?? new Error("user wallet not found");
        return (data as { wallet_address: string }).wallet_address;
      },

      async findExistingPurchase(txHash, logIndex): Promise<string | null> {
        const { data } = await ctx.supabaseAdmin
          .from("continue_purchases")
          .select("id")
          .eq("tx_hash", txHash)
          .eq("log_index", logIndex)
          .maybeSingle();
        return data ? (data as { id: string }).id : null;
      },

      async getIntent(intentId): Promise<ContinueIntentRow | null> {
        const { data, error } = await ctx.supabaseAdmin
          .from("continue_intents")
          .select(`
            id, user_id, run_id, mode, status, expires_at,
            users!inner(wallet_address)
          `)
          .eq("id", intentId)
          .maybeSingle();

        if (error || !data) return null;

        const d = data as {
          id: string;
          user_id: string;
          run_id: string | null;
          mode: string;
          status: "pending" | "confirmed" | "expired";
          expires_at: string;
          users: { wallet_address: string };
        };

        return {
          id: d.id,
          userId: d.user_id,
          runId: d.run_id ?? undefined,
          mode: d.mode as GameMode,
          walletAddress: d.users.wallet_address,
          status: d.status,
          expiresAt: d.expires_at,
        };
      },

      async verifyReceipt(txHash, logIndex): Promise<ContinueReceiptVerification> {
        const continueAddress = Deno.env.get("CONTINUE_PURCHASE_ADDRESS") || "";
        const rpcUrl = Deno.env.get("CELO_RPC_URL") ?? "";
        if (!continueAddress || !rpcUrl) {
          throw new Error("CONTINUE_PURCHASE_ADDRESS or CELO_RPC_URL not configured");
        }
        return verifyContinueReceipt({ txHash, logIndex, continueAddress, rpcUrl });
      },

      async confirmPurchase({ intentId, userId, runId, mode, txHash, logIndex, paymentToken, price }) {
        const { data, error } = await ctx.supabaseAdmin.rpc("confirm_continue_purchase", {
          p_intent_id: intentId ?? null,
          p_user_id: userId,
          p_run_id: runId ?? null,
          p_mode: mode,
          p_tx_hash: txHash,
          p_log_index: logIndex,
          p_payment_token: paymentToken,
          p_price: price,
        });

        if (error || !data) throw error ?? new Error("confirm_continue_purchase failed");
        return { continueId: String(data) };
      },
    });
  }),
};
