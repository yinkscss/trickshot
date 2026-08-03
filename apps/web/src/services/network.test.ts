import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CELO_MAINNET_RPC_URL,
  CELO_SEPOLIA_CHAIN_ID,
  CELO_SEPOLIA_RPC_URL,
  resolveCeloNetworkConfig,
} from "./network.js";

describe("Celo network configuration", () => {
  it("defaults to Celo Sepolia", () => {
    assert.deepEqual(resolveCeloNetworkConfig(), {
      chainId: CELO_SEPOLIA_CHAIN_ID,
      name: "Celo Sepolia",
      rpcUrl: CELO_SEPOLIA_RPC_URL,
      explorerUrl: "https://celo-sepolia.blockscout.com",
    });
  });

  it("selects Celo mainnet from the configured chain ID", () => {
    assert.deepEqual(resolveCeloNetworkConfig("42220"), {
      chainId: 42220,
      name: "Celo Mainnet",
      rpcUrl: CELO_MAINNET_RPC_URL,
      explorerUrl: "https://celoscan.io",
    });
  });

  it("allows a custom RPC URL", () => {
    assert.equal(
      resolveCeloNetworkConfig("42220", "https://rpc.example.test").rpcUrl,
      "https://rpc.example.test",
    );
  });

  it("rejects unsupported chain IDs", () => {
    assert.throws(
      () => resolveCeloNetworkConfig("1"),
      /Unsupported Celo chain ID 1/,
    );
  });
});
