# Trick Shot contracts

**Stack lock:** Solidity + Foundry + OpenZeppelin (`contracts=foundry`)  
**Network (Alpha):** Celo Sepolia — chain id `11142220`

## Setup

```bash
# from repo root (submodules already declared)
git submodule update --init --recursive
forge build --root contracts
forge test --root contracts
```

## Deploy (Celo Sepolia)

1. Copy env template and set values:

```bash
cp contracts/.env.example .env
```

1. Dry run script:

```bash
npm run contracts:deploy:sepolia:dry
```

1. Broadcast + verify:

```bash
npm run contracts:deploy:sepolia
```

The script writes deployment outputs to:

- `contracts/deployments/celo-sepolia.json`

Deployment output includes both implementation and proxy addresses.
Integrations should use proxy addresses (`tournamentEscrow`, `powerupShop`, `continuePurchase`).

## Layout

| Path | Purpose |
| --- | --- |
| `src/GameEconomics.sol` | Locked rake / tournament posture constants |
| `src/TournamentEscrow.sol` | Non-mainnet tournament escrow skeleton (alpha/beta foundation) |
| `src/PowerupShop.sol` | Testnet fixed-price powerup purchases (no RNG) |
| `src/ContinuePurchase.sol` | Testnet continue purchase with tournament-mode ban |
| `test/` | Foundry tests |
| `script/` | Deploy scripts (Alpha+) |
| `docs/tournament-escrow.md` | Tournament escrow lifecycle/spec + failure modes |

Tournament escrow here is intentionally a non-mainnet skeleton for Alpha/Beta iteration.
Mainnet real-funds rollout remains audit-gated.

## Tournament Escrow Spec

- See `docs/tournament-escrow.md` for lifecycle, rake accounting, payout curve design,
  and legal constraints (`no_continue_tourney`, tournament powerups disabled).
