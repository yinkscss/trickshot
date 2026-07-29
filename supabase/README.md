# Supabase (`backend=supabase`)

Canonical backend for Trick Shot. See [`docs/STACK_LOCK.md`](../docs/STACK_LOCK.md).

## What lives here

| Path | Purpose |
|---|---|
| `migrations/` | Postgres schema (users, runs, shop, inventory) |
| `functions/` | Edge Functions (Magic verify bridge, run finish/replay, shop confirm) |
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

## Auth model

- **Player login / wallet:** Magic.link (`wallet=magic`)
- **Data plane:** Supabase Postgres + RLS where appropriate
- Edge Functions hold `MAGIC_SECRET_KEY` + `SUPABASE_SERVICE_ROLE_KEY` — never ship service role to the browser

## Related issues

- #6 foundations / migrations
- #7 Magic ↔ Supabase session bridge
- #8 run verify (hybrid replay) Edge Function
- #9 powerup catalog + inventory
- #10 CI + staging project
