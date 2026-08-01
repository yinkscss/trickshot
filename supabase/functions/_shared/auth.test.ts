/**
 * Tests for _shared/auth.ts — JWT sign/verify round-trips.
 *
 * Runs in Node.js via: node --import tsx --test auth.test.ts
 * `jose` is resolved through node_modules (added to root devDependencies).
 * RUN_SIGNING_SECRET is set via process.env before any import that calls getSecretBytes().
 */

// Must be set before importing auth.ts so getSecretBytes() finds the secret
process.env["RUN_SIGNING_SECRET"] = "test-signing-secret-must-be-32-chars!!";

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  signAccessToken,
  verifyAccessToken,
  requireAuth,
  SESSION_EXPIRY_SECONDS,
  type SessionPayload,
} from "./auth.ts";

const TEST_PAYLOAD: SessionPayload = {
  userId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  issuer: "did:ethr:0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  walletAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
};

describe("signAccessToken + verifyAccessToken", () => {
  it("round-trips a valid session payload", async () => {
    const token = await signAccessToken(TEST_PAYLOAD);
    assert.ok(typeof token === "string" && token.length > 0, "token should be a non-empty string");

    const decoded = await verifyAccessToken(token);
    assert.equal(decoded.userId, TEST_PAYLOAD.userId);
    assert.equal(decoded.issuer, TEST_PAYLOAD.issuer);
    assert.equal(decoded.walletAddress, TEST_PAYLOAD.walletAddress);
  });

  it("produces a JWT with three parts (header.payload.signature)", async () => {
    const token = await signAccessToken(TEST_PAYLOAD);
    const parts = token.split(".");
    assert.equal(parts.length, 3, "HS256 JWT should have exactly 3 parts");
  });

  it("rejects a token signed with a different secret", async () => {
    // Sign with current secret
    const token = await signAccessToken(TEST_PAYLOAD);

    // Tamper the payload to simulate a different secret
    const [header, , sig] = token.split(".");
    const tamperedPayload = Buffer.from(JSON.stringify({ userId: "evil", issuer: "evil", walletAddress: "evil", iss: "trickshot" })).toString("base64url");
    const tamperedToken = `${header}.${tamperedPayload}.${sig}`;

    await assert.rejects(
      () => verifyAccessToken(tamperedToken),
      (err: Error) => {
        assert.ok(err instanceof Error);
        return true;
      },
    );
  });

  it("rejects a token with an incorrect issuer claim", async () => {
    // Sign with wrong iss — create a token manually by signing with same secret but different iss
    // We simulate this by verifying a token signed by signAccessToken but checking
    // that the issuer claim IS enforced by verifyAccessToken's jwtVerify options.
    // Instead: use a raw jose call with wrong iss
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env["RUN_SIGNING_SECRET"]);
    const badToken = await new SignJWT({ userId: "x", issuer: "x", walletAddress: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("evil-issuer") // wrong issuer
      .setSubject("x")
      .setExpirationTime("1h")
      .sign(secret);

    await assert.rejects(() => verifyAccessToken(badToken));
  });

  it("rejects an expired token", async () => {
    // Sign with -2s expiry (already expired)
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(process.env["RUN_SIGNING_SECRET"]);
    const expiredToken = await new SignJWT({ userId: "x", issuer: "x", walletAddress: "x" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("trickshot")
      .setSubject("x")
      .setExpirationTime("-2s") // expired 2 seconds ago
      .sign(secret);

    await assert.rejects(() => verifyAccessToken(expiredToken));
  });
});

describe("requireAuth", () => {
  it("extracts and verifies a valid Bearer token", async () => {
    const token = await signAccessToken(TEST_PAYLOAD);
    const req = new Request("https://example.com/test", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const session = await requireAuth(req);
    assert.equal(session.userId, TEST_PAYLOAD.userId);
    assert.equal(session.walletAddress, TEST_PAYLOAD.walletAddress);
  });

  it("throws a 401 Response when Authorization header is missing", async () => {
    const req = new Request("https://example.com/test");
    await assert.rejects(
      () => requireAuth(req),
      (thrown: unknown) => {
        assert.ok(thrown instanceof Response, "should throw a Response");
        assert.equal((thrown as Response).status, 401);
        return true;
      },
    );
  });

  it("throws a 401 Response when the token is invalid", async () => {
    const req = new Request("https://example.com/test", {
      headers: { Authorization: "Bearer not-a-real-jwt" },
    });
    await assert.rejects(
      () => requireAuth(req),
      (thrown: unknown) => {
        assert.ok(thrown instanceof Response, "should throw a Response");
        assert.equal((thrown as Response).status, 401);
        return true;
      },
    );
  });

  it("throws a 401 Response when Authorization header has wrong scheme", async () => {
    const req = new Request("https://example.com/test", {
      headers: { Authorization: "Basic dXNlcjpwYXNz" },
    });
    await assert.rejects(() => requireAuth(req), (r: unknown) => {
      assert.ok(r instanceof Response && (r as Response).status === 401);
      return true;
    });
  });
});

describe("SESSION_EXPIRY_SECONDS", () => {
  it("is 3600 (1 hour)", () => {
    assert.equal(SESSION_EXPIRY_SECONDS, 3600);
  });
});
