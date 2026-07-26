# @trickshot/shared

Shared types, constants, and cross-cutting policy for Trick Shot.

**Stack authority:** [`docs/STACK_LOCK.md`](../../docs/STACK_LOCK.md)

## Mode rules matrix

Single source of truth for casual / daily / tournament policy. Mirrors on-chain `GameEconomics` and hybrid-replay validators.

| Rule | casual | daily | tournament |
|------|--------|-------|------------|
| Continues | ✅ | ✅ | ❌ (`legal=no_continue_tourney`) |
| Powerups | ✅ | ✅ | ❌ |
| Seed source | per-run | UTC date (`YYYY-MM-DD`) | tournament / event id |
| Soft-currency stars | ✅ | ✅ | ✅ |
| Global board | optional | required | tournament board |
| Physics | shared custom 2D | same | same |

Scoring and spawn probabilities are **identical** across modes; only monetization gates and seed/board scope differ.

### API

```ts
import {
  getModeRules,
  assertCanContinue,
  assertCanUsePowerup,
  ModePolicyError,
  type ModeRules,
} from "@trickshot/shared";

const rules = getModeRules("tournament");
// rules.allowsContinues === false
// rules.allowsPowerups === false
// rules.seedSource === "tournament_id"

assertCanContinue("casual"); // ok
assertCanUsePowerup("tournament", "wide_hoop"); // throws ModePolicyError
```

`@trickshot/logic` wraps seed resolution via `resolveRunSeed(mode, ctx)` and re-exports FSM/powerup helpers that delegate to this matrix.

### Consumers

- **Run FSM** — `allowsContinue` / `offerContinue` gate
- **Powerups** — `powerupsAllowed` / `assertPowerupAllowed`
- **Input log validator** — rejects `continue_accept` when `allowsContinues === false`
- **Contracts** — `TOURNAMENT_ALLOWS_*` constants derived from tournament row
