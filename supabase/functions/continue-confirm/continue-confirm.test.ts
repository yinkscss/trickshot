/**
 * Tests for continue-confirm handler (issue #52).
 * Run via: npm run test:edge
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handleContinueConfirm,
  type ContinueConfirmDeps,
  type ContinueIntentRow,
  type ContinueReceiptVerification,
  type ContinueReceiptVerificationOk,
} from "./handler.ts";

const VALID_TX_HASH = "0x" + "a".repeat(64);
const VALID_USER_ID = "user-uuid-1";
const VALID_WALLET = "0xabcdef1234567890abcdef1234567890abcdef12";
const INTENT_ID = "intent-uuid-1";

function makeIntent(overrides: Partial<ContinueIntentRow> = {}): ContinueIntentRow {
  return {
    id: INTENT_ID,
    userId: VALID_USER_ID,
    runId: "run-uuid-1",
    mode: "casual",
    walletAddress: VALID_WALLET,
    status: "pending",
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    ...overrides,
  };
}

function makeReceipt(overrides: Partial<ContinueReceiptVerificationOk> = {}): ContinueReceiptVerification {
  return {
    ok: true,
    buyer: VALID_WALLET,
    runIdHint: "0x" + "0".repeat(64),
    price: 100000000000000000n,
    paymentToken: "0xcUSD",
    logIndex: 0,
    ...overrides,
  };
}

let confirmedParams: object | null = null;

function makeDeps(overrides: Partial<ContinueConfirmDeps> = {}): ContinueConfirmDeps {
  return {
    requireAuth: async () => ({ userId: VALID_USER_ID, walletAddress: VALID_WALLET }),
    getUserWallet: async () => VALID_WALLET,
    getIntent: async () => makeIntent(),
    findExistingPurchase: async () => null,
    verifyReceipt: async () => makeReceipt(),
    confirmPurchase: async (params) => {
      confirmedParams = params;
      return { continueId: "continue-uuid-1" };
    },
    now: () => Date.now(),
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("https://edge.example.com/functions/v1/continue-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function baseBody(overrides: Record<string, unknown> = {}) {
  return { intentId: INTENT_ID, txHash: VALID_TX_HASH, logIndex: 0, ...overrides };
}

describe("handleContinueConfirm — method guard", () => {
  it("returns 405 for GET", async () => {
    const res = await handleContinueConfirm(new Request("https://example.com", { method: "GET" }), makeDeps());
    assert.equal(res.status, 405);
  });
});

describe("handleContinueConfirm — auth", () => {
  it("returns 401 when requireAuth throws a Response", async () => {
    const deps = makeDeps({
      requireAuth: async () => { throw new Response(null, { status: 401 }); },
    });
    const res = await handleContinueConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 401);
  });
});

describe("handleContinueConfirm — body validation", () => {
  it("returns 400 for invalid txHash", async () => {
    const res = await handleContinueConfirm(makeRequest(baseBody({ txHash: "bad" })), makeDeps());
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: string }).error, "invalid_tx_hash");
  });

  it("returns 400 for negative logIndex", async () => {
    const res = await handleContinueConfirm(makeRequest(baseBody({ logIndex: -1 })), makeDeps());
    assert.equal(res.status, 400);
    assert.equal(((await res.json()) as { error: string }).error, "invalid_log_index");
  });
});

describe("handleContinueConfirm — idempotency", () => {
  it("returns 200 idempotent=true when purchase already exists for (txHash, logIndex)", async () => {
    const deps = makeDeps({
      findExistingPurchase: async () => "existing-continue-id",
    });
    const res = await handleContinueConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; continueId: string; idempotent: boolean };
    assert.equal(body.status, "confirmed");
    assert.equal(body.continueId, "existing-continue-id");
    assert.equal(body.idempotent, true);
  });
});

describe("handleContinueConfirm — mode & legal enforcement", () => {
  it("returns 422 tournament_continues_forbidden when mode is tournament", async () => {
    const deps = makeDeps({
      getIntent: async () => makeIntent({ mode: "tournament" }),
    });
    const res = await handleContinueConfirm(makeRequest(baseBody({ mode: "tournament" })), deps);
    assert.equal(res.status, 422);
    const body = (await res.json()) as { error: string; mode: string };
    assert.equal(body.error, "tournament_continues_forbidden");
    assert.equal(body.mode, "tournament");
  });

  it("returns 422 continue_forbidden when mode is challenges", async () => {
    const deps = makeDeps({
      getIntent: async () => makeIntent({ mode: "challenges" }),
    });
    const res = await handleContinueConfirm(makeRequest(baseBody({ mode: "challenges" })), deps);
    assert.equal(res.status, 422);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, "continue_forbidden");
  });
});

describe("handleContinueConfirm — receipt verification", () => {
  it("returns 502 when verifyReceipt throws", async () => {
    const deps = makeDeps({
      verifyReceipt: async () => { throw new Error("RPC error"); },
    });
    const res = await handleContinueConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 502);
    assert.equal(((await res.json()) as { error: string }).error, "receipt_error");
  });

  it("returns 422 when receipt is invalid", async () => {
    const deps = makeDeps({
      verifyReceipt: async () => ({ ok: false, reason: "tx reverted" }),
    });
    const res = await handleContinueConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 422);
    assert.equal(((await res.json()) as { error: string }).error, "receipt_invalid");
  });

  it("returns 422 buyer_mismatch when receipt buyer != user wallet", async () => {
    const deps = makeDeps({
      verifyReceipt: async () => makeReceipt({ buyer: "0x1111111111111111111111111111111111111111" }),
    });
    const res = await handleContinueConfirm(makeRequest(baseBody()), deps);
    assert.equal(res.status, 422);
    assert.equal(((await res.json()) as { error: string }).error, "buyer_mismatch");
  });
});

describe("handleContinueConfirm — success path", () => {
  it("returns 200 confirmed and calls confirmPurchase", async () => {
    confirmedParams = null;
    const res = await handleContinueConfirm(makeRequest(baseBody()), makeDeps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string; continueId: string; idempotent: boolean };
    assert.equal(body.status, "confirmed");
    assert.equal(body.continueId, "continue-uuid-1");
    assert.equal(body.idempotent, false);
    assert.ok(confirmedParams !== null);
  });
});
