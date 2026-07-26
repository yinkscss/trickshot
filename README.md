# Trick Shot

Precision chain-hoop arcade game on **Celo** — drag, release, chain the dunks. Monetized via powerups, pay-to-continue, season pass, and a **15% tournament rake**.

**Stack:** locked in [docs/STACK_LOCK.md](docs/STACK_LOCK.md) · **Phase:** Alpha (roadmap)

## Monorepo

| Path | Role |
|---|---|
| `apps/web` | Phaser 3 PWA client |
| `apps/api` | Node/TypeScript API (Postgres + Redis) |
| `contracts/` | Foundry + OpenZeppelin |
| `packages/shared` | Shared types / economics constants |
| `infra/` | Local docker-compose + hosting/Goldsky stubs |
| `docs/` | PRD, roadmap, playable pitch, stack lock |

## Quick start

```bash
cp .env.example .env
npm install
npm run build -w @trickshot/shared

# Game client (PWA)
npm run dev:web

# API health
npm run dev:api

# Local Postgres + Redis (optional)
docker compose -f infra/docker-compose.yml up -d

# Contracts
git submodule update --init --recursive
npm run contracts:test
```

### Celo + Magic (Alpha)

| Item | Value |
|---|---|
| Testnet | **Celo Sepolia** — chain id `11142220` |
| RPC (default) | `https://forno.celo-sepolia.celo-testnet.org` |
| Wallet | Magic.link sandbox — set `MAGIC_*` / `VITE_MAGIC_PUBLISHABLE_KEY` in `.env` |

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
