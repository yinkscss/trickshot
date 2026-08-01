/**
 * runs-finish business logic (issue #8).
 *
 * Accepts a RunSummary + InputLog from the client, runs the hybrid replay
 * verifier, and persists the result to `public.runs` as 'verified' or
 * 'rejected'.
 *
 * Anti-cheat strategy (Option A — approved):
 *   `chainLength` and `continuesUsed` from the server replay are authoritative.
 *   We do NOT require `replayScore === clientScore` because the replay always
 *   uses `quality: "bank"` for every dunk (wall/rim flags are not stored in the
 *   log). Instead, we verify:
 *   1. Replay continuesUsed === summary.continuesUsed
 *   2. Replay chainLength >= 0 (replay ran to completion — dunks happened if > 0)
 *   3. No forbidden events in the log (validateInputLog catches these)
 *   4. Tournament/challenges: replayContinuesUsed === 0 + powerupsUsed empty
 *
 * Truncated log policy (approved):
 *   - casual/daily: accept with partial replay (replay covers what was recorded)
 *   - tournament/challenges: reject (full log required for integrity)
 *
 * All external dependencies are injected → pure handler, testable in Node.
 */

import type { GameMode, RunSummary, InputLog } from "../../../packages/shared/dist/index.js";
import { getModeRules } from "../../../packages/shared/dist/index.js";
import { replayRunFromInputLog, type ReplayRunResult } from "../../../packages/logic/dist/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NonceRecord {
  id: string;
  userId: string;
  mode: GameMode;
  seed: string;
  expiresAt: string; // ISO string
  used: boolean;
}

export interface RunRecord {
  id: string;
}

export interface RunsFinishDeps {
  requireAuth(req: Request): Promise<{ userId: string }>;
  /** Look up nonce by ID. Returns null if not found. Throws on DB error. */
  getNonce(runId: string): Promise<NonceRecord | null>;
  /** Atomically mark nonce as used. Throws if already used (idempotency guard). */
  markNonceUsed(runId: string): Promise<void>;
  /** Insert a run row. Throws on DB error. */
  insertRun(row: {
    id: string;
    userId: string;
    mode: GameMode;
    score: number;
    chainLength: number;
    seed: string;
    continuesUsed: number;
    status: "verified" | "rejected";
    rejectReason?: string;
    inputLog?: InputLog;
  }): Promise<RunRecord>;
  /** Current physics build ID — injected so tests can override. */
  physicsBuildId: string;
  /** Wall-clock ms. */
  now(): number;
  /** Prune old used/expired nonces (best-effort cleanup, non-blocking). */
  pruneNonces(userId: string): Promise<void>;
}

// ---------------------------------------------------------------------------
// Body schema
// ---------------------------------------------------------------------------

const VALID_MODES: GameMode[] = ["casual", "daily", "tournament", "challenges"];

function parseBody(raw: unknown): { summary: RunSummary; runId: string } | string {
  if (typeof raw !== "object" || raw === null) return "body must be an object";
  const b = raw as Record<string, unknown>;

  if (typeof b["runId"] !== "string" || !b["runId"])
    return "missing runId";
  if (typeof b["mode"] !== "string" || !VALID_MODES.includes(b["mode"] as GameMode))
    return "invalid mode";
  if (typeof b["score"] !== "number" || b["score"] < 0 || !Number.isFinite(b["score"]))
    return "invalid score";
  if (typeof b["chainLength"] !== "number" || b["chainLength"] < 0 || !Number.isFinite(b["chainLength"]))
    return "invalid chainLength";
  if (typeof b["continuesUsed"] !== "number" || b["continuesUsed"] < 0)
    return "invalid continuesUsed";
  if (typeof b["seed"] !== "string" || !b["seed"])
    return "missing seed";
  if (!Array.isArray(b["powerupsUsed"]))
    return "powerupsUsed must be an array";
  if (typeof b["stars"] !== "number" || b["stars"] < 0)
    return "invalid stars";

  const summary: RunSummary = {
    mode: b["mode"] as GameMode,
    score: b["score"] as number,
    chainLength: b["chainLength"] as number,
    continuesUsed: b["continuesUsed"] as number,
    seed: b["seed"] as string,
    stars: b["stars"] as number,
    powerupsUsed: b["powerupsUsed"] as string[],
    ...(b["inputLog"] !== undefined ? { inputLog: b["inputLog"] as InputLog } : {}),
  };

  return { summary, runId: b["runId"] as string };
}

