/**
 * purchase-confirm business logic (issue #9).
 *
 * Verifies the on-chain PowerupPurchased receipt and credits the user's
 * inventory. Idempotent: duplicate confirm for the same (txHash, logIndex)
 * returns 200 without double-crediting.
 *
 * On-chain verification:
 *   - Fetch tx receipt from Celo Sepolia RPC
 *   - Find the PowerupPurchased log at logIndex
 *   - Validate: buyer === user's wallet, skuId === intent.onChainSkuId,
 *     amount === intent.quantity
 *   - Accept the tx regardless of payment_token (cUSD/USDC both OK for Alpha)
 *
 * All external deps injected → testable in Node without RPC or DB.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IntentRow {
  id: string;
  userId: string;
  sku: string;
  quantity: number;
  priceCents: number;
  onChainSkuId: number | null;
  walletAddress: string; // denormalized from users table for buyer check
  status: "pending" | "confirmed" | "expired";
  expiresAt: string;
}

export interface ReceiptVerificationOk {
  ok: true;
  buyer: string;        // checksummed address
  skuId: bigint;
  amount: bigint;
  paymentToken: string;
  logIndex: number;
}

export interface ReceiptVerificationFail {
  ok: false;
  reason: string;
}

export type ReceiptVerification = ReceiptVerificationOk | ReceiptVerificationFail;

export interface PurchaseConfirmDeps {
  requireAuth(req: Request): Promise<{ userId: string }>;
  /** Look up intent by ID. Returns null if not found. */
  getIntent(intentId: string): Promise<IntentRow | null>;
  /** Check if this (txHash, logIndex) was already confirmed. Returns purchaseId or null. */
  findExistingPurchase(txHash: string, logIndex: number): Promise<string | null>;
  /** Fetch and decode the PowerupPurchased event from the tx receipt. */
  verifyReceipt(txHash: string, logIndex: number): Promise<ReceiptVerification>;
  /**
   * Atomically: INSERT purchases (confirmed) + UPSERT inventory (+=quantity)
   * + UPDATE purchase_intents SET status='confirmed'.
   * Should throw on any failure.
   */
  confirmPurchase(params: {
    intentId: string;
    userId: string;
    sku: string;
    quantity: number;
    priceCents: number;
    txHash: string;
    logIndex: number;
    paymentToken: string;
  }): Promise<{ purchaseId: string; newQuantity: number }>;
  now(): number;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handlePurchaseConfirm(
  req: Request,
  deps: PurchaseConfirmDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  // Auth
  let session: { userId: string };
  try {
    session = await deps.requireAuth(req);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Body
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { intentId, txHash, logIndex } = body;

  if (typeof intentId !== "string" || !intentId) {
    return Response.json({ error: "missing_intent_id" }, { status: 400 });
  }
  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return Response.json({ error: "invalid_tx_hash" }, { status: 400 });
  }
  const logIdx = typeof logIndex === "number" ? logIndex : parseInt(String(logIndex), 10);
  if (!Number.isInteger(logIdx) || logIdx < 0) {
    return Response.json({ error: "invalid_log_index" }, { status: 400 });
  }

  // Idempotency check — early return if already confirmed
  let existingPurchaseId: string | null;
  try {
    existingPurchaseId = await deps.findExistingPurchase(txHash, logIdx);
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }
  if (existingPurchaseId) {
    // Already confirmed — return 200 idempotent
    return Response.json({
      status: "confirmed",
      purchaseId: existingPurchaseId,
      idempotent: true,
    });
  }

  // Intent validation
  let intent: IntentRow | null;
  try {
    intent = await deps.getIntent(intentId);
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }
  if (!intent) {
    return Response.json({ error: "intent_not_found" }, { status: 404 });
  }
  if (intent.userId !== session.userId) {
    // Don't reveal existence
    return Response.json({ error: "intent_not_found" }, { status: 404 });
  }
  if (intent.status === "confirmed") {
    return Response.json({ error: "intent_already_confirmed" }, { status: 409 });
  }
  if (intent.status === "expired" || new Date(intent.expiresAt) <= new Date(deps.now())) {
    return Response.json({ error: "intent_expired" }, { status: 410 });
  }
  if (intent.onChainSkuId === null) {
    return Response.json(
      { error: "sku_not_on_chain", detail: "SKU has no on-chain ID mapping" },
      { status: 422 },
    );
  }

  // On-chain receipt verification
  let verification: ReceiptVerification;
  try {
    verification = await deps.verifyReceipt(txHash, logIdx);
  } catch (err) {
    return Response.json(
      { error: "receipt_error", detail: String(err) },
      { status: 502 },
    );
  }
  if (!verification.ok) {
    return Response.json(
      { error: "receipt_invalid", reason: verification.reason },
      { status: 422 },
    );
  }

  // Validate decoded event against intent
  const buyerLower = verification.buyer.toLowerCase();
  const walletLower = intent.walletAddress.toLowerCase();
  if (buyerLower !== walletLower) {
    return Response.json(
      {
        error: "buyer_mismatch",
        detail: `receipt buyer ${buyerLower} ≠ wallet ${walletLower}`,
      },
      { status: 422 },
    );
  }
  if (verification.skuId !== BigInt(intent.onChainSkuId)) {
    return Response.json(
      {
        error: "sku_mismatch",
        detail: `receipt skuId ${verification.skuId} ≠ intent ${intent.onChainSkuId}`,
      },
      { status: 422 },
    );
  }
  if (verification.amount !== BigInt(intent.quantity)) {
    return Response.json(
      {
        error: "amount_mismatch",
        detail: `receipt amount ${verification.amount} ≠ intent ${intent.quantity}`,
      },
      { status: 422 },
    );
  }

  // Confirm: write purchase + credit inventory + mark intent confirmed
  let result: { purchaseId: string; newQuantity: number };
  try {
    result = await deps.confirmPurchase({
      intentId,
      userId: session.userId,
      sku: intent.sku,
      quantity: intent.quantity,
      priceCents: intent.priceCents,
      txHash,
      logIndex: logIdx,
      paymentToken: verification.paymentToken,
    });
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  return Response.json({
    status: "confirmed",
    purchaseId: result.purchaseId,
    sku: intent.sku,
    quantity: intent.quantity,
    newInventoryQuantity: result.newQuantity,
    idempotent: false,
  });
}
