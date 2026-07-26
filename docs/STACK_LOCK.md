# Trick Shot — Stack Lock

**Status:** Locked  
**Date:** July 26, 2026  
**Source:** [stack-questions.html](./stack-questions.html) final prompt  

Do not silently change these choices. Alpha+ engineering must follow this document.

## Locked decisions

| Layer | Choice | ID |
|---|---|---|
| Game client | Phaser 3 PWA (web-first; optional Capacitor later) | `client=phaser_pwa` |
| Physics / aim | Custom 2D integrator (pitch parity: net + dots + banks) | `physics=custom_2d` |
| Blockchain | Celo (Ethereum L2) | `chain=celo` |
| Wallet / auth | Magic.link embedded wallets | `wallet=magic` |
| Smart contracts | Solidity + Foundry + OpenZeppelin | `contracts=foundry` |
| On-chain indexing | Goldsky (Subgraphs + Mirror) | `indexing=goldsky` |
| Backend | Node/TypeScript + Postgres + Redis | `backend=node_pg_redis` |
| Hosting | AWS/GCP + Cloudflare | `hosting=aws_cf` |
| Launch platforms | PWA / MiniPay web first | `platforms=pwa_first` |
| Monetization (v1) | Continues + powerups first | `monetization=continue_powerup` |
| Score authority | Client play + server replay checks | `anticheat=hybrid` |
| Tournament legal | No continues in paid tournaments | `legal=no_continue_tourney` |

## Product rules (aligned with PRD)

- **Continues in paid tournaments:** **disabled** (`legal=no_continue_tourney`). Continues remain the primary conversion in casual/daily.
- **Powerups in tournament mode:** banned.
- **No loot-box RNG.** Prefer stablecoin micro-tx (cUSD/USDC).
- **Authority:** if any doc disagrees with this file, **this file wins**.

## Out-of-scope stack swaps

Require a new lock review — do not land in PRs:

- Unity (or other native) as the primary client
- Phaser Matter / Arcade Physics as gameplay authority
- Non-Celo L1/L2 settlement for Alpha money paths
- WalletConnect-primary onboarding replacing Magic for v1
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
4. Exactly **one obstacle** per shot
5. Seamless dunk → next-loop (carry hoop down, no hard teleport)
6. Combo juice on chain (x2 / x3 / ON FIRE)

## Repo layout (scaffolded)

```
apps/web          Phaser 3 + Vite PWA client
apps/api          Node/TypeScript API (Postgres + Redis)
contracts/        Foundry + OpenZeppelin
packages/shared   Shared types / constants
infra/            Hosting + Goldsky stubs
docs/             PRD, roadmap, pitch, this lock
```
