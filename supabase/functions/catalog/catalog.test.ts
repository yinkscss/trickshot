/**
 * Tests for catalog handler (issue #9).
 * Run via: npm run test:edge
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleCatalog, type CatalogDeps, type SkuRow } from "./handler.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSkus(): SkuRow[] {
  return [
    { id: "aim_assist", name: "Aim Assist", priceCents: 99, onChainSkuId: 1 },
    { id: "slow_drop", name: "Slow Drop", priceCents: 79, onChainSkuId: 2 },
    { id: "wide_hoop", name: "Wide Hoop", priceCents: 129, onChainSkuId: 3 },
    { id: "magnet_star", name: "Magnet Star", priceCents: 149, onChainSkuId: 4 },
  ];
}

function makeDeps(overrides: Partial<CatalogDeps> = {}): CatalogDeps {
  return {
    fetchCatalog: async () => makeSkus(),
    ...overrides,
  };
}

function makeRequest(method = "GET"): Request {
  return new Request("https://edge.example.com/functions/v1/catalog", { method });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleCatalog — method guard", () => {
  it("returns 405 for POST", async () => {
    const res = await handleCatalog(makeRequest("POST"), makeDeps());
    assert.equal(res.status, 405);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "method_not_allowed");
  });

  it("returns 405 for DELETE", async () => {
    const res = await handleCatalog(makeRequest("DELETE"), makeDeps());
    assert.equal(res.status, 405);
  });
});

describe("handleCatalog — success", () => {
  it("returns 200 with skus array", async () => {
    const res = await handleCatalog(makeRequest(), makeDeps());
    assert.equal(res.status, 200);
    const body = await res.json() as { skus: SkuRow[] };
    assert.ok(Array.isArray(body.skus), "body.skus should be an array");
    assert.equal(body.skus.length, 4);
  });

  it("returns correct sku shape", async () => {
    const res = await handleCatalog(makeRequest(), makeDeps());
    const body = await res.json() as { skus: SkuRow[] };
    const sku = body.skus[0]!;
    assert.ok("id" in sku);
    assert.ok("name" in sku);
    assert.ok("priceCents" in sku);
    assert.ok("onChainSkuId" in sku);
  });

  it("returns empty skus array when catalog is empty", async () => {
    const deps = makeDeps({ fetchCatalog: async () => [] });
    const res = await handleCatalog(makeRequest(), deps);
    assert.equal(res.status, 200);
    const body = await res.json() as { skus: SkuRow[] };
    assert.equal(body.skus.length, 0);
  });

  it("returns 500 when fetchCatalog throws", async () => {
    const deps = makeDeps({ fetchCatalog: async () => { throw new Error("DB down"); } });
    const res = await handleCatalog(makeRequest(), deps);
    assert.equal(res.status, 500);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "db_error");
  });

  it("all skus have numeric priceCents > 0", async () => {
    const res = await handleCatalog(makeRequest(), makeDeps());
    const body = await res.json() as { skus: SkuRow[] };
    for (const sku of body.skus) {
      assert.ok(typeof sku.priceCents === "number" && sku.priceCents > 0,
        `priceCents must be > 0, got ${sku.priceCents} for ${sku.id}`);
    }
  });

  it("includes onChainSkuId for all seeded skus", async () => {
    const res = await handleCatalog(makeRequest(), makeDeps());
    const body = await res.json() as { skus: SkuRow[] };
    for (const sku of body.skus) {
      assert.ok(sku.onChainSkuId !== null,
        `${sku.id} should have an onChainSkuId`);
    }
  });
});
