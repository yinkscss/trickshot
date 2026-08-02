import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertCeloSepoliaChainId,
  CELO_SEPOLIA_CHAIN_ID,
  WrongNetworkError,
} from "./wallet.js";

describe("Celo Sepolia wallet guard", () => {
  it("accepts the locked Alpha chain", () => {
    assert.doesNotThrow(() => assertCeloSepoliaChainId(CELO_SEPOLIA_CHAIN_ID));
    assert.doesNotThrow(() => assertCeloSepoliaChainId(BigInt(CELO_SEPOLIA_CHAIN_ID)));
  });

  it("rejects a different chain with a typed error", () => {
    assert.throws(
      () => assertCeloSepoliaChainId(42220),
      (error: unknown) => {
        assert.ok(error instanceof WrongNetworkError);
        assert.equal(error.chainId, 42220);
        return true;
      },
    );
  });
});