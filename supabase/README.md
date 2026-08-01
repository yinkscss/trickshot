# Supabase (`backend=supabase`)

Canonical backend for Trick Shot. See [`docs/STACK_LOCK.md`](../docs/STACK_LOCK.md).

## What lives here

| Path | Purpose |
|---|---|
| `migrations/` | Postgres schema (users, runs, shop, inventory) |
| `functions/` | Edge Functions (Magic verify bridge, run finish/replay, shop confirm) |
| `functions/_shared/` | Shared helpers (JWT auth, rate-limit) imported by Edge Functions |
| `config.toml` | Local Supabase CLI config (after `supabase init` / link) |

## Local

### Start the local stack

```bash
# from repo root (Docker required)
npx supabase start
```

On first run, this applies all migrations in `migrations/` and loads seed data (`powerup_skus`).

### Environment variables

After `start`, copy the connection details into `.env` (see `.env.example` for template):

```bash
npx supabase status   # displays SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
```

Then paste these into your `.env` file.

### Reset the database

```bash
npx supabase db reset   # from repo root, or npm run supabase:reset
```

Drops all tables and reapplies all migrations + seed data. Useful for cleaning up after local testing.

---

## Auth model (issue #7)

### Overview

Magic.link (`wallet=magic`) is the **sole** identity provider. Supabase Auth is **not** used as the primary player login — Supabase stores the user/wallet row only after server-side Magic verification.

```
Client (browser)                    Edge Function               Supabase DB
─────────────────────────────────   ────────────────────────   ────────────
magic.auth.loginWithEmailOTP()
  → DID token
POST /functions/v1/auth-magic
  { didToken }                  →  validate DID token
                                   getMetadataByToken()
                                   upsert public.users
                                   sign HS256 JWT           →  users row created/updated
  ← { userId, walletAddress,
      accessToken, expiresIn }
Store session in localStorage
```

### Session token

The `auth-magic` Edge Function returns a custom **HS256 JWT** signed with `RUN_SIGNING_SECRET`. The client stores it as `trickshot.session.v1` in localStorage.

| Field | Value |
|---|---|
| Algorithm | HS256 |
| Issuer claim | `trickshot` |
| Subject | `public.users.id` (UUID) |
| Custom claims | `userId`, `issuer` (Magic DID), `walletAddress` |
| Lifetime | 1 hour (Alpha — no refresh) |

### Making authenticated Edge Function calls

```typescript
import { fetchWithAuth } from "./services/auth";

// Attach JWT + anon key automatically
const res = await fetchWithAuth("/functions/v1/runs-finish", {
  method: "POST",
  body: JSON.stringify(runSummary),
});
```

Or manually:

```typescript
import { getAccessToken } from "./services/auth";

fetch(`${VITE_SUPABASE_URL}/functions/v1/some-function`, {
  method: "POST",
  headers: {
    "apiKey": VITE_SUPABASE_ANON_KEY,         // required by withSupabase wrapper
    "Authorization": `Bearer ${getAccessToken()}`, // our custom JWT
    "Content-Type": "application/json",
  },
  body: JSON.stringify(data),
});
```

### Protecting a new Edge Function

In the new function's `index.ts`:

```typescript
import { requireAuth } from "../_shared/auth.ts";

export default {
  fetch: withSupabase({ auth: ["publishable"] }, async (req, ctx) => {
    // Verify our custom JWT — throws 401 Response on failure
    const session = await requireAuth(req).catch((r) => r as Response);
    if (session instanceof Response) return session;

    // session.userId, session.walletAddress are now verified
    // Use ctx.supabaseAdmin for DB operations...
  }),
};
```

Add to `config.toml`:

```toml
[functions.your-function]
enabled = true
verify_jwt = false   # let our requireAuth() handle JWT checking
import_map = "./functions/your-function/deno.json"
entrypoint = "./functions/your-function/index.ts"
```

### Rate limits

| Limit | Scope | Window |
|---|---|---|
| 10 requests | per IP | 15 minutes |
| 5 requests | per Magic issuer | 15 minutes |

Implemented as in-memory sliding windows in `functions/_shared/rate-limit.ts`. Per-worker (Deno isolate). Acceptable for Alpha load; DB-backed rate limiting would require a lock review (no Redis in stack).

### Security guarantees

- `MAGIC_SECRET_KEY` — only inside Edge Functions; never shipped to Vite
- `SUPABASE_SERVICE_ROLE_KEY` — only inside Edge Functions via `ctx.supabaseAdmin`
- `RUN_SIGNING_SECRET` — only inside Edge Functions; used for JWT signing/verification
- Wallet address — always sourced from Magic's verified metadata, never from client request body

