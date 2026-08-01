# Infra — Trickshot staging setup

Hosting lock: **Supabase** for all backend surfaces (`backend=supabase`).  
The web PWA (`apps/web`) is a Vite build. Web hosting approach is separate from this guide.

---

## Surfaces

| Surface | Role | Phase |
|---|---|---|
| Supabase | Postgres, migrations, Edge Functions (all backend) | Alpha |
| Goldsky | Subgraphs + Mirror for tournament escrow events | Beta |

---

## GitHub Actions workflows

Three workflows live in `.github/workflows/`:

| Workflow | Trigger | Purpose |
|---|---|---|
| `ci.yml` | Every push / PR | PR gate: typecheck, unit tests, edge tests, Forge |
| `deploy-staging.yml` | Push to `master` | Applies migrations, sets secrets, deploys all functions |
| `smoke.yml` | After `deploy-staging` completes | Verifies health + catalog endpoints |

### CI job matrix (`ci.yml`)

```
┌──────────────────────┬──────────────────────────────────────────────────────┐
│ packages             │ npm ci → typecheck → npm test → npm run test:edge    │
│                      │ (152 Edge Function unit tests; no network required)   │
├──────────────────────┼──────────────────────────────────────────────────────┤
│ web-build            │ npm ci → build:web (Vite PWA + verify-pwa.mjs)       │
│                      │ Stub VITE_* env vars — not real secrets               │
├──────────────────────┼──────────────────────────────────────────────────────┤
│ contracts            │ checkout --submodules → Foundry → forge fmt --check   │
│                      │ → forge build --sizes → forge test -vvv               │
└──────────────────────┴──────────────────────────────────────────────────────┘
```

All three jobs run in parallel. A failing job blocks the merge.

---

## Required GitHub Actions secrets

Set these in **GitHub → repo → Settings → Secrets and variables → Actions**:

### For `deploy-staging.yml`

| Secret | How to get it |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Run `supabase login` locally → copy the token printed, or use `supabase login --token <token>` with a token from [app.supabase.com/account/tokens](https://app.supabase.com/account/tokens) |
| `SUPABASE_PROJECT_REF` | Supabase dashboard → your staging project → Settings → General → Reference ID (12-char string, e.g. `abcdefghijkl`) |
| `RUN_SIGNING_SECRET` | Any strong random string — must match what the Edge Functions expect (`RUN_SIGNING_SECRET` in local `.env`) |
| `MAGIC_SECRET_KEY` | Magic.link dashboard → your app → API Keys → Secret key (`sk_live_...`) |
| `POWERUP_SHOP_ADDRESS` | Deployed `PowerupShop` contract address on Celo Sepolia (from `forge script` output or `contracts/deployments/`) |
| `CELO_RPC_URL` | Your private Celo Sepolia RPC URL; public default: `https://forno.celo-sepolia.celo-testnet.org` |
| `CELO_CHAIN_ID` | Optional — defaults to `44787` in the workflow |

### For `smoke.yml`

| Secret | Value |
|---|---|
| `SUPABASE_STAGING_URL` | `https://<SUPABASE_PROJECT_REF>.supabase.co` |
| `SUPABASE_STAGING_ANON_KEY` | Supabase dashboard → staging project → Settings → API → anon key (safe to expose in logs — not a secret key) |

---

## One-time: create the staging Supabase project

1. Go to [app.supabase.com](https://app.supabase.com) → **New project**
2. Choose a name (e.g. `trickshot-staging`) and a strong DB password
3. Select the region closest to your users
4. Copy the **Reference ID** (12-char) → set as `SUPABASE_PROJECT_REF` GitHub secret
5. Copy the **URL** and **anon key** → set as `SUPABASE_STAGING_URL` + `SUPABASE_STAGING_ANON_KEY`

The `deploy-staging.yml` workflow handles everything else automatically on the next push to `master`:
- Links the CLI to the project (`supabase link`)
- Applies all migrations from `supabase/migrations/` (`supabase db push`)
- Pushes all Edge Function secrets (`supabase secrets set`)
- Deploys all 9 Edge Functions (`supabase functions deploy`)

---

## Deployed Edge Functions

All functions listed in `supabase/config.toml` are deployed automatically:

| Function | Auth required | Purpose |
|---|---|---|
| `health` | None | Liveness probe (smoke target) |
| `auth-magic` | None (Magic token) | Magic → Supabase user bridge |
| `runs-start` | Session JWT | Issue run nonce + seed |
| `runs-finish` | Session JWT | Submit + anti-cheat verify |
| `leaderboard` | None | Public score board |
| `catalog` | None | Powerup SKU catalog (smoke target) |
| `purchase-intent` | Session JWT | Create pre-tx purchase intent |
| `purchase-confirm` | Session JWT | Verify on-chain receipt + credit inventory |
| `inventory-use` | Session JWT | Consume powerup from inventory |

---

## Manually triggering a deploy

The `deploy-staging.yml` workflow has a `workflow_dispatch` input so you can deploy without pushing code (useful after secrets change):

```
GitHub → Actions → Deploy — Staging (Supabase) → Run workflow
```

Optional input: **Skip migrations** — set to `true` if the migrations are already applied and you only want to redeploy functions.

---

## Smoke test endpoints

After a successful staging deploy, these should return 200:

```bash
# Health
curl "https://<ref>.supabase.co/functions/v1/health" \
  -H "apikey: <anon-key>"
# → { "status": "ok" }

# Catalog (public)
curl "https://<ref>.supabase.co/functions/v1/catalog" \
  -H "apikey: <anon-key>"
# → { "skus": [{ "id": "aim_assist", ... }, ...] }
```

---

## Local development

```bash
# Start local Supabase stack
npx supabase start

# Apply all migrations
npx supabase db reset

# Serve Edge Functions locally
npx supabase functions serve

# Run all tests (no supabase instance needed)
npm run test:edge
```

---

## Goldsky (Beta+)

Placeholder config in `infra/goldsky/`. Do not wire mainnet indexing until escrow events are final.

---

## Security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is **never** committed or logged. It is only used inside Edge Functions via `supabaseAdmin` (injected by `withSupabase`).
- [ ] `MAGIC_SECRET_KEY` is **never** committed. Pushed as a function secret via `supabase secrets set`.
- [ ] All function secrets are accessed via `Deno.env.get()` inside Edge Functions — not as workflow env vars.
- [ ] The `SUPABASE_STAGING_ANON_KEY` (in smoke test) is the **anon** key, which is safe to log. It is not the service role key.
- [ ] PR CI does not have access to staging secrets — only the `deploy-staging` job (gated to `master`) does.
