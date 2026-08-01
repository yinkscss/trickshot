/**
 * Tests for the auth-magic Edge Function handler (issue #7).
 *
 * Tests `handler.ts` directly with mocked dependencies — no Deno runtime,
 * no real Magic API calls, no real Supabase DB.
 *
 * Run via: node --import tsx --test auth-magic.test.ts
 * RUN_SIGNING_SECRET must be set before importing _shared/auth.ts (which
 * handler.ts imports transitively).
 */

// Set secrets before any module that calls getSecretBytes() is imported
process.env["RUN_SIGNING_SECRET"] = "test-signing-secret-must-be-32-chars!!";

import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { _resetRateLimitWindows } from "../_shared/rate-limit.ts";
import { signAccessToken, verifyAccessToken } from "../_shared/auth.ts";
import { handleAuthMagic, type AuthMagicDeps, type UserRow } from "./handler.ts";

// ---------------------------------------------------------------------------
// Mock builders
// ---------------------------------------------------------------------------

const MOCK_DID_TOKEN = "mock.did.token.for.testing";
const MOCK_ISSUER = "did:ethr:0xAAAA";
const MOCK_WALLET = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
const MOCK_USER_ID = "f47ac10b-58cc-4372-a567-0e02b2c3d479";

function mockUser(overrides: Partial<UserRow> = {}): UserRow {
  return {
    id: MOCK_USER_ID,
    magic_issuer: MOCK_ISSUER,
    wallet_address: MOCK_WALLET,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<AuthMagicDeps> = {}): AuthMagicDeps {
  return {
    magic: {
      token: {
        validate: (_didToken: string) => { /* valid — no-op */ },
        getIssuer: (_didToken: string) => MOCK_ISSUER,
      },
      users: {
        getMetadataByToken: async (_didToken: string) => ({
          publicAddress: MOCK_WALLET,
        }),
      },
    },
    upsertUser: async (_issuer: string, _wallet: string) => mockUser(),
    signToken: async (userId, issuer, walletAddress) =>
      signAccessToken({ userId, issuer, walletAddress }),
    rateLimitIp: (_ip: string) => true,  // allow by default
    rateLimitIssuer: (_issuer: string) => true,
    ...overrides,
  };
}

function makeRequest(body: unknown, overrides: RequestInit = {}): Request {
  return new Request("https://edge.supabase.co/functions/v1/auth-magic", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("handleAuthMagic — method guard", () => {
  it("returns 405 for GET requests", async () => {
    const req = new Request("https://example.com", { method: "GET" });
    const res = await handleAuthMagic(req, makeDeps());
    assert.equal(res.status, 405);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "method_not_allowed");
  });
});

describe("handleAuthMagic — rate limiting", () => {
  beforeEach(() => _resetRateLimitWindows());

  it("returns 429 when IP rate limit is exceeded", async () => {
    const req = makeRequest({ didToken: MOCK_DID_TOKEN });
    const res = await handleAuthMagic(
      req,
      makeDeps({ rateLimitIp: () => false }), // always rate-limited
    );
    assert.equal(res.status, 429);
    const body = await res.json() as { error: string; retryAfterMs: number };
    assert.equal(body.error, "rate_limited");
    assert.ok(typeof body.retryAfterMs === "number" && body.retryAfterMs > 0);
  });

  it("returns 429 when issuer rate limit is exceeded", async () => {
    const req = makeRequest({ didToken: MOCK_DID_TOKEN });
    const res = await handleAuthMagic(
      req,
      makeDeps({ rateLimitIssuer: () => false }), // always rate-limited
    );
    assert.equal(res.status, 429);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "rate_limited");
  });
});

describe("handleAuthMagic — request validation", () => {
  beforeEach(() => _resetRateLimitWindows());

  it("returns 400 when body is not valid JSON", async () => {
    const req = new Request("https://example.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json {{",
    });
    const res = await handleAuthMagic(req, makeDeps());
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "invalid_body");
  });

  it("returns 400 when didToken is missing", async () => {
    const req = makeRequest({});
    const res = await handleAuthMagic(req, makeDeps());
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "missing_did_token");
  });

  it("returns 400 when didToken is empty string", async () => {
    const req = makeRequest({ didToken: "" });
    const res = await handleAuthMagic(req, makeDeps());
    assert.equal(res.status, 400);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "missing_did_token");
  });

  it("returns 400 when didToken is not a string", async () => {
    const req = makeRequest({ didToken: 12345 });
    const res = await handleAuthMagic(req, makeDeps());
    assert.equal(res.status, 400);
  });
});