// ---------------------------------------------------------------------------
// Rejection helper
// ---------------------------------------------------------------------------

async function rejectRun(
  deps: RunsFinishDeps,
  params: {
    runId: string;
    userId: string;
    mode: GameMode;
    seed: string;
    score: number;
    chainLength: number;
    continuesUsed: number;
    inputLog?: InputLog;
    reason: string;
  },
): Promise<Response> {
  try {
    await deps.insertRun({
      id: params.runId,
      userId: params.userId,
      mode: params.mode,
      seed: params.seed,
      score: params.score,
      chainLength: params.chainLength,
      continuesUsed: params.continuesUsed,
      status: "rejected",
      rejectReason: params.reason,
      inputLog: params.inputLog,
    });
  } catch {
    // Audit insert failure is non-fatal — still return 422
  }
  return Response.json(
    { error: "run_rejected", reason: params.reason },
    { status: 422 },
  );
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleRunsFinish(
  req: Request,
  deps: RunsFinishDeps,
): Promise<Response> {
  // -- Method guard -----------------------------------------------------------
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  // -- Auth ------------------------------------------------------------------
  let session: { userId: string };
  try {
    session = await deps.requireAuth(req);
  } catch (thrown) {
    if (thrown instanceof Response) return thrown;
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  // -- Parse body ------------------------------------------------------------
  let raw: Record<string, unknown>;
  try {
    raw = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const parsed = parseBody(raw);
  if (typeof parsed === "string") {
    return Response.json({ error: "invalid_body", detail: parsed }, { status: 400 });
  }
  const { summary, runId } = parsed;

  // -- Nonce validation -------------------------------------------------------
  let nonce: NonceRecord | null;
  try {
    nonce = await deps.getNonce(runId);
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  if (!nonce) {
    return Response.json({ error: "run_not_found" }, { status: 404 });
  }
  if (nonce.userId !== session.userId) {
    // Don't reveal existence — return 404
    return Response.json({ error: "run_not_found" }, { status: 404 });
  }
  if (nonce.used) {
    return Response.json({ error: "already_submitted" }, { status: 409 });
  }
  if (new Date(nonce.expiresAt) <= new Date(deps.now())) {
    return Response.json({ error: "run_expired" }, { status: 410 });
  }

  // -- Seed consistency check -------------------------------------------------
  // The client must echo back the server-issued seed; mismatch = tampering.
  if (summary.seed !== nonce.seed) {
    await deps.markNonceUsed(runId).catch(() => {});
    return rejectRun(deps, {
      runId, userId: session.userId,
      mode: summary.mode, seed: nonce.seed,
      score: summary.score, chainLength: summary.chainLength,
      continuesUsed: summary.continuesUsed, inputLog: summary.inputLog,
      reason: "seed_mismatch",
    });
  }

  // -- Mode consistency check -------------------------------------------------
  if (summary.mode !== nonce.mode) {
    await deps.markNonceUsed(runId).catch(() => {});
    return rejectRun(deps, {
      runId, userId: session.userId,
      mode: nonce.mode, seed: nonce.seed,
      score: summary.score, chainLength: summary.chainLength,
      continuesUsed: summary.continuesUsed, inputLog: summary.inputLog,
      reason: "mode_mismatch",
    });
  }

  const rules = getModeRules(summary.mode);

  // -- Mode policy: pre-replay checks ----------------------------------------
  // Tournament / challenges: powerups and continues are forbidden.
  // These are fast checks — catch obvious cheats before running replay.
  if (!rules.allowsPowerups && summary.powerupsUsed.length > 0) {
    await deps.markNonceUsed(runId).catch(() => {});
    return rejectRun(deps, {
      runId, userId: session.userId,
      mode: summary.mode, seed: nonce.seed,
      score: summary.score, chainLength: summary.chainLength,
      continuesUsed: summary.continuesUsed, inputLog: summary.inputLog,
      reason: "powerup_forbidden",
    });
  }
  if (!rules.allowsContinues && summary.continuesUsed > 0) {
    await deps.markNonceUsed(runId).catch(() => {});
    return rejectRun(deps, {
      runId, userId: session.userId,
      mode: summary.mode, seed: nonce.seed,
      score: summary.score, chainLength: summary.chainLength,
      continuesUsed: summary.continuesUsed, inputLog: summary.inputLog,
      reason: "continue_forbidden",
    });
  }

  // -- Input log requirement --------------------------------------------------
  // tournament/challenges require an input log for full replay.
  const logRequired = !rules.allowsContinues; // tournament + challenges
  if (logRequired && !summary.inputLog) {
    await deps.markNonceUsed(runId).catch(() => {});
    return rejectRun(deps, {
      runId, userId: session.userId,
      mode: summary.mode, seed: nonce.seed,
      score: summary.score, chainLength: summary.chainLength,
      continuesUsed: summary.continuesUsed,
      reason: "log_required",
    });
  }

  // -- Truncated log policy ---------------------------------------------------
  if (summary.inputLog?.truncated && logRequired) {
    // tournament/challenges: full log required
    await deps.markNonceUsed(runId).catch(() => {});
    return rejectRun(deps, {
      runId, userId: session.userId,
      mode: summary.mode, seed: nonce.seed,
      score: summary.score, chainLength: summary.chainLength,
      continuesUsed: summary.continuesUsed, inputLog: summary.inputLog,
      reason: "log_truncated",
    });
  }

  // -- Hybrid replay ----------------------------------------------------------
  let replay: ReplayRunResult | null = null;

  if (summary.inputLog) {
    try {
      replay = replayRunFromInputLog(summary.inputLog, {
        expectedPhysicsBuildId: deps.physicsBuildId,
      });
    } catch (err) {
      await deps.markNonceUsed(runId).catch(() => {});
      return rejectRun(deps, {
        runId, userId: session.userId,
        mode: summary.mode, seed: nonce.seed,
        score: summary.score, chainLength: summary.chainLength,
        continuesUsed: summary.continuesUsed, inputLog: summary.inputLog,
        reason: `replay_error: ${String(err)}`,
      });
    }

    // Option A: continuesUsed is the authoritative cheat signal
    if (replay.continuesUsed !== summary.continuesUsed) {
      await deps.markNonceUsed(runId).catch(() => {});
      return rejectRun(deps, {
        runId, userId: session.userId,
        mode: summary.mode, seed: nonce.seed,
        score: summary.score, chainLength: summary.chainLength,
        continuesUsed: summary.continuesUsed, inputLog: summary.inputLog,
        reason: `continues_mismatch: client=${summary.continuesUsed} replay=${replay.continuesUsed}`,
      });
    }

    // Server rejects if replay saw MORE dunks than client claimed
    // (client cannot un-claim dunks, but they can claim fewer — unusual but allowed)
    if (replay.chainLength > summary.chainLength + 1) {
      await deps.markNonceUsed(runId).catch(() => {});
      return rejectRun(deps, {
        runId, userId: session.userId,
        mode: summary.mode, seed: nonce.seed,
        score: summary.score, chainLength: summary.chainLength,
        continuesUsed: summary.continuesUsed, inputLog: summary.inputLog,
        reason: `chain_inflated: client=${summary.chainLength} replay=${replay.chainLength}`,
      });
    }
  }

  // -- Mark nonce used + insert verified run ----------------------------------
  try {
    await deps.markNonceUsed(runId);
  } catch {
    return Response.json({ error: "already_submitted" }, { status: 409 });
  }

  // Use replay-authoritative chain_length when available; else client value.
  const authChainLength = replay?.chainLength ?? summary.chainLength;

  let run: RunRecord;
  try {
    run = await deps.insertRun({
      id: runId,
      userId: session.userId,
      mode: summary.mode,
      seed: nonce.seed,
      score: summary.score,         // client-declared (display only)
      chainLength: authChainLength, // replay-authoritative (leaderboard sort key)
      continuesUsed: summary.continuesUsed,
      status: "verified",
      inputLog: summary.inputLog,
    });
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  // Best-effort nonce cleanup (non-blocking)
  deps.pruneNonces(session.userId).catch(() => {});

  return Response.json({
    runId: run.id,
    status: "verified",
    chainLength: authChainLength,
    score: summary.score,
    replayChainLength: replay?.chainLength ?? null,
  });
}
