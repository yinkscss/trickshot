import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  rateLimitByKey,
  rateLimitByIp,
  rateLimitByIssuer,
  _resetRateLimitWindows,
} from "./rate-limit.ts";

describe("rateLimitByKey", () => {
  before(() => _resetRateLimitWindows());
  after(() => _resetRateLimitWindows());

  it("allows up to maxRequests within the window", () => {
    for (let i = 0; i < 5; i++) {
      assert.equal(rateLimitByKey("test-key-1", 5, 60_000), true, `request ${i + 1} should be allowed`);
    }
  });

  it("blocks the request that exceeds maxRequests", () => {
    // First 5 already consumed above — 6th should be blocked
    assert.equal(rateLimitByKey("test-key-1", 5, 60_000), false);
  });

  it("uses separate counters for different keys", () => {
    // Different key — fresh counter
    assert.equal(rateLimitByKey("test-key-2", 3, 60_000), true);
    assert.equal(rateLimitByKey("test-key-2", 3, 60_000), true);
    assert.equal(rateLimitByKey("test-key-2", 3, 60_000), true);
    assert.equal(rateLimitByKey("test-key-2", 3, 60_000), false); // 4th blocked
  });

  it("expires timestamps outside the window", () => {
    // Use a 0ms window so all previous timestamps are immediately expired
    // Calling with 0ms window = every call starts fresh
    assert.equal(rateLimitByKey("test-key-3", 1, 0), true);  // allowed (old ones expired)
    assert.equal(rateLimitByKey("test-key-3", 1, 0), true);  // allowed (previous expired too)
  });
});

describe("rateLimitByIp", () => {
  before(() => _resetRateLimitWindows());
  after(() => _resetRateLimitWindows());

  it("allows 10 requests from an IP", () => {
    for (let i = 0; i < 10; i++) {
      assert.equal(rateLimitByIp("1.2.3.4"), true, `request ${i + 1} should be allowed`);
    }
  });

  it("blocks the 11th request from the same IP", () => {
    assert.equal(rateLimitByIp("1.2.3.4"), false);
  });

  it("is independent per IP", () => {
    // Different IP — fresh counter
    assert.equal(rateLimitByIp("5.6.7.8"), true);
  });
});

describe("rateLimitByIssuer", () => {
  before(() => _resetRateLimitWindows());
  after(() => _resetRateLimitWindows());

  it("allows 5 requests per issuer", () => {
    const did = "did:ethr:0xABC123";
    for (let i = 0; i < 5; i++) {
      assert.equal(rateLimitByIssuer(did), true, `request ${i + 1} should be allowed`);
    }
    assert.equal(rateLimitByIssuer(did), false, "6th request should be blocked");
  });
});

describe("_resetRateLimitWindows", () => {
  it("clears all counters", () => {
    rateLimitByKey("reset-test", 1, 60_000); // consume limit
    assert.equal(rateLimitByKey("reset-test", 1, 60_000), false); // blocked
    _resetRateLimitWindows();
    assert.equal(rateLimitByKey("reset-test", 1, 60_000), true);  // allowed after reset
  });
});
