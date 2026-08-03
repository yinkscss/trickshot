import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CELO_MAINNET_CHAIN_ID,
  CELO_SEPOLIA_CHAIN_ID,
  celoChainName,
  parseCeloChainId,
} from "./celo-network.ts";

describe("Edge Celo network configuration", () => {
  it("defaults to Celo Sepolia", () => {
    assert.equal(parseCeloChainId(), CELO_SEPOLIA_CHAIN_ID);
    assert.equal(celoChainName(CELO_SEPOLIA_CHAIN_ID), "Celo Sepolia");
  });

  it("accepts Celo mainnet", () => {
    assert.equal(parseCeloChainId(String(CELO_MAINNET_CHAIN_ID)), 42220);
    assert.equal(celoChainName(CELO_MAINNET_CHAIN_ID), "Celo Mainnet");
  });

  it("rejects the obsolete Alfajores chain ID", () => {
    assert.throws(() => parseCeloChainId("44787"), /Unsupported Celo chain ID/);
  });
});
