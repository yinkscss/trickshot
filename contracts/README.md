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

## Layout

| Path | Purpose |
|---|---|
| `src/GameEconomics.sol` | Locked rake / tournament posture constants |
| `test/` | Foundry tests |
| `script/` | Deploy scripts (Alpha+) |

Tournament escrow (entry fees, 85/15 split, payout events) lands at Public Launch after audit — not in this scaffold.
