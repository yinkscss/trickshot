# Trick Shot

Precision chain-hoop arcade game on **Celo** — drag, release, chain the dunks. Monetized via powerups, pay-to-continue, season pass, and a **15% tournament rake**.

**Stack:** locked in [docs/STACK_LOCK.md](docs/STACK_LOCK.md) · **Phase:** Alpha (roadmap)

> **Stack authority:** `docs/STACK_LOCK.md` is canonical. If the PRD, roadmap, or a PR disagrees with the lock, **the lock wins**. Do not change stack IDs without a new lock review.

## Contributing (stack)

- Honor lock IDs: `client=phaser_pwa`, `physics=custom_2d`, `chain=celo`, `wallet=magic`, `contracts=foundry`, `indexing=goldsky`, `backend=supabase`, `hosting=aws_cf`, `platforms=pwa_first`, `monetization=continue_powerup`, `anticheat=hybrid`, `legal=no_continue_tourney`.
- **Out of scope without a lock review:** Unity primary client, Matter/Arcade as physics authority, non-Celo settlement, Magic replacement for v1, custom Node/Postgres/Redis instead of Supabase, loot-box RNG, re-enabling tournament continues.
- Alpha testnet: **Celo Sepolia** `11142220`.
- Prefer surgical PRs that match the [playable pitch](docs/animation-pitch.html) feel before adding features.

## Monorepo

| Path | Role |
|---|---|
| `apps/web` | Phaser 3 PWA client |
| `supabase/` | Supabase (Postgres migrations + Edge Functions) |
| `apps/api` | Deprecated Fastify stub (migrate to Edge Functions) |
| `contracts/` | Foundry + OpenZeppelin |
| `packages/shared` | Shared types / economics constants |
| `infra/` | Hosting + Goldsky stubs |
| `docs/` | PRD, roadmap, playable pitch, stack lock |

## Quick start

```bash
cp .env.example .env
npm install
npm run build -w @trickshot/shared

# Game client (PWA)
npm run dev:web

# Supabase local (Docker required)
npx supabase start
npx supabase status

# Contracts
git submodule update --init --recursive
npm run contracts:test
```

### Celo + Magic + Supabase (Alpha)

| Item | Value |
|---|---|
| Testnet | **Celo Sepolia** — chain id `11142220` |
| RPC (default) | `https://forno.celo-sepolia.celo-testnet.org` |
| Wallet | Magic.link sandbox — set `MAGIC_*` / `VITE_MAGIC_PUBLISHABLE_KEY` in `.env` |
| Backend | Supabase — set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |

## Docs

| Artifact | Link |
|---|---|
| Stack lock | [docs/STACK_LOCK.md](docs/STACK_LOCK.md) |
| HTML PRD | [docs/prd.html](docs/prd.html) |
| Playable gameplay pitch | [docs/animation-pitch.html](docs/animation-pitch.html) |
| Roadmap | [docs/roadmap.html](docs/roadmap.html) |
| Stack questions pack | [docs/stack-questions.html](docs/stack-questions.html) |
| Markdown PRD | [docs/PRD_TrickShot_Celo.md](docs/PRD_TrickShot_Celo.md) |

```bash
npx serve .
# then visit /docs/prd.html and /docs/animation-pitch.html
```

## Product snapshot

- **Core loop:** drag-to-aim → release → swish through next hoop → collect stars → seamless handoff → chain multiplier
- **Rails:** Celo L2, Magic.link wallets, Goldsky indexing, Phaser 3 PWA
- **Pitch must-haves:** zigzag climb, net drag, wall banks, one obstacle/shot, combo juice, seamless dunk→loop
- **Status:** Stack locked · Alpha scaffold in progress (July 26, 2026)
