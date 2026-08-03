# Agent Instructions

## Repository Boundaries

- This is an npm 10 workspace monorepo; use Node 20+ and run commands from the repository root.
- `apps/web` is the real app: a Vite vanilla Canvas2D/PWA client whose entrypoint is `apps/web/src/main.ts` and gameplay loop is `PlayLoop`.
- `packages/shared` owns shared types, constants, and the authoritative `getModeRules(mode)` policy matrix; do not scatter mode-specific checks.
- `packages/logic` owns the pure run FSM, scoring, shot layout, challenge logic, and replay; `packages/physics` owns the DOM-free deterministic 2D integrator used by browser and replay.
- `supabase/` is the canonical backend: migrations, seed data, and Edge Functions. `apps/api` is a deprecated Fastify stub; do not add features there.
- `contracts/` is the Solidity/Foundry/OpenZeppelin surface and requires the declared git submodules. `infra/docker-compose.yml` is deprecated; use the Supabase CLI.

## Source Of Truth

- `docs/STACK_LOCK.md` overrides the PRD, roadmap, and other docs. Do not swap Canvas2D, custom physics, Celo, Magic, Supabase, or Foundry without a lock review.
- `CONTRIBUTING.md` requires surgical changes and says product-rule changes update the relevant docs; paid tournament continues are disabled and tournament powerups remain disabled.
- Keep the playable pitch behavior: drag stretches the net, aim preview matches wall-bank flight, endless shots use at most one procedural obstacle, and dunk-to-next-shot uses the seamless transition.

## Commands

- Install with `npm ci` (or `npm install` when updating dependencies).
- Package verification follows CI order: `npm run typecheck`, `npm test`, then `npm run test:edge`.
- `npm run typecheck` covers shared, physics, logic, and web; it does not cover the deprecated API or Edge Functions.
- `npm test` builds shared, physics, and logic before running their tests and web tests; it does not test the API.
- `npm run test:edge` first runs `npm run build:edge`, then executes mocked Edge Function tests with `TSX_TSCONFIG_PATH=tsconfig.edge.json`; no Supabase instance or network is required.
- Run one Edge test with `npm run build:edge && TSX_TSCONFIG_PATH=tsconfig.edge.json node --import tsx --test 'supabase/functions/runs-finish/runs-finish.test.ts'`.
- Run focused package checks with `npm test -w @trickshot/physics`, `npm run smoke -w @trickshot/physics`, or the corresponding workspace name.
- `npm run build:web` performs web typecheck, Vite build, and `scripts/verify-pwa.mjs`; it needs the `VITE_*` variables from `.env` (CI supplies placeholders).
- For contracts, initialize submodules with `git submodule update --init --recursive`, then use `forge fmt --check`, `npm run contracts:build`, and `npm run contracts:test`.

## Local And Operational Gotchas

- Start local Supabase with Docker via `npx supabase start`; use `npx supabase status` for connection values and `npm run supabase:reset` to reapply migrations plus `supabase/seed.sql`.
- Copy `.env.example` to `.env`, but never commit or expose `MAGIC_SECRET_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `RUN_SIGNING_SECRET`, private keys, or other server secrets to Vite.
- Keep physics/replay deterministic: use the shared `FIXED_DT` integrator, advance obstacle motion from simulation time, and use `stepProjectileSubsteps` for variable web frame times.
- Do not hand-edit `apps/web/dist/sw.js`; change PWA caching in `apps/web/vite.config.ts` and rebuild.
- A push to `master` deploys Supabase migrations, secrets, and all configured Edge Functions; the staging smoke workflow then checks `/health` and `/catalog`.
