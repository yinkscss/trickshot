/**
 * purchase-intent business logic (issue #9).
 *
 * Records the player's intent to purchase a powerup before the on-chain tx
 * is broadcast. Returns an intentId that the client passes back in
 * purchase-confirm after the tx is mined.
 *
 * Why intents exist:
 *   Without an intent, a malicious actor could observe another user's
 *   PowerupPurchased tx on-chain and call purchase-confirm with their own
 *   credentials. The intent anchors the purchase to a specific authenticated
 *   user BEFORE any tx is broadcast — purchase-confirm then verifies the
 *   caller owns that intent.
 *
 * All deps injected → testable in Node.
 */

export interface SkuRecord {
  id: string;
  name: string;
  priceCents: number;
  active: boolean;
}

export interface IntentRecord {
  id: string;
  sku: string;
  quantity: number;
  priceCents: number;
  expiresAt: string;
}

export interface PurchaseIntentDeps {
  requireAuth(req: Request): Promise<{ userId: string }>;
  /** Fetch a single SKU by id. Returns null if not found. */
  getSku(skuId: string): Promise<SkuRecord | null>;
  /** Insert a purchase_intent row. */
  insertIntent(
    userId: string,
    sku: string,
    quantity: number,
    priceCents: number,
  ): Promise<IntentRecord>;
}

export async function handlePurchaseIntent(
  req: Request,
  deps: PurchaseIntentDeps,
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

  const { sku, quantity } = body;

  if (typeof sku !== "string" || !sku) {
    return Response.json({ error: "invalid_sku" }, { status: 400 });
  }
  const qty = typeof quantity === "number" ? quantity : parseInt(String(quantity), 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return Response.json({ error: "invalid_quantity", detail: "quantity must be 1–99" }, { status: 400 });
  }

  // Validate SKU
  let skuRecord: SkuRecord | null;
  try {
    skuRecord = await deps.getSku(sku);
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }
  if (!skuRecord) {
    return Response.json({ error: "sku_not_found" }, { status: 404 });
  }
  if (!skuRecord.active) {
    return Response.json({ error: "sku_inactive" }, { status: 400 });
  }

  // Insert intent
  let intent: IntentRecord;
  try {
    intent = await deps.insertIntent(
      session.userId,
      sku,
      qty,
      skuRecord.priceCents * qty,
    );
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  return Response.json({
    intentId: intent.id,
    sku: intent.sku,
    quantity: intent.quantity,
    priceCents: intent.priceCents,
    expiresAt: intent.expiresAt,
  });
}
