/**
 * inventory-use business logic (issue #9).
 *
 * Consumes powerups from a user's inventory for use in a run.
 * Mode enforcement: tournament mode always rejects (TOURNAMENT_ALLOWS_POWERUPS = false).
 *
 * Uses the decrement_inventory() SECURITY DEFINER RPC for an atomic
 * decrement — avoids a race where two concurrent uses read the same
 * quantity before either writes.
 *
 * All deps injected → testable in Node.
 */

import { getModeRules } from "../../../packages/shared/dist/index.js";
import type { GameMode } from "../../../packages/shared/dist/index.js";

export interface InventoryUseDeps {
  requireAuth(req: Request): Promise<{ userId: string }>;
  /**
   * Atomically decrement inventory by `quantity`.
   * Returns the new quantity after decrement.
   * Throws with code "insufficient_inventory" if quantity < requested.
   */
  decrementInventory(userId: string, sku: string, quantity: number): Promise<number>;
  /** Insert an inventory_use_log row. Non-blocking — errors are logged but do not fail the request. */
  logUse(params: {
    userId: string;
    sku: string;
    quantity: number;
    runId?: string;
    mode: GameMode;
  }): Promise<void>;
}

const VALID_MODES: GameMode[] = ["casual", "daily", "tournament", "challenges"];

export async function handleInventoryUse(
  req: Request,
  deps: InventoryUseDeps,
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

  const { sku, quantity, mode, runId } = body;

  if (typeof sku !== "string" || !sku) {
    return Response.json({ error: "invalid_sku" }, { status: 400 });
  }
  const qty = typeof quantity === "number" ? quantity : parseInt(String(quantity), 10);
  if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
    return Response.json({ error: "invalid_quantity" }, { status: 400 });
  }
  if (typeof mode !== "string" || !VALID_MODES.includes(mode as GameMode)) {
    return Response.json({ error: "invalid_mode" }, { status: 400 });
  }
  if (runId !== undefined && typeof runId !== "string") {
    return Response.json({ error: "invalid_run_id" }, { status: 400 });
  }

  // Mode enforcement — tournament bans powerups
  // STACK_LOCK: TOURNAMENT_ALLOWS_POWERUPS === false (locked in shared package)
  const rules = getModeRules(mode as GameMode);
  if (!rules.allowsPowerups) {
    return Response.json(
      {
        error: "powerup_forbidden",
        detail: `powerups are not allowed in ${mode} mode`,
        mode,
      },
      { status: 422 },
    );
  }

  // Atomic decrement
  let newQuantity: number;
  try {
    newQuantity = await deps.decrementInventory(session.userId, sku, qty);
  } catch (err) {
    const msg = String(err);
    if (msg.includes("insufficient_inventory") || msg.includes("P0001")) {
      return Response.json(
        { error: "insufficient_inventory", sku, requested: qty },
        { status: 409 },
      );
    }
    return Response.json({ error: "db_error", detail: msg }, { status: 500 });
  }

  // Audit log (best-effort — non-blocking)
  deps
    .logUse({
      userId: session.userId,
      sku,
      quantity: qty,
      runId: runId as string | undefined,
      mode: mode as GameMode,
    })
    .catch(() => {});

  return Response.json({
    status: "used",
    sku,
    quantityUsed: qty,
    remainingQuantity: newQuantity,
  });
}
