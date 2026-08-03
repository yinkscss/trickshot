/**
 * On-chain PowerupPurchased receipt verifier (issue #9).
 *
 * Fetches the tx receipt from the configured Celo network and decodes the PowerupPurchased
 * event at the given log index. This module is the ONLY place in the codebase
 * that touches viem / makes RPC calls for the shop flow.
 *
 * Isolated from handler.ts so tests can inject a mock `verifyReceipt` dep
 * without any network access.
 *
 * PowerupPurchased event signature (PowerupShop.sol):
 *   event PowerupPurchased(
 *     address indexed buyer,
 *     uint256 indexed skuId,
 *     uint256 amount,
 *     uint256 unitPrice,
 *     uint256 totalPrice,
 *     address paymentToken,
 *     uint64 ts
 *   );
 */

import type { ReceiptVerification } from "./handler.ts";
import {
  celoChainName,
  parseCeloChainId,
} from "../_shared/celo-network.ts";

// PowerupPurchased ABI fragment — minimal, viem compatible
const POWERUP_PURCHASED_ABI = [
  {
    type: "event",
    name: "PowerupPurchased",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "skuId", type: "uint256", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "unitPrice", type: "uint256", indexed: false },
      { name: "totalPrice", type: "uint256", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
      { name: "ts", type: "uint64", indexed: false },
    ],
  },
] as const;

export interface VerifyReceiptParams {
  txHash: string;
  logIndex: number;
  shopAddress: string;
  rpcUrl: string;
}

export async function verifyPowerupReceipt(
  params: VerifyReceiptParams,
): Promise<ReceiptVerification> {
  const { txHash, logIndex, shopAddress, rpcUrl } = params;

  // Dynamic import of viem (resolved by the deno.json import map)
  // Dynamic import keeps this module tree-shakeable and avoids loading
  // viem in test contexts that mock this entire module.
  const { createPublicClient, http, decodeEventLog, defineChain } = await import("viem");
  const chainId = parseCeloChainId(Deno.env.get("CELO_CHAIN_ID"));
  const chain = defineChain({
    id: chainId,
    name: celoChainName(chainId),
    nativeCurrency: { name: "CELO", symbol: "CELO", decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  });

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  // Fetch the receipt
  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;
  try {
    const rpcChainId = await client.getChainId();
    if (rpcChainId !== chainId) {
      return {
        ok: false,
        reason: `RPC chain ID ${rpcChainId} does not match configured Celo chain ${chainId}`,
      };
    }
    receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
  } catch (err) {
    return { ok: false, reason: `receipt fetch failed: ${String(err)}` };
  }

  if (receipt.status !== "success") {
    return { ok: false, reason: `tx reverted: status=${receipt.status}` };
  }

  // Find the log at logIndex
  const log = receipt.logs.find((l) => l.logIndex === logIndex);
  if (!log) {
    return { ok: false, reason: `no log at index ${logIndex}` };
  }

  // Verify the log came from the PowerupShop contract
  if (log.address.toLowerCase() !== shopAddress.toLowerCase()) {
    return {
      ok: false,
      reason: `log address ${log.address} ≠ PowerupShop ${shopAddress}`,
    };
  }

  // Decode the event
  let decoded: {
    eventName: string;
    args: {
      buyer: string;
      skuId: bigint;
      amount: bigint;
      unitPrice: bigint;
      totalPrice: bigint;
      paymentToken: string;
      ts: bigint;
    };
  };
  try {
    decoded = decodeEventLog({
      abi: POWERUP_PURCHASED_ABI,
      data: log.data,
      topics: log.topics,
    }) as typeof decoded;
  } catch (err) {
    return { ok: false, reason: `event decode failed: ${String(err)}` };
  }

  if (decoded.eventName !== "PowerupPurchased") {
    return { ok: false, reason: `unexpected event: ${decoded.eventName}` };
  }

  return {
    ok: true,
    buyer: decoded.args.buyer,
    skuId: decoded.args.skuId,
    amount: decoded.args.amount,
    paymentToken: decoded.args.paymentToken,
    logIndex,
  };
}
