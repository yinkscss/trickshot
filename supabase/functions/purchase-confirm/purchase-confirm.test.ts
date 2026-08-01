/**
 * Tests for purchase-confirm handler (issue #9).
 * Run via: npm run test:edge
 *
 * The verifyReceipt dep is always mocked — no network calls needed.
 * Tests cover: idempotency, intent validation, buyer/sku/amount mismatch,
 * expired/already-confirmed intents, and the happy path.
 */

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import {
  handlePurchaseConfirm,
  type PurchaseConfirmDeps,
  type IntentRow,
  type ReceiptVerification,
  type ReceiptVerificationOk,
} from "./handler.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_TX_HASH = "0x" + "a".repeat(64);
const VALID_USER_ID = "user-uuid-1";
const VALID_WALLET = "0xabcdef1234567890abcdef1234567890abcdef12";
const INTENT_ID = "intent-uuid-1";

function makeIntent(overrides: Partial<IntentRow> = {}): IntentRow {
  return {
    id: INTENT_ID,
    userId: VALID_USER_ID,
    sku: "slow_drop",
    quantity: 1,
    priceCents: 79,
    onChainSkuId: 2,
    walletAddress: VALID_WALLET,
    status: "pending",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  };
}

function makeReceipt(overrides: Partial<ReceiptVerificationOk> = {}): ReceiptVerification {
  return {
    ok: true,
    buyer: VALID_WALLET,
    skuId: 2n,
    amount: 1n,
    paymentToken: "0xcUSD",
    logIndex: 0,
    ...overrides,
  };
}

let confirmedPurchase: object | null = null;

