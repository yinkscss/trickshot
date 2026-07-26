import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { CELO_SEPOLIA_CHAIN_ID } from "@trickshot/shared";

describe("api scaffold", () => {
  it("targets Celo Sepolia for Alpha", () => {
    assert.equal(CELO_SEPOLIA_CHAIN_ID, 11142220);
  });
});
