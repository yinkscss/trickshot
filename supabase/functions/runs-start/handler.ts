/**
 * runs-start business logic (issue #8).
 *
 * The server mints the authoritative run seed and records it in
 * `runs_start_nonces`. The client is given back { runId, seed, mode,
 * serverTime } and must present the same `runId` to runs-finish.
 *
 * Why the server mints seeds:
 *   If the client chose its own seed it could pre-compute the "perfect" input
 *   log for that seed offline and submit it — the seed-stuffing attack.
 *   Server-minted seeds mean the client cannot predict what layout will be
 *   generated until the server reveals it.
 *
 * Seed resolution (mirrors resolveRunSeed from @trickshot/logic/run-seed.ts):
 *   - casual / challenges: crypto.randomUUID() (per-run)
 *   - daily: UTC YYYY-MM-DD string (same as client derivation)
 *   - tournament: tournamentId required in body (not Alpha scope, but typed)
 *
 * All dependencies injected → pure handler, testable in Node without Deno.
 */

import type { GameMode } from "../../../packages/shared/dist/index.js";

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

export interface NonceRow {
  id: string;
  seed: string;
  mode: GameMode;
  expiresAt: string;
}

export interface RunsStartDeps {
  /** Return session {userId} from the request JWT. Throws a 401 Response on failure. */
  requireAuth(req: Request): Promise<{ userId: string }>;
  /** Insert a nonce row and return it. Throws on DB error. */
  insertNonce(userId: string, mode: GameMode, seed: string): Promise<NonceRow>;
  /** Resolve the authoritative seed for the given mode. */
  resolveSeed(mode: GameMode, tournamentId?: string): string;
  /** Wall-clock ms — injectable for tests. */
  now(): number;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleRunsStart(
  req: Request,
  deps: RunsStartDeps,
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
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }

  const { mode, tournamentId } = body;

  const validModes: GameMode[] = ["casual", "daily", "tournament", "challenges"];
  if (typeof mode !== "string" || !validModes.includes(mode as GameMode)) {
    return Response.json(
      { error: "invalid_mode", validModes },
      { status: 400 },
    );
  }

  if (mode === "tournament" && typeof tournamentId !== "string") {
    return Response.json(
      { error: "tournament_id_required" },
      { status: 400 },
    );
  }

  // -- Resolve seed ----------------------------------------------------------
  let seed: string;
  try {
    seed = deps.resolveSeed(mode as GameMode, tournamentId as string | undefined);
  } catch (err) {
    return Response.json(
      { error: "seed_error", detail: String(err) },
      { status: 400 },
    );
  }

  // -- Insert nonce ----------------------------------------------------------
  let nonce: NonceRow;
  try {
    nonce = await deps.insertNonce(session.userId, mode as GameMode, seed);
  } catch (err) {
    return Response.json(
      { error: "db_error", detail: String(err) },
      { status: 500 },
    );
  }

  return Response.json({
    runId: nonce.id,
    seed: nonce.seed,
    mode: nonce.mode,
    expiresAt: nonce.expiresAt,
    serverTime: deps.now(),
  });
}
