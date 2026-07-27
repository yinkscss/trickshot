# Trick Shot — Stack Lock

**Status:** Locked  
**Date:** July 26, 2026  
**Source:** [stack-questions.html](./stack-questions.html) final prompt  

**User override (July 27, 2026):** Game client locked to the playable pitch stack — vanilla HTML + `CanvasRenderingContext2D` + Nunito + `requestAnimationFrame`. Phaser 3 client abandoned for Alpha (`client=phaser_pwa` retired).

Do not silently change these choices. Alpha+ engineering must follow this document.

## Locked decisions

| Layer | Choice | ID |
|---|---|---|
| Game client | Canvas2D pitch (vanilla HTML + rAF; PWA wraps later; optional Capacitor later) | `client=canvas2d_pitch` |
| Physics / aim | Custom 2D integrator (pitch parity: net + dots + banks) | `physics=custom_2d` |
| Blockchain | Celo (Ethereum L2) | `chain=celo` |
| Wallet / auth | Magic.link embedded wallets | `wallet=magic` |
| Smart contracts | Solidity + Foundry + OpenZeppelin | `contracts=foundry` |
| On-chain indexing | Goldsky (Subgraphs + Mirror) | `indexing=goldsky` |
| Backend | Supabase (Postgres + Edge Functions + client SDK) | `backend=supabase` |
| Hosting | AWS/GCP + Cloudflare | `hosting=aws_cf` |
| Launch platforms | PWA / MiniPay web first | `platforms=pwa_first` |
| Monetization (v1) | Continues + powerups first | `monetization=continue_powerup` |
| Score authority | Client play + server replay checks | `anticheat=hybrid` |
| Tournament legal | No continues in paid tournaments | `legal=no_continue_tourney` |

## Product rules (aligned with PRD)

- **Mode rules matrix:** authoritative per-mode policy in `@trickshot/shared` (`getModeRules`) — see [`packages/shared/README.md`](../packages/shared/README.md).
- **Continues in paid tournaments:** **disabled** (`legal=no_continue_tourney`). Continues remain the primary conversion in casual/daily.
- **Powerups in tournament mode:** banned.
- **No loot-box RNG.** Prefer stablecoin micro-tx (cUSD/USDC).
- **Authority:** if any doc disagrees with this file, **this file wins**.

## Out-of-scope stack swaps

Require a new lock review — do not land in PRs:

- Unity (or other native) as the primary client
- Phaser (Game / Scenes / Arcade / Matter) as the Alpha game client or as gameplay physics authority — Phaser client abandoned for Alpha in favor of `client=canvas2d_pitch`
- Non-Celo L1/L2 settlement for Alpha money paths
- WalletConnect-primary onboarding replacing Magic for v1
- Replacing Supabase with a custom Node/Postgres/Redis API without a lock review
- Re-enabling tournament continues without counsel + lock update

## Network targets (Alpha)

| Network | Chain ID | Role |
|---|---|---|
| Celo Sepolia (testnet) | `11142220` | Alpha / staging contracts + Magic sandbox |
| Celo Mainnet | `42220` | Beta+ real cUSD (not Alpha) |

Primary public RPC (override via env): `https://forno.celo-sepolia.celo-testnet.org`

## Must preserve from playable pitch

See [animation-pitch.html](./animation-pitch.html):

1. Zigzag climb (source low ↔ goal high, alternate every dunk)
2. Drag stretches the **net** (ball seated); aim preview matches flight including wall banks
3. Left/right screen edges bounce the ball
4. Endless modes keep **0–1** procedural obstacle per shot (kit types unlock by score, then RNG pick); challenges mode may use authored multi-obstacle layouts (up to 4)
5. Seamless dunk → next-loop (carry hoop down, no hard teleport)
6. Combo juice on chain (x2 / x3 / ON FIRE)

## Backend notes (`backend=supabase`)

- **Postgres** via Supabase (migrations in `supabase/migrations`).
- **Edge Functions** for privileged paths (run verify, shop confirm, Magic session bridge).
- **Client:** `@supabase/supabase-js` from `apps/web`.
- **Auth for wallets remains Magic.link** (`wallet=magic`) — Supabase stores the user/wallet row after Magic verification; Supabase Auth is not the primary player login unless a future lock says so.
- **Redis removed from lock** — use DB + Edge limits / optional later cache; do not reintroduce Redis without a lock review.
- Legacy `apps/api` Fastify stub is deprecated; migrate routes into Supabase Edge Functions.

## Repo layout (scaffolded)

```
apps/web          Canvas2D pitch client (Vite; PWA wrap later)
supabase/         Supabase project (migrations, Edge Functions)
apps/api          Deprecated Fastify stub (remove after Edge cutover)
contracts/        Foundry + OpenZeppelin
packages/shared   Shared types / constants
packages/physics  Custom 2D integrator (TS authority)
packages/logic    RunFSM / scoring / shot layout (TS authority)
infra/            Hosting + Goldsky stubs
docs/             PRD, roadmap, pitch, this lock
```
