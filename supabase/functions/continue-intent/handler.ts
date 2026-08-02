/**
 * continue-intent business logic (issue #52).
 *
 * Records a player's intent to purchase a continue before broadcasting the
 * on-chain tx on Celo.
 * Mode enforcement: tournament mode (and challenges) rejects (legal=no_continue_tourney).
 *
 * All deps injected -> testable in Node.
 */

import { getModeRules } from "../../../packages/shared/dist/index.js";
import type { GameMode } from "../../../packages/shared/dist/index.js";

export interface ContinueIntentRecord {
  id: string;
  runId?: string;
  mode: GameMode;
  expiresAt: string;
}

export interface ContinueIntentDeps {
  requireAuth(req: Request): Promise<{ userId: string }>;
  insertIntent(
    userId: string,
    mode: GameMode,
    runId?: string,
  ): Promise<ContinueIntentRecord>;
}

const VALID_MODES: GameMode[] = ["casual", "daily", "tournament", "challenges"];

export async function handleContinueIntent(
  req: Request,
  deps: ContinueIntentDeps,
): Promise<Response> {
  if (req.method !== "POST") {
    return Response.json({ error: "method_not_allowed" }, { status: 405 });
  }

  // Auth
  let session: { userId: string };
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

  const { mode, runId } = body;

  if (typeof mode !== "string" || !VALID_MODES.includes(mode as GameMode)) {
    return Response.json({ error: "invalid_mode" }, { status: 400 });
  }
  if (runId !== undefined && typeof runId !== "string") {
    return Response.json({ error: "invalid_run_id" }, { status: 400 });
  }

  // Mode enforcement: tournament mode explicitly forbidden (legal=no_continue_tourney)
  if (mode === "tournament") {
    return Response.json(
      {
        error: "tournament_continues_forbidden",
        detail: "Continues are forbidden in tournament mode",
        mode: "tournament",
      },
      { status: 422 },
    );
  }

  // Mode policy check via @trickshot/shared
  const rules = getModeRules(mode as GameMode);
  if (!rules.allowsContinues) {
    return Response.json(
      {
        error: "continue_forbidden",
        detail: `Continues are not allowed in ${mode} mode`,
        mode,
      },
      { status: 422 },
    );
  }

  // Insert intent
  let intent: ContinueIntentRecord;
  try {
    intent = await deps.insertIntent(session.userId, mode as GameMode, runId as string | undefined);
  } catch (err) {
    return Response.json({ error: "db_error", detail: String(err) }, { status: 500 });
  }

  return Response.json({
    intentId: intent.id,
    runId: intent.runId,
    mode: intent.mode,
    expiresAt: intent.expiresAt,
  });
}
