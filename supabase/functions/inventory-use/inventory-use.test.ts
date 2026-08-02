/**
 * Tests for inventory-use handler (issue #9).
 * Run via: npm run test:edge
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleInventoryUse, type InventoryUseDeps } from "./handler.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_USER = { userId: "user-uuid-1" };
let loggedUse: object | null = null;

function makeDeps(overrides: Partial<InventoryUseDeps> = {}): InventoryUseDeps {
  return {
    requireAuth: async () => VALID_USER,
    decrementInventory: async (_userId, _sku, quantity) => Math.max(0, 5 - quantity),
    logUse: async (params) => { loggedUse = params; },
    ...overrides,
  };
}

function makeRequest(body: unknown, method = "POST"): Request {
  return new Request("https://edge.example.com/functions/v1/inventory-use", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return { sku: "slow_drop", quantity: 1, mode: "casual", ...overrides };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleInventoryUse — method guard", () => {
  it("returns 405 for GET", async () => {
    const req = new Request("https://example.com", { method: "GET" });
    const res = await handleInventoryUse(req, makeDeps());
    assert.equal(res.status, 405);
  });
});

describe("handleInventoryUse — auth", () => {
  it("returns 401 when requireAuth throws a Response", async () => {
    const deps = makeDeps({
      requireAuth: async () => { throw new Response(null, { status: 401 }); },
    });
    const res = await handleInventoryUse(makeRequest(baseBody()), deps);
    assert.equal(res.status, 401);
  });
});

describe("handleInventoryUse — body validation", () => {
  it("returns 400 for non-JSON body", async () => {
    const req = new Request("https://example.com", { method: "POST", body: "bad" });
    const res = await handleInventoryUse(req, makeDeps());
    assert.equal(res.status, 400);
  });

  it("returns 400 when sku is missing", async () => {
    const res = await handleInventoryUse(makeRequest({ quantity: 1, mode: "casual" }), makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "invalid_sku");
  });

  it("returns 400 when quantity is 0", async () => {
    const res = await handleInventoryUse(makeRequest(baseBody({ quantity: 0 })), makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "invalid_quantity");
  });

  it("returns 400 when quantity is negative", async () => {
    const res = await handleInventoryUse(makeRequest(baseBody({ quantity: -1 })), makeDeps());
    assert.equal(res.status, 400);
  });

  it("returns 400 when mode is invalid", async () => {
    const res = await handleInventoryUse(makeRequest(baseBody({ mode: "ranked" })), makeDeps());
    assert.equal(res.status, 400);
    assert.equal((await res.json() as { error: string }).error, "invalid_mode");
  });

  it("returns 400 when runId is not a string", async () => {
    const res = await handleInventoryUse(makeRequest(baseBody({ runId: 42 })), makeDeps());
    assert.equal(res.status, 400);
  });
});

describe("handleInventoryUse — mode enforcement", () => {
  it("returns 422 powerup_forbidden for tournament mode", async () => {
    const res = await handleInventoryUse(makeRequest(baseBody({ mode: "tournament" })), makeDeps());
    assert.equal(res.status, 422);
    const body = await res.json() as { error: string; mode: string };
    assert.equal(body.error, "powerup_forbidden");
    assert.equal(body.mode, "tournament");
  });

  it("does NOT call decrementInventory for tournament mode", async () => {
    let called = false;
    const deps = makeDeps({
      decrementInventory: async () => { called = true; return 0; },
    });
    await handleInventoryUse(makeRequest(baseBody({ mode: "tournament" })), deps);
    assert.equal(called, false);
  });

  it("allows casual mode", async () => {
    const res = await handleInventoryUse(makeRequest(baseBody({ mode: "casual" })), makeDeps());
    assert.equal(res.status, 200);
  });

  it("allows daily mode", async () => {
    const res = await handleInventoryUse(makeRequest(baseBody({ mode: "daily" })), makeDeps());
    assert.equal(res.status, 200);
  });

  it("returns 422 powerup_forbidden for challenges mode (powerups banned like tournament)", async () => {
    // mode-rules.ts: challenges.allowsPowerups = false
    // Challenges are designed without powerup assistance — same rule as tournament.
    const res = await handleInventoryUse(makeRequest(baseBody({ mode: "challenges" })), makeDeps());
    assert.equal(res.status, 422);
    const body = await res.json() as { error: string; mode: string };
    assert.equal(body.error, "powerup_forbidden");
    assert.equal(body.mode, "challenges");
  });
});

describe("handleInventoryUse — inventory checks", () => {
  it("returns 409 when decrementInventory throws insufficient_inventory", async () => {
    const deps = makeDeps({
      decrementInventory: async () => { throw new Error("insufficient_inventory: user=x sku=y requested=1 available=0"); },
    });
    const res = await handleInventoryUse(makeRequest(baseBody()), deps);
    assert.equal(res.status, 409);
    const body = await res.json() as { error: string; sku: string };
    assert.equal(body.error, "insufficient_inventory");
    assert.equal(body.sku, "slow_drop");
  });

  it("returns 409 when decrementInventory throws P0001", async () => {
    const err = new Error("P0001");
    (err as Error & { code?: string }).code = "P0001";
    const deps = makeDeps({
      decrementInventory: async () => { throw new Error("P0001 insufficient"); },
    });
    const res = await handleInventoryUse(makeRequest(baseBody()), deps);
    assert.equal(res.status, 409);
  });

  it("returns 500 for unexpected db errors", async () => {
    const deps = makeDeps({
      decrementInventory: async () => { throw new Error("connection refused"); },
    });
    const res = await handleInventoryUse(makeRequest(baseBody()), deps);
    assert.equal(res.status, 500);
  });
});

describe("handleInventoryUse — success", () => {
  it("returns 200 with status=used and remainingQuantity", async () => {
    const deps = makeDeps({ decrementInventory: async () => 4 });
    const res = await handleInventoryUse(makeRequest(baseBody()), deps);
    assert.equal(res.status, 200);
    const body = await res.json() as {
      status: string; sku: string; quantityUsed: number; remainingQuantity: number;
    };
    assert.equal(body.status, "used");
    assert.equal(body.sku, "slow_drop");
    assert.equal(body.quantityUsed, 1);
    assert.equal(body.remainingQuantity, 4);
  });

  it("passes the correct userId, sku, quantity to decrementInventory", async () => {
    let captured: { userId: string; sku: string; quantity: number } | null = null;
    const deps = makeDeps({
      requireAuth: async () => ({ userId: "user-abc" }),
      decrementInventory: async (userId, sku, quantity) => {
        captured = { userId, sku, quantity };
        return 2;
      },
    });
    await handleInventoryUse(makeRequest(baseBody({ sku: "aim_assist", quantity: 2 })), deps);
    assert.ok(captured !== null);
    assert.equal(captured!.userId, "user-abc");
    assert.equal(captured!.sku, "aim_assist");
    assert.equal(captured!.quantity, 2);
  });

  it("logs the use with correct params including runId", async () => {
    loggedUse = null;
    const deps = makeDeps({ decrementInventory: async () => 3 });
    await handleInventoryUse(
      makeRequest(baseBody({ runId: "run-uuid-1", mode: "daily" })),
      deps,
    );
    assert.ok(loggedUse !== null);
    const l = loggedUse as Record<string, unknown>;
    assert.equal(l["sku"], "slow_drop");
    assert.equal(l["quantity"], 1);
    assert.equal(l["runId"], "run-uuid-1");
    assert.equal(l["mode"], "daily");
  });

  it("succeeds even when logUse throws (best-effort audit)", async () => {
    const deps = makeDeps({
      decrementInventory: async () => 1,
      logUse: async () => { throw new Error("log write failed"); },
    });
    const res = await handleInventoryUse(makeRequest(baseBody()), deps);
    assert.equal(res.status, 200);
  });
});
