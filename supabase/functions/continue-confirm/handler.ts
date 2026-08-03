/**
 * continue-confirm business logic (issue #52).
 *
 * Verifies on-chain ContinuePurchased receipt from ContinuePurchase contract
 * on the configured Celo network and credits continue entitlement for user / run.
 * Idempotent: duplicate confirm for the same (txHash, logIndex) returns 200 without double-crediting.
 * Legal & Mode enforcement: tournament mode always rejects (TOURNAMENT_ALLOWS_CONTINUES = false).
 *
 * All external deps injected -> testable in Node without RPC or DB.
 */

import { getModeRules } from "../../../packages/shared/dist/index.js";
import type { GameMode } from "../../../packages/shared/dist/index.js";

export interface ContinueIntentRow {
  id: string;
  userId: string;
  runId?: string;
  mode: GameMode;
  walletAddress: string;
  status: "pending" | "confirmed" | "expired";
  expiresAt: string;
}

export interface ContinueReceiptVerificationOk {
  ok: true;
  buyer: string;
  runIdHint: string;
  price: bigint;
  paymentToken: string;
  logIndex: number;
}

export interface ContinueReceiptVerificationFail {
  ok: false;
  reason: string;
}

export type ContinueReceiptVerification =
  | ContinueReceiptVerificationOk
  | ContinueReceiptVerificationFail;

export interface ContinueConfirmDeps {
  requireAuth(req: Request): Promise<{ userId: string; walletAddress?: string }>;
  getUserWallet(userId: string): Promise<string>;
  getIntent(intentId: string): Promise<ContinueIntentRow | null>;
  findExistingPurchase(txHash: string, logIndex: number): Promise<string | null>;
  verifyReceipt(txHash: string, logIndex: number): Promise<ContinueReceiptVerification>;
  confirmPurchase(params: {
    intentId?: string;
    userId: string;
    runId?: string;
    mode: GameMode;
    txHash: string;
    logIndex: number;
    paymentToken: string;
    price: string;
  }): Promise<{ continueId: string }>;
  now(): number;
}

const VALID_MODES: GameMode[] = ["casual", "daily", "tournament", "challenges"];

export async function handleContinueConfirm(
  req: Request,
  deps: ContinueConfirmDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  // Auth
  let session: { userId: string; walletAddress?: string };
  try {
    session = await deps.requireAuth(req);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // Body
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { intentId, runId, mode: rawMode, txHash, logIndex } = body;

  if (typeof txHash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
    return Response.json({ error: "invalid_tx_hash" }, { status: 400 });
  }
  const logIdx = typeof logIndex === "number" ? logIndex : parseInt(String(logIndex), 10);
  if (!Number.isInteger(logIdx) || logIdx < 0) {
    return Response.json({ error: "invalid_log_index" }, { status: 400 });
  }

  // Idempotency check — early return if already confirmed
  let existingContinueId: string | null;
  try {
    existingContinueId = await deps.findExistingPurchase(txHash, logIdx);
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }
  if (existingContinueId) {
    return Response.json({
      status: "confirmed",
      continueId: existingContinueId,
      idempotent: true,
    });
  }

  let effectiveMode: GameMode = (typeof rawMode === "string" && VALID_MODES.includes(rawMode as GameMode)) ? (rawMode as GameMode) : "casual";
  let effectiveRunId: string | undefined = typeof runId === "string" ? runId : undefined;
  let userWallet: string = session.walletAddress || "";

  // Intent validation if intentId provided
  if (typeof intentId === "string" && intentId) {
    let intent: ContinueIntentRow | null;
    try {
      intent = await deps.getIntent(intentId);
    } catch (err) {
      return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
    }
    if (!intent || intent.userId !== session.userId) {
      return Response.json({ error: "intent_not_found" }, { status: 404 });
    }
    if (intent.status === "confirmed") {
      return Response.json({ error: "intent_already_confirmed" }, { status: 409 });
    }
    if (intent.status === "expired" || new Date(intent.expiresAt) <= new Date(deps.now())) {
      return Response.json({ error: "intent_expired" }, { status: 410 });
    }

    effectiveMode = intent.mode;
    effectiveRunId = effectiveRunId || intent.runId;
    userWallet = userWallet || intent.walletAddress;
  }

  if (!userWallet) {
    try {
      userWallet = await deps.getUserWallet(session.userId);
    } catch (err) {
      return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
    }
  }

  // Mode & Legal Policy Checks
  if (effectiveMode === "tournament") {
    return Response.json(
      {
        error: "tournament_continues_forbidden",
        detail: "Continues are forbidden in tournament mode",
        mode: "tournament",
      },
      { status: 422 },
    );
  }

  const rules = getModeRules(effectiveMode);
  if (!rules.allowsContinues) {
    return Response.json(
      {
        error: "continue_forbidden",
        detail: `Continues are not allowed in ${effectiveMode} mode`,
        mode: effectiveMode,
      },
      { status: 422 },
    );
  }

  // Receipt Verification
  let verification: ContinueReceiptVerification;
  try {
    verification = await deps.verifyReceipt(txHash, logIdx);
  } catch (err) {
    return Response.json({ error: "receipt_error", detail: String(err) }, { status: 502 });
  }

  if (!verification.ok) {
    return Response.json(
      { error: "receipt_invalid", reason: verification.reason },
      { status: 422 },
    );
  }

  // Buyer validation (case-insensitive)
  if (verification.buyer.toLowerCase() !== userWallet.toLowerCase()) {
    return Response.json(
      {
        error: "buyer_mismatch",
        detail: `receipt buyer ${verification.buyer} != wallet ${userWallet}`,
      },
      { status: 422 },
    );
  }

  // Confirm Purchase
  let result: { continueId: string };
  try {
    result = await deps.confirmPurchase({
      intentId: typeof intentId === "string" ? intentId : undefined,
      userId: session.userId,
      runId: effectiveRunId,
      mode: effectiveMode,
      txHash,
      logIndex: logIdx,
      paymentToken: verification.paymentToken,
      price: verification.price.toString(),
    });
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  return Response.json({
    status: "confirmed",
    continueId: result.continueId,
    runId: effectiveRunId,
    mode: effectiveMode,
    idempotent: false,
  });
}