describe("handleAuthMagic — Magic DID verification", () => {
  beforeEach(() => _resetRateLimitWindows());

  it("returns 401 when magic.token.validate throws (invalid/expired token)", async () => {
    const req = makeRequest({ didToken: MOCK_DID_TOKEN });
    const deps = makeDeps({
      magic: {
        token: {
          validate: () => { throw new Error("DIDTokenExpired"); },
          getIssuer: () => MOCK_ISSUER,
        },
        users: { getMetadataByToken: async () => ({ publicAddress: MOCK_WALLET }) },
      },
    });
    const res = await handleAuthMagic(req, deps);
    assert.equal(res.status, 401);
    const body = await res.json() as { error: string; detail: string };
    assert.equal(body.error, "invalid_did_token");
    assert.ok(body.detail.includes("DIDTokenExpired"));
  });

  it("returns 401 when Magic metadata has no publicAddress (no wallet provisioned)", async () => {
    const req = makeRequest({ didToken: MOCK_DID_TOKEN });
    const deps = makeDeps({
      magic: {
        token: {
          validate: () => {},
          getIssuer: () => MOCK_ISSUER,
        },
        users: { getMetadataByToken: async () => ({ publicAddress: null }) },
      },
    });
    const res = await handleAuthMagic(req, deps);
    assert.equal(res.status, 401);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "no_wallet");
  });

  it("returns 502 when the Magic API call throws (network error)", async () => {
    const req = makeRequest({ didToken: MOCK_DID_TOKEN });
    const deps = makeDeps({
      magic: {
        token: { validate: () => {}, getIssuer: () => MOCK_ISSUER },
        users: {
          getMetadataByToken: async () => {
            throw new Error("fetch failed");
          },
        },
      },
    });
    const res = await handleAuthMagic(req, deps);
    assert.equal(res.status, 502);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "magic_api_error");
  });
});

describe("handleAuthMagic — DB upsert", () => {
  beforeEach(() => _resetRateLimitWindows());

  it("returns 500 when upsertUser throws", async () => {
    const req = makeRequest({ didToken: MOCK_DID_TOKEN });
    const deps = makeDeps({
      upsertUser: async () => { throw new Error("connection refused"); },
    });
    const res = await handleAuthMagic(req, deps);
    assert.equal(res.status, 500);
    const body = await res.json() as { error: string };
    assert.equal(body.error, "db_error");
  });
});

describe("handleAuthMagic — success path", () => {
  beforeEach(() => _resetRateLimitWindows());

  it("returns 200 with userId, walletAddress, accessToken, expiresIn on fresh login", async () => {
    const req = makeRequest({ didToken: MOCK_DID_TOKEN });
    const res = await handleAuthMagic(req, makeDeps());
    assert.equal(res.status, 200);

    const body = await res.json() as {
      userId: string;
      walletAddress: string;
      accessToken: string;
      expiresIn: number;
    };
    assert.equal(body.userId, MOCK_USER_ID);
    assert.equal(body.walletAddress, MOCK_WALLET);
    assert.ok(typeof body.accessToken === "string" && body.accessToken.length > 0);
    assert.equal(body.expiresIn, 3600);
  });

  it("accessToken is a verifiable HS256 JWT containing the correct claims", async () => {
    const req = makeRequest({ didToken: MOCK_DID_TOKEN });
    const res = await handleAuthMagic(req, makeDeps());
    const { accessToken } = await res.json() as { accessToken: string };

    const session = await verifyAccessToken(accessToken);
    assert.equal(session.userId, MOCK_USER_ID);
    assert.equal(session.issuer, MOCK_ISSUER);
    assert.equal(session.walletAddress, MOCK_WALLET);
  });

  it("is idempotent — same issuer with updated wallet upserts correctly", async () => {
    const newWallet = "0xNewWalletAddr";
    let captured: { issuer: string; walletAddress: string } | null = null;

    const deps = makeDeps({
      upsertUser: async (issuer, walletAddress) => {
        captured = { issuer, walletAddress };
        return mockUser({ wallet_address: walletAddress });
      },
      magic: {
        token: { validate: () => {}, getIssuer: () => MOCK_ISSUER },
        users: { getMetadataByToken: async () => ({ publicAddress: newWallet }) },
      },
    });

    const req = makeRequest({ didToken: MOCK_DID_TOKEN });
    const res = await handleAuthMagic(req, deps);
    assert.equal(res.status, 200);
    assert.ok(captured !== null, "upsertUser should have been called");
    assert.equal(captured!.issuer, MOCK_ISSUER);
    assert.equal(captured!.walletAddress, newWallet);

    const { walletAddress } = await res.json() as { walletAddress: string };
    assert.equal(walletAddress, newWallet);
  });

  it("wallet address comes from Magic metadata, not from the client body", async () => {
    // Even if the client somehow sent a wallet in the body (which our schema
    // doesn't accept), the handler always uses Magic's verified publicAddress.
    let capturedWallet: string | null = null;
    const deps = makeDeps({
      upsertUser: async (_issuer, walletAddress) => {
        capturedWallet = walletAddress;
        return mockUser({ wallet_address: walletAddress });
      },
    });

    // Passing extra fields in body — they must be ignored
    const req = makeRequest({
      didToken: MOCK_DID_TOKEN,
      walletAddress: "0xEvilClientReportedWallet",
    });
    await handleAuthMagic(req, deps);
    // Wallet must come from mock magic metadata (MOCK_WALLET), not from body
    assert.equal(capturedWallet, MOCK_WALLET);
  });
});