---

## Run lifecycle + hybrid replay anti-cheat (issue #8)

### Overview

Every run goes through two Edge Functions:

```
Client                         runs-start                  Supabase DB
─────────────────────────────  ─────────────────────────── ────────────────
POST /runs-start { mode }  →   requireAuth()
                               resolveAuthSeed(mode)
                               INSERT runs_start_nonces    → nonce row (unused)
                           ←   { runId, seed, mode, expiresAt, serverTime }

<client plays the run, records inputLog>

POST /runs-finish {             runs-finish
  runId, mode, score,       →   requireAuth()
  chainLength, continuesUsed,   getNonce(runId) — validates owner/expiry/used
  powerupsUsed, seed,           mode policy pre-checks
  inputLog }                    replayRunFromInputLog(inputLog)
                                compareReplay vs summary
                                markNonceUsed(runId)
                                INSERT public.runs         → run row (verified/rejected)
                           ←   { runId, status, chainLength, replayChainLength }
```

### Seed resolution (anti-stuffing)

The server mints all seeds via `runs-start`. Clients cannot fabricate seeds:

| Mode | Server seed |
|---|---|
| `casual`, `challenges` | `crypto.randomUUID()` per run |
| `daily` | UTC `YYYY-MM-DD` (same as client's derivation) |
| `tournament` | `tournamentId` from request body |

The returned `runId` is the nonce ID. `runs-finish` verifies: the nonce exists, belongs to the authenticated user, hasn't expired (2-hour TTL), and hasn't been used (optimistic `UPDATE ... WHERE used = false`).

### Anti-cheat strategy (Option A)

`replayRunFromInputLog()` from `@trickshot/logic` replays the FSM events in the input log. Because flight quality flags (`wall_bounce`, `rim_touch`) aren't stored in the log, replay scores all dunks as `"bank"` (1 point). This means `replayScore ≤ clientScore` always — replay is a lower bound.

**Authoritative values come from replay:**

| Value | Source |
|---|---|
| `chain_length` | Replay (FSM-authoritative, stored in `public.runs`) |
| `continues_used` | Replay (exact match required) |
| `score` | Client-declared (stored for display; leaderboard sorts by `chain_length`) |

### Cheat cases detected

| Cheat | Detection layer |
|---|---|
| Seed stuffing | Nonce lookup — seed stored server-side, never trusted from client |
| Mode mismatch | Nonce mode ≠ summary mode → 422 |
| Seed mismatch | Nonce seed ≠ summary seed → 422 |
| Continues in tournament | Mode pre-check (`continuesUsed > 0` or `continue_accept` frame) → 422 |
| Powerups in tournament | Mode pre-check (`powerupsUsed.length > 0`) → 422 |
| Missing inputLog (tournament/challenges) | Pre-check → 422 `log_required` |
| Truncated inputLog (tournament/challenges) | Pre-check → 422 `log_truncated` |
| Physics build mismatch | `replayRunFromInputLog(log, { expectedPhysicsBuildId })` throws → 422 |
| Inflated `continuesUsed` | `replay.continuesUsed ≠ summary.continuesUsed` → 422 |
| Inflated `chainLength` | `replay.chainLength > summary.chainLength + 1` → 422 |
| Double-submit | `markNonceUsed()` UPDATE with `WHERE used = false` throws → 409 |
| Expired session | `requireAuth()` JWT expiry → 401 |
| Expired nonce | `nonce.expiresAt ≤ now` → 410 |

Rejected runs are still persisted to `public.runs` with `status = 'rejected'` for audit.

### Truncated log policy

| Mode | Truncated log |
|---|---|
| casual / daily | Accepted — partial replay still validates `continuesUsed` |
| tournament / challenges | Rejected — full log required for integrity |

### Leaderboard

```
GET /functions/v1/leaderboard?mode=daily&date=2026-07-29&limit=100
Headers: apiKey: <anonKey>   (no JWT required — public scores)

→ calls daily_leaderboard(p_mode, p_date, p_limit) RPC
← { board: [{ rank, userId, walletAddress, score, chainLength, createdAt }],
    mode, date }
```

The `daily_leaderboard()` RPC is `SECURITY DEFINER` — it joins `public.runs` and `public.users` on behalf of the anon caller without RLS bypass needed on the client side.

**Sort order:** `chain_length DESC` (replay-authoritative), then `score DESC` (client-declared tiebreak), then `created_at ASC` (first-in wins ties).

---

## Running Edge Function unit tests

```bash
npm run test:edge
```

Builds `@trickshot/shared`, `@trickshot/physics`, and `@trickshot/logic` first (required — the test runner imports their compiled `dist/` outputs), then runs:

- `supabase/functions/_shared/auth.test.ts`
- `supabase/functions/_shared/rate-limit.test.ts`
- `supabase/functions/auth-magic/auth-magic.test.ts`
- `supabase/functions/runs-start/runs-start.test.ts`
- `supabase/functions/runs-finish/runs-finish.test.ts`
- `supabase/functions/leaderboard/leaderboard.test.ts`
- `supabase/functions/catalog/catalog.test.ts`
- `supabase/functions/purchase-intent/purchase-intent.test.ts`
- `supabase/functions/purchase-confirm/purchase-confirm.test.ts`
- `supabase/functions/inventory-use/inventory-use.test.ts`

All tests use mocked dependencies — no network calls, no running Supabase instance needed. `TSX_TSCONFIG_PATH=tsconfig.edge.json` resolves the `@trickshot/*` bare specifiers from dist paths.

**Current coverage:** 152 tests, 152 passing.

---

## Powerup catalog + inventory (issue #9)

### DB additions (`20260730_shop_intents.sql`)

| Object | Type | Purpose |
|---|---|---|
| `powerup_skus.on_chain_sku_id` | `BIGINT` column | Maps text SKU → `uint256 skuId` in `PowerupShop.sol` |
| `purchases.log_index` | `INTEGER` column | Event log index within tx (idempotency key) |
| `purchases.payment_token` | `TEXT` column | ERC-20 address used (cUSD/USDC) |
| `purchases_tx_log_idx` | `UNIQUE INDEX` | `(tx_hash, log_index)` — prevents double-credit on duplicate confirms |
| `purchase_intents` | Table | Pre-tx intent records — anchors purchase to authenticated user |
| `inventory_use_log` | Table | Append-only audit of powerup consumption |
| `active_powerup_catalog()` | RPC (SECURITY DEFINER) | Public active-SKU catalog sorted by price |
| `user_inventory(uuid)` | RPC (SECURITY DEFINER) | Per-user inventory (non-zero rows) |
| `increment_inventory(uuid, text, int)` | RPC (SECURITY DEFINER) | Atomic UPSERT for purchase-confirm |
| `decrement_inventory(uuid, text, int)` | RPC (SECURITY DEFINER) | Atomic decrement for inventory-use; raises P0001 if insufficient |

### Shop flow

```
Client                    Edge Function              Supabase DB / Celo
──────────────────────    ──────────────────────     ──────────────────

GET /catalog          →   active_powerup_catalog()  → powerup_skus (active)
                      ←   { skus: [{ id, name, priceCents, onChainSkuId }] }

POST /purchase-intent →   requireAuth()
{ sku, quantity }         getSku — validates active
                          price_cents snapshot
                          INSERT purchase_intents   → intent row (pending)
                      ←   { intentId, sku, quantity, priceCents, expiresAt }

<client broadcasts PowerupShop.buy(skuId, amount) on Celo Sepolia>

POST /purchase-confirm →  requireAuth()
{ intentId, txHash,       findExistingPurchase(txHash, logIndex) — idempotency
  logIndex }              getIntent — validates owner, expiry, status
                          verifyReceipt — eth_getTransactionReceipt
                            decode PowerupPurchased event
                            validate buyer, skuId, amount
                          INSERT purchases (confirmed)
                          increment_inventory()     → inventory += quantity
                          UPDATE purchase_intents (confirmed)
                      ←   { status: "confirmed", purchaseId, sku, quantity,
                            newInventoryQuantity, idempotent }

POST /inventory-use    →  requireAuth()
{ sku, quantity,          getModeRules(mode).allowsPowerups — reject tournament/challenges
  mode, runId? }          decrement_inventory()     → inventory -= quantity (atomic)
                          INSERT inventory_use_log  (best-effort audit)
                      ←   { status: "used", sku, quantityUsed, remainingQuantity }
```

### Idempotency contract

`purchase-confirm` is **fully idempotent**: a duplicate call with the same `(txHash, logIndex)` returns `200 { idempotent: true }` without double-crediting inventory. The uniqueness is enforced by a partial unique index on `purchases(tx_hash, log_index) WHERE tx_hash IS NOT NULL`.

### Mode enforcement (powerups)

| Mode | Powerups allowed |
|---|---|
| `casual` | ✅ |
| `daily` | ✅ |
| `tournament` | ❌ 422 `powerup_forbidden` |
| `challenges` | ❌ 422 `powerup_forbidden` |

STACK_LOCK: `TOURNAMENT_ALLOWS_POWERUPS === false`. Challenges mode also bans powerups per `mode-rules.ts`.

### On-chain verification

`purchase-confirm` fetches the tx receipt from Celo Sepolia via `eth_getTransactionReceipt` (one RPC call per confirm, no block indexer). The `PowerupPurchased` event at `logIndex` is decoded with viem and validated:

| Field | Check |
|---|---|
| `log.address` | Must equal `POWERUP_SHOP_ADDRESS` |
| `buyer` (indexed) | Must match user's `wallet_address` (case-insensitive) |
| `skuId` (indexed) | Must match `powerup_skus.on_chain_sku_id` for the intent's SKU |
| `amount` | Must match `intent.quantity` |
| `tx.status` | Must be `"success"` (no reverted tx credits) |

### Required environment variables

| Var | Used by | Purpose |
|---|---|---|
| `POWERUP_SHOP_ADDRESS` | `purchase-confirm` | Deployed `PowerupShop` contract address on Celo Sepolia |
| `CELO_RPC_URL` | `purchase-confirm` | Celo Sepolia JSON-RPC endpoint |
| `CELO_CHAIN_ID` | `purchase-confirm` | Optional — defaults to `44787` (Celo Alfajores/Sepolia) |

---

## Staging Deployment (issue #10)

Automated deployments to the Supabase staging project are driven by GitHub Actions via `.github/workflows/deploy-staging.yml`.

- **Trigger:** Push to `master` (or manual `workflow_dispatch`).
- **Migrations:** Applied automatically via `supabase db push`.
- **Edge Functions:** Deployed via `supabase functions deploy`.
- **Secrets:** Pushed to Supabase Vault via `supabase secrets set` (using repository Secrets).
- **Smoke Tests:** Triggered post-deploy via `.github/workflows/smoke.yml` to verify `/health` and `/catalog` endpoints.

---

## Challenge Progress & Per-Level Stars (issue #43)

### DB additions (`20260801_challenge_progress.sql`)

| Object | Type | Purpose |
|---|---|---|
| `challenge_progress` | Table | Stores per-user level progress (`user_id`, `level_index`, `cleared`, `stars`) |
| `get_user_challenge_progress(uuid)` | RPC (SECURITY DEFINER) | Returns all level progress rows for a user sorted by `level_index` |
| `upsert_challenge_progress(uuid, int, bool, int)` | RPC (SECURITY DEFINER) | Atomic UPSERT: retains `cleared=true`, updates stars to `max(current, new)` |

### Edge Function: `/challenge-progress`

| Endpoint | Method | Auth | Body / Params | Description |
|---|---|---|---|---|
| `/functions/v1/challenge-progress` | `GET` | Session JWT | — | Returns `{ cleared: { "0": true, ... }, stars: { "0": 2, ... } }` |
| `/functions/v1/challenge-progress` | `POST` | Session JWT | `{ levelIndex, stars, cleared? }` | Submits level clear (enforces unlock: Level N requires Level N-1 cleared) |
| `/functions/v1/challenge-progress` | `POST` | Session JWT | `{ sync: { cleared: {...}, stars: {...} } }` | Bulk syncs offline `localStorage` progress to Supabase |

---

## Continue Purchase Confirm & Intent (issue #52)

### DB additions (`20260801_continue_purchases.sql`)

| Object | Type | Purpose |
|---|---|---|
| `continue_intents` | Table | Pre-tx intent records tying continue purchase to authenticated user |
| `continue_purchases` | Table | Confirmed continue purchase ledger with unique `(tx_hash, log_index)` index |
| `confirm_continue_purchase(...)` | RPC (SECURITY DEFINER) | Atomic confirm: inserts into `continue_purchases` and updates intent status |

### Edge Functions: `/continue-intent` & `/continue-confirm`

| Endpoint | Method | Auth | Body / Params | Description |
|---|---|---|---|---|
| `/functions/v1/continue-intent` | `POST` | Session JWT | `{ mode, runId? }` | Creates pre-tx intent (rejects `tournament` and `challenges` modes with `422`) |
| `/functions/v1/continue-confirm` | `POST` | Session JWT | `{ intentId?, runId?, mode?, txHash, logIndex }` | Verifies `ContinuePurchased` receipt on Celo Sepolia and credits continue. **Idempotent**. Rejects `tournament` mode with `422`. |

---

## Related issues

- #6 foundations / migrations (done)
- #7 Magic ↔ Supabase session bridge (done)
- #8 run score + hybrid replay anti-cheat (done)
- #9 powerup catalog + inventory (done)
- #10 CI + staging project (done)
- #43 challenge progress + per-level stars (done)
- #52 continue purchase confirm (done)
