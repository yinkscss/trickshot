/**
 * Tests for continue-intent handler (issue #52).
 * Run via: npm run test:edge
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { handleContinueIntent, type ContinueIntentDeps, type ContinueIntentRecord } from "./handler.ts";

const VALID_USER = { userId: "user-uuid-1" };
const MOCK_INTENT: ContinueIntentRecord = {
  id: "intent-uuid-1",
  runId: "run-uuid-1",
  mode: "casual",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
};

function makeDeps(overrides: Partial<ContinueIntentDeps> = {}): ContinueIntentDeps {
  return {
    requireAuth: async () => VALID_USER,
    insertIntent: async (_userId, mode, runId) => ({ ...MOCK_INTENT, mode, runId }),
    ...overrides,
  };
}

function makeRequest(body: unknown, method = "POST"): Request {
  return new Request("https://edge.example.com/functions/v1/continue-intent", {
    method,
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("handleContinueIntent — method guard", () => {
  it("returns 405 for GET", async () => {
    const res = await handleContinueIntent(new Request("https://example.com", { method: "GET" }), makeDeps());
    assert.equal(res.status, 405);
  });
});

describe("handleContinueIntent — auth", () => {
  it("returns 401 when requireAuth throws a Response", async () => {
    const deps = makeDeps({
      requireAuth: async () => { throw new Response(null, { status: 401 }); },
    });
    const res = await handleContinueIntent(makeRequest({ mode: "casual" }), deps);
    assert.equal(res.status, 401);
  });
});

describe("handleContinueIntent — body validation", () => {
  it("returns 400 for non-JSON body", async () => {
    const req = new Request("https://example.com", { method: "POST", body: "bad" });
    const res = await handleContinueIntent(req, makeDeps());
    assert.equal(res.status, 400);
  });

  it("returns 400 for invalid mode", async () => {
    const res = await handleContinueIntent(makeRequest({ mode: "invalid_mode" }), makeDeps());
    assert.equal(res.status, 400);
  });
});

describe("handleContinueIntent — mode enforcement", () => {
  it("returns 422 tournament_continues_forbidden for tournament mode", async () => {
    const res = await handleContinueIntent(makeRequest({ mode: "tournament" }), makeDeps());
    assert.equal(res.status, 422);
    const body = (await res.json()) as { error: string; mode: string };
    assert.equal(body.error, "tournament_continues_forbidden");
    assert.equal(body.mode, "tournament");
  });

  it("returns 422 continue_forbidden for challenges mode", async () => {
    const res = await handleContinueIntent(makeRequest({ mode: "challenges" }), makeDeps());
    assert.equal(res.status, 422);
    const body = (await res.json()) as { error: string; mode: string };
    assert.equal(body.error, "continue_forbidden");
    assert.equal(body.mode, "challenges");
  });

  it("succeeds for casual mode", async () => {
    const res = await handleContinueIntent(makeRequest({ mode: "casual" }), makeDeps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { intentId: string; mode: string };
    assert.equal(body.mode, "casual");
    assert.ok(body.intentId);
  });

  it("succeeds for daily mode", async () => {
    const res = await handleContinueIntent(makeRequest({ mode: "daily", runId: "run-1" }), makeDeps());
    assert.equal(res.status, 200);
    const body = (await res.json()) as { intentId: string; mode: string; runId?: string };
    assert.equal(body.mode, "daily");
    assert.equal(body.runId, "run-1");
  });
});