function makeDeps(overrides: Partial<PurchaseConfirmDeps> = {}): PurchaseConfirmDeps {
  return {
    requireAuth: async () => ({ userId: VALID_USER_ID }),
    findExistingPurchase: async () => null,
    getIntent: async () => makeIntent(),
    verifyReceipt: async () => makeReceipt(),
    confirmPurchase: async (params) => {
      confirmedPurchase = params;
      return { purchaseId: "purchase-uuid-1", newQuantity: params.quantity };
    },
    now: () => Date.now(),
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("https://edge.example.com/functions/v1/purchase-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return { intentId: INTENT_ID, txHash: VALID_TX_HASH, logIndex: 0, ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handlePurchaseConfirm — method guard", () => {
  it("returns 405 for GET", async () => {
    const req = new Request("https://example.com", { method: "GET" });
    const res = await handlePurchaseConfirm(req, makeDeps());
    assert.equal(res.status, 405);
  });
});

describe("handlePurchaseConfirm — auth", () => {
  it("returns 401 when requireAuth throws a Response", async () => {
    const deps = makeDeps({
      requireAuth: async () => { throw new Response(null, { status: 401 }); },
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 401);
  });
});

describe("handlePurchaseConfirm — body validation", () => {
  it("returns 400 for non-JSON body", async () => {
    const req = new Request("https://example.com", { method: "POST", body: "bad" });
    const res = await handlePurchaseConfirm(req, makeDeps());
    assert.equal(res.status, 400);
  });

  it("returns 400 when intentId is missing", async () => {
    const res = await handlePurchaseConfirm(makeRequest({ txHash: VALID_TX_HASH, logIndex: 0 }), makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "missing_intent_id");
  });

  it("returns 400 for invalid txHash format", async () => {
    const res = await handlePurchaseConfirm(makeRequest(baseBody({ txHash: "not-a-hash" })), makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "invalid_tx_hash");
  });

  it("returns 400 for negative logIndex", async () => {
    const res = await handlePurchaseConfirm(makeRequest(baseBody({ logIndex: -1 })), makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "invalid_log_index");
  });
});

describe("handlePurchaseConfirm — idempotency", () => {
  it("returns 200 idempotent=true when purchase already exists for (txHash, logIndex)", async () => {
    const deps = makeDeps({
      findExistingPurchase: async () => "existing-purchase-id",
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 200);
    const body = await res.json() as { idempotent: boolean; purchaseId: string };
    assert.equal(body.idempotent, true);
    assert.equal(body.purchaseId, "existing-purchase-id");
  });

  it("does NOT call confirmPurchase on idempotent hit", async () => {
    let called = false;
    const deps = makeDeps({
      findExistingPurchase: async () => "existing-id",
      confirmPurchase: async () => { called = true; return { purchaseId: "x", newQuantity: 1 }; },
    });
    await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(called, false);
  });
});

describe("handlePurchaseConfirm — intent validation", () => {
  it("returns 404 when intent does not exist", async () => {
    const deps = makeDeps({ getIntent: async () => null });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 404);
    assert.equal((await res.json() as { error: string }).error, "intent_not_found");
  });

  it("returns 404 when intent belongs to a different user (no info leak)", async () => {
    const deps = makeDeps({
      requireAuth: async () => ({ userId: "different-user" }),
      getIntent: async () => makeIntent({ userId: VALID_USER_ID }),
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 404);
    assert.equal((await res.json() as { error: string }).error, "intent_not_found");
  });

  it("returns 409 when intent is already confirmed", async () => {
    const deps = makeDeps({ getIntent: async () => makeIntent({ status: "confirmed" }) });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 409);
    assert.equal((await res.json() as { error: string }).error, "intent_already_confirmed");
  });

  it("returns 410 when intent is expired (status=expired)", async () => {
    const deps = makeDeps({ getIntent: async () => makeIntent({ status: "expired" }) });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 410);
    assert.equal((await res.json() as { error: string }).error, "intent_expired");
  });

  it("returns 410 when intent expiresAt is in the past", async () => {
    const deps = makeDeps({
      getIntent: async () => makeIntent({ expiresAt: new Date(Date.now() - 1000).toISOString() }),
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 410);
    assert.equal((await res.json() as { error: string }).error, "intent_expired");
  });

  it("returns 422 when sku has no onChainSkuId", async () => {
    const deps = makeDeps({ getIntent: async () => makeIntent({ onChainSkuId: null }) });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 422);
    assert.equal((await res.json() as { error: string }).error, "sku_not_on_chain");
  });
});

describe("handlePurchaseConfirm — receipt validation", () => {
  it("returns 502 when verifyReceipt throws (RPC unreachable)", async () => {
    const deps = makeDeps({
      verifyReceipt: async () => { throw new Error("network timeout"); },
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 502);
    assert.equal((await res.json() as { error: string }).error, "receipt_error");
  });

  it("returns 422 when receipt is not ok (tx reverted)", async () => {
    const deps = makeDeps({
      verifyReceipt: async (): Promise<ReceiptVerification> => ({ ok: false, reason: "tx reverted" }),
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 422);
    assert.equal((await res.json() as { error: string }).error, "receipt_invalid");
  });

  it("returns 422 when buyer address mismatches wallet (case-insensitive)", async () => {
    const deps = makeDeps({
      verifyReceipt: async () => makeReceipt({ buyer: "0x" + "b".repeat(40) }),
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 422);
    assert.equal((await res.json() as { error: string }).error, "buyer_mismatch");
  });

  it("accepts buyer address comparison case-insensitively", async () => {
    const deps = makeDeps({
      verifyReceipt: async () => makeReceipt({ buyer: VALID_WALLET.toUpperCase() }),
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 200);
  });

  it("returns 422 when skuId mismatches intent onChainSkuId", async () => {
    const deps = makeDeps({
      verifyReceipt: async () => makeReceipt({ skuId: 999n }),
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 422);
    assert.equal((await res.json() as { error: string }).error, "sku_mismatch");
  });

  it("returns 422 when amount mismatches intent quantity", async () => {
    const deps = makeDeps({
      verifyReceipt: async () => makeReceipt({ amount: 5n }),
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 422);
    assert.equal((await res.json() as { error: string }).error, "amount_mismatch");
  });
});

describe("handlePurchaseConfirm — success path", () => {
  beforeEach(() => { confirmedPurchase = null; });

  it("returns 200 confirmed with purchaseId and inventory quantity", async () => {
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), makeDeps());
    assert.equal(res.status, 200);
    const body = await res.json() as {
      status: string; purchaseId: string; sku: string;
      quantity: number; newInventoryQuantity: number; idempotent: boolean;
    };
    assert.equal(body.status, "confirmed");
    assert.equal(body.sku, "slow_drop");
    assert.equal(body.quantity, 1);
    assert.equal(body.idempotent, false);
    assert.ok(body.purchaseId);
    assert.ok(typeof body.newInventoryQuantity === "number");
  });

  it("calls confirmPurchase with correct parameters", async () => {
    await handlePurchaseConfirm(makeRequest(baseBody()), makeDeps());
    assert.ok(confirmedPurchase !== null, "confirmPurchase should have been called");
    const p = confirmedPurchase as Record<string, unknown>;
    assert.equal(p["intentId"], INTENT_ID);
    assert.equal(p["userId"], VALID_USER_ID);
    assert.equal(p["sku"], "slow_drop");
    assert.equal(p["quantity"], 1);
    assert.equal(p["txHash"], VALID_TX_HASH);
    assert.equal(p["logIndex"], 0);
    assert.equal(p["paymentToken"], "0xcUSD");
  });

  it("returns 500 when confirmPurchase throws", async () => {
    const deps = makeDeps({
      confirmPurchase: async () => { throw new Error("constraint violation"); },
    });
    const res = await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 500);
  });

  it("does not call confirmPurchase when receipt validation fails", async () => {
    let called = false;
    const deps = makeDeps({
      verifyReceipt: async (): Promise<ReceiptVerification> => ({ ok: false, reason: "bad" }),
      confirmPurchase: async () => { called = true; return { purchaseId: "x", newQuantity: 1 }; },
    });
    await handlePurchaseConfirm(makeRequest(baseBody()), deps);
    assert.equal(called, false);
  });
});
