/**
 * Tests for purchase-intent handler (issue #9).
 * Run via: npm run test:edge
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handlePurchaseIntent,
  type PurchaseIntentDeps,
  type SkuRecord,
  type IntentRecord,
} from "./handler.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_USER = { userId: "user-uuid-1" };
const MOCK_INTENT: IntentRecord = {
  id: "intent-uuid-1",
  sku: "slow_drop",
  quantity: 1,
  priceCents: 79,
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

function makeActiveSku(overrides: Partial<SkuRecord> = {}): SkuRecord {
  return {
    id: "slow_drop",
    name: "Slow Drop",
    priceCents: 79,
    active: true,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<PurchaseIntentDeps> = {}): PurchaseIntentDeps {
  return {
    requireAuth: async () => VALID_USER,
    getSku: async () => makeActiveSku(),
    insertIntent: async () => MOCK_INTENT,
    ...overrides,
  };
}

function makeRequest(body: unknown, method = "POST"): Request {
  return new Request("https://edge.example.com/functions/v1/purchase-intent", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handlePurchaseIntent — method guard", () => {
  it("returns 405 for GET", async () => {
    const req = new Request("https://example.com", { method: "GET" });
    const res = await handlePurchaseIntent(req, makeDeps());
    assert.equal(res.status, 405);
  });
});

describe("handlePurchaseIntent — auth", () => {
  it("returns 401 when requireAuth throws a Response", async () => {
    const deps = makeDeps({
      requireAuth: async () => { throw new Response(null, { status: 401 }); },
    });
    const req = makeRequest({ sku: "slow_drop", quantity: 1 });
    const res = await handlePurchaseIntent(req, deps);
    assert.equal(res.status, 401);
  });
});

describe("handlePurchaseIntent — body validation", () => {
  it("returns 400 for non-JSON body", async () => {
    const req = new Request("https://example.com", {
      method: "POST",
      body: "not json",
    });
    const res = await handlePurchaseIntent(req, makeDeps());
    assert.equal(res.status, 400);
  });

  it("returns 400 when sku is missing", async () => {
    const req = makeRequest({ quantity: 1 });
    const res = await handlePurchaseIntent(req, makeDeps());
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "invalid_sku");
  });

  it("returns 400 when sku is empty string", async () => {
    const req = makeRequest({ sku: "", quantity: 1 });
    const res = await handlePurchaseIntent(req, makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "invalid_sku");
  });

  it("returns 400 when quantity is 0", async () => {
    const req = makeRequest({ sku: "slow_drop", quantity: 0 });
    const res = await handlePurchaseIntent(req, makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "invalid_quantity");
  });

  it("returns 400 when quantity is negative", async () => {
    const req = makeRequest({ sku: "slow_drop", quantity: -1 });
    const res = await handlePurchaseIntent(req, makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "invalid_quantity");
  });

  it("returns 400 when quantity exceeds 99", async () => {
    const req = makeRequest({ sku: "slow_drop", quantity: 100 });
    const res = await handlePurchaseIntent(req, makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "invalid_quantity");
  });
});

describe("handlePurchaseIntent — SKU validation", () => {
  it("returns 404 when SKU does not exist", async () => {
    const deps = makeDeps({ getSku: async () => null });
    const req = makeRequest({ sku: "nonexistent", quantity: 1 });
    const res = await handlePurchaseIntent(req, deps);
    assert.equal(res.status, 404);
    assert.equal((await res.json() as { error: string }).error, "sku_not_found");
  });

  it("returns 400 when SKU is inactive", async () => {
    const deps = makeDeps({ getSku: async () => makeActiveSku({ active: false }) });
    const req = makeRequest({ sku: "slow_drop", quantity: 1 });
    const res = await handlePurchaseIntent(req, deps);
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "sku_inactive");
  });

  it("returns 500 when getSku throws", async () => {
    const deps = makeDeps({ getSku: async () => { throw new Error("db timeout"); } });
    const req = makeRequest({ sku: "slow_drop", quantity: 1 });
    const res = await handlePurchaseIntent(req, deps);
    assert.equal(res.status, 500);
  });
});

describe("handlePurchaseIntent — success", () => {
  it("returns 200 with intentId for valid request", async () => {
    const req = makeRequest({ sku: "slow_drop", quantity: 1 });
    const res = await handlePurchaseIntent(req, makeDeps());
    assert.equal(res.status, 200);
    const body = await res.json() as {
      intentId: string; sku: string; quantity: number; priceCents: number; expiresAt: string;
    };
    assert.equal(body.intentId, MOCK_INTENT.id);
    assert.equal(body.sku, "slow_drop");
    assert.equal(body.quantity, 1);
    assert.equal(body.priceCents, 79);
    assert.ok(body.expiresAt);
  });

  it("passes the correct total priceCents to insertIntent (price * quantity)", async () => {
    let capturedPriceCents = 0;
    const deps = makeDeps({
      getSku: async () => makeActiveSku({ priceCents: 99 }),
      insertIntent: async (_userId, _sku, _qty, priceCents) => {
        capturedPriceCents = priceCents;
        return { ...MOCK_INTENT, priceCents };
      },
    });
    const req = makeRequest({ sku: "aim_assist", quantity: 3 });
    await handlePurchaseIntent(req, deps);
    assert.equal(capturedPriceCents, 99 * 3);
  });

  it("passes userId from requireAuth to insertIntent", async () => {
    let capturedUserId = "";
    const deps = makeDeps({
      requireAuth: async () => ({ userId: "user-xyz" }),
      insertIntent: async (userId, _sku, _qty, _price) => {
        capturedUserId = userId;
        return MOCK_INTENT;
      },
    });
    const req = makeRequest({ sku: "slow_drop", quantity: 1 });
    await handlePurchaseIntent(req, deps);
    assert.equal(capturedUserId, "user-xyz");
  });

  it("returns 500 when insertIntent throws", async () => {
    const deps = makeDeps({ insertIntent: async () => { throw new Error("insert failed"); } });
    const req = makeRequest({ sku: "slow_drop", quantity: 1 });
    const res = await handlePurchaseIntent(req, deps);
    assert.equal(res.status, 500);
  });

  it("accepts quantity=99 (upper bound)", async () => {
    const req = makeRequest({ sku: "slow_drop", quantity: 99 });
    const res = await handlePurchaseIntent(req, makeDeps());
    assert.equal(res.status, 200);
  });
});
