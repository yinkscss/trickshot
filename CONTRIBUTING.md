# Contributing to Trick Shot

## Stack authority

Engineering choices are frozen in [`docs/STACK_LOCK.md`](docs/STACK_LOCK.md).

**If any document or PR disagrees with STACK_LOCK, STACK_LOCK wins.**

Do not change stack IDs without an explicit lock review (update `STACK_LOCK.md` + PRD together).

## Locked IDs (summary)

| ID | Choice |
|---|---|
| `client=phaser_pwa` | Phaser 3 PWA |
| `physics=custom_2d` | Custom 2D integrator (pitch parity) |
| `chain=celo` | Celo L2 (Alpha: Sepolia `11142220`) |
| `wallet=magic` | Magic.link |
| `contracts=foundry` | Solidity + Foundry + OpenZeppelin |
| `indexing=goldsky` | Goldsky (Beta+) |
| `backend=supabase` | Supabase (Postgres + Edge Functions) |
| `hosting=aws_cf` | AWS/GCP + Cloudflare |
| `platforms=pwa_first` | PWA / MiniPay first |
| `monetization=continue_powerup` | Continues + powerups first |
| `anticheat=hybrid` | Client play + server replay |
| `legal=no_continue_tourney` | No continues in paid tournaments |

## Out-of-scope stack swaps

- Unity (or other native) as the primary client
- Phaser Matter / Arcade as gameplay physics authority
- Non-Celo settlement for Alpha money paths
- Replacing Magic with WalletConnect-primary onboarding for v1
- Replacing Supabase with a custom Node/Postgres/Redis API
- Loot-box / RNG paid rewards
- Tournament continues (unless counsel + new lock)

## Workflow

1. Open or claim a GitHub issue (`gameplay` / `backend` / `contracts` / `documentation`).
2. Branch from `master`.
3. Match pitch feel before feature creep (`docs/animation-pitch.html`).
4. Keep PRs surgical; update docs when product rules change.
