# Trick Shot Agent Guide

## Start here

- Read [`docs/STACK_LOCK.md`](docs/STACK_LOCK.md) before changing architecture, dependencies, network targets, auth, monetization, or gameplay authority. It is the canonical decision record.
- Read [`CONTRIBUTING.md`](CONTRIBUTING.md) for workflow and stack constraints.
- Prefer the README for the area being changed: [`apps/web`](apps/web/README.md), [`packages/shared`](packages/shared/README.md), [`packages/physics`](packages/physics/README.md), [`packages/logic`](packages/logic/README.md), [`supabase`](supabase/README.md), or [`contracts`](contracts/README.md).

## Repository shape

- `apps/web`: vanilla TypeScript + Vite Canvas2D pitch client; gameplay rendering and input live here.
- `packages/physics`: custom 2D integrator and flight/obstacle physics authority.
- `packages/logic`: run state machine, scoring, seeded layouts, and replay logic authority.
- `packages/shared`: shared types, mode rules, and economics constants. Use `getModeRules(mode)` instead of scattering mode checks.
- `supabase`: canonical backend, Postgres migrations, and privileged Edge Functions.
- `contracts`: Solidity + Foundry + OpenZeppelin contracts.
- `apps/api`: deprecated Fastify health stub. Do not add backend features here; use Supabase Edge Functions.

## Non-negotiable boundaries

- Preserve the locked stack IDs in `docs/STACK_LOCK.md`; do not silently substitute frameworks or services.
- The Alpha client is Canvas2D with `requestAnimationFrame`; Phaser and its Arcade/Matter physics are not the gameplay authority. Treat older documents or prompts that mention Phaser as stale unless the stack lock changes.
- Supabase is the backend authority. Keep service-role keys, Magic secrets, and signing secrets inside Edge Functions; browser code may use only `VITE_*` public values and the anon key.
- Keep tournament policy centralized: paid tournaments do not allow continues, and tournament powerups are banned.
- Keep gameplay changes consistent with the playable pitch: zigzag progression, net drag, wall-bank preview parity, at most one procedural endless-mode obstacle per shot, seamless dunk handoff, and combo feedback.

## Validation

Use Node `>=20` and npm `10`. From the repository root, run the narrowest relevant check first, then broaden as needed:

```bash
npm run typecheck
npm test
npm run build
npm run test:edge
npm run contracts:test
```

For web changes, use `npm run build:web`; for shared/physics/logic changes, run their workspace `typecheck`, `test`, or `build` scripts. Supabase local integration work requires Docker and `npx supabase start`; migrations can be reset with `npm run supabase:reset`.

## Change discipline

- Make surgical changes in the owning package and update its README or the relevant product document when behavior or rules change.
- Add or update focused tests for physics, run logic, Edge Functions, migrations, and contracts according to the surface changed.
- Do not commit secrets, service-role credentials, Magic secret keys, or generated deployment artifacts.
- When documentation conflicts, link back to `docs/STACK_LOCK.md` and follow it rather than trying to reconcile the conflicting document in code.