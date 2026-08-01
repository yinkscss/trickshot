/**
 * Tests for runs-start handler (issue #8).
 * Run via: npm run test:edge
 */

process.env["RUN_SIGNING_SECRET"] = "test-signing-secret-must-be-32-chars!!";

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { signAccessToken } from "../_shared/auth.ts";
import { handleRunsStart, type RunsStartDeps, type NonceRow } from "./handler.ts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_USER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
const MOCK_RUN_ID = "a1b2c3d4-0000-0000-0000-000000000001";
const MOCK_SEED = "2026-07-29";

async function makeAuth(): Promise<string> {
  return signAccessToken({
    userId: MOCK_USER_ID,
    issuer: "did:ethr:0xAAAA",
    walletAddress: "0xAAAA",
  });
}

function makeRequest(body: unknown, token?: string): Request {
  return new Request("https://edge.example.com/functions/v1/runs-start", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeDeps(overrides: Partial<RunsStartDeps> = {}): RunsStartDeps {
  return {
    requireAuth: async () => ({ userId: MOCK_USER_ID }),
    resolveSeed: (_mode, _tid) => MOCK_SEED,
    insertNonce: async (userId, mode, seed): Promise<NonceRow> => ({
      id: MOCK_RUN_ID,
      seed,
      mode,
      expiresAt: new Date(Date.now() + 7200_000).toISOString(),
    }),
    now: () => 1754000000000,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleRunsStart — method guard", () => {
  it("returns 405 for GET", async () => {
    const req = new Request("https://example.com", { method: "GET" });
    const res = await handleRunsStart(req, makeDeps());
    assert.equal(res.status, 405);
  });
});

describe("handleRunsStart — auth", () => {
  it("returns 401 when requireAuth throws a Response", async () => {
    const req = makeRequest({ mode: "casual" });
    const deps = makeDeps({
      requireAuth: async () => { throw Response.json({ error: "unauthorized" }, { status: 401 }); },
    });
    const res = await handleRunsStart(req, deps);
    assert.equal(res.status, 401);
  });
});

describe("handleRunsStart — body validation", () => {
  it("returns 400 for non-JSON body", async () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const res = await handleRunsStart(req, makeDeps());
    assert.equal(res.status, 400);
  });

  it("returns 400 for invalid mode", async () => {
    const req = makeRequest({ mode: "ranked" });
    const res = await handleRunsStart(req, makeDeps());
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "invalid_mode");
  });

  it("returns 400 for tournament without tournamentId", async () => {
    const req = makeRequest({ mode: "tournament" });
    const res = await handleRunsStart(req, makeDeps());
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "tournament_id_required");
  });
});

describe("handleRunsStart — success", () => {
  for (const mode of ["casual", "daily", "challenges"] as const) {
    it(`returns 200 with runId/seed/mode for ${mode}`, async () => {
      const req = makeRequest({ mode });
      const res = await handleRunsStart(req, makeDeps());
      assert.equal(res.status, 200);
      const body = await res.json() as {
        runId: string; seed: string; mode: string; serverTime: number;
      };
      assert.equal(body.runId, MOCK_RUN_ID);
      assert.equal(body.seed, MOCK_SEED);
      assert.equal(body.mode, mode);
      assert.ok(typeof body.serverTime === "number");
    });
  }

  it("passes tournamentId to resolveSeed for tournament mode", async () => {
    let capturedTid: string | undefined;
    const deps = makeDeps({
      resolveSeed: (_mode, tid) => { capturedTid = tid; return "tournament-seed"; },
    });
    const req = makeRequest({ mode: "tournament", tournamentId: "event-001" });
    const res = await handleRunsStart(req, deps);
    assert.equal(res.status, 200);
    assert.equal(capturedTid, "event-001");
  });

  it("returns 500 when insertNonce throws", async () => {
    const deps = makeDeps({
      insertNonce: async () => { throw new Error("DB timeout"); },
    });
    const req = makeRequest({ mode: "casual" });
    const res = await handleRunsStart(req, deps);
    assert.equal(res.status, 500);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "db_error");
  });
});
