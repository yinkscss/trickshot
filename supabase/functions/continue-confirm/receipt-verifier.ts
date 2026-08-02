/**
 * On-chain ContinuePurchased receipt verifier (issue #52).
 *
 * Fetches the tx receipt from Celo Sepolia and decodes the ContinuePurchased
 * event at the given log index. Isolated for testability.
 *
 * ContinuePurchased event signature (ContinuePurchase.sol):
 *   event ContinuePurchased(
 *     address indexed buyer,
 *     bytes32 indexed runIdHint,
 *     uint256 price,
 *     address paymentToken,
 *     uint64 ts
 *   );
 */

import type { ContinueReceiptVerification } from "./handler.ts";

const CONTINUE_PURCHASED_ABI = [
  {
    type: "event",
    name: "ContinuePurchased",
    inputs: [
      { name: "buyer", type: "address", indexed: true },
      { name: "runIdHint", type: "bytes32", indexed: true },
      { name: "price", type: "uint256", indexed: false },
      { name: "paymentToken", type: "address", indexed: false },
      { name: "ts", type: "uint64", indexed: false },
    ],
  },
] as const;

export interface VerifyContinueReceiptParams {
  txHash: string;
  logIndex: number;
  continueAddress: string;
  rpcUrl: string;
}

export async function verifyContinueReceipt(
  params: VerifyContinueReceiptParams,
): Promise<ContinueReceiptVerification> {
  const { txHash, logIndex, continueAddress, rpcUrl } = params;

  const { createPublicClient, http, decodeEventLog } = await import("viem");
  const { celoAlfajores } = await import("viem/chains");

  const chainId = parseInt(Deno.env.get("CELO_CHAIN_ID") ?? "44787", 10);
  const chain = chainId === 44787 ? celoAlfajores : celoAlfajores;

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
  });

  let receipt: Awaited<ReturnType<typeof client.getTransactionReceipt>>;
  try {
    receipt = await client.getTransactionReceipt({
      hash: txHash as `0x${string}`,
    });
  } catch (err) {
    return { ok: false, reason: `receipt fetch failed: ${String(err)}` };
  }

  if (receipt.status !== "success") {
    return { ok: false, reason: `tx reverted: status=${receipt.status}` };
  }

  const log = receipt.logs.find((l) => l.logIndex === logIndex);
  if (!log) {
    return { ok: false, reason: `no log at index ${logIndex}` };
  }

  if (log.address.toLowerCase() !== continueAddress.toLowerCase()) {
    return {
      ok: false,
      reason: `log address ${log.address} != ContinuePurchase ${continueAddress}`,
    };
  }

  let decoded: {
    eventName: string;
    args: {
      buyer: string;
      runIdHint: string;
      price: bigint;
      paymentToken: string;
      ts: bigint;
    };
  };
  try {
    decoded = decodeEventLog({
      abi: CONTINUE_PURCHASED_ABI,
      data: log.data,
      topics: log.topics,
    }) as typeof decoded;
  } catch (err) {
    return { ok: false, reason: `event decode failed: ${String(err)}` };
  }

  if (decoded.eventName !== "ContinuePurchased") {
    return { ok: false, reason: `unexpected event: ${decoded.eventName}` };
  }

  return {
    ok: true,
    buyer: decoded.args.buyer,
    runIdHint: decoded.args.runIdHint,
    price: decoded.args.price,
    paymentToken: decoded.args.paymentToken,
    logIndex,
  };
}
