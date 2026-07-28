---
title: Hypercasual Feel — DunkShot3D Steal List
date: 2026-07-28
artifact_contract: ce-unified-plan/v1
artifact_readiness: implementation-ready
product_contract_source: ce-plan-bootstrap
execution: code
origin: Conversation analysis of https://github.com/JoseDanielCU/DunkShot3D vs Trick Shot pitch/stack
---

# Hypercasual Feel — DunkShot3D Steal List

> **For agentic workers:** Implement unit-by-unit. Prefer small PRs mapped to U1–U6. Honor `docs/STACK_LOCK.md` and pitch SoT (`docs/animation-pitch.html`, `docs/challenges-pitch.html`). Do not port Unity code or 3D physics.

## Goal Capsule

**Objective:** Make Trick Shot feel like an addictive hypercasual web game by porting *design patterns* from DunkShot3D (audio, tiered escalation, localized dunk juice, moving goals, cosmetics, fairer aim preview) onto the existing Canvas2D + custom-2D stack — without regressing zigzag climb, combo scoring, deterministic seeds, or mode rules.

**Authority hierarchy (highest wins):**
1. `docs/STACK_LOCK.md`
2. `docs/animation-pitch.html` / `docs/challenges-pitch.html` (feel / challenges SoT)
3. This plan
4. DunkShot3D (inspiration only — never copy Unity APIs or values)

**Stop conditions:** Do not adopt full score-reset-on-miss for casual/daily; do not switch to 3D/Unity/Phaser; do not replace combo point economy with +1 dunk scoring; do not reintroduce loot-box RNG.

**Product Contract preservation:** Product Contract authored in this bootstrap from settled conversation decisions — no prior requirements-only file.

---

## Product Contract

### Problem frame

Trick Shot already has a stronger systems layer than DunkShot3D (modes, combo scoring, 12 obstacle types, seeds, continues). What it lacks is hypercasual *feel*: layered sensory feedback, readable difficulty progression, and light retention cosmetics. DunkShot3D is a reference checklist for that last mile — not an architecture to adopt.

### Actors

| ID | Actor | Notes |
|---|---|---|
| A1 | Casual / daily player | Primary retention target; continues + stars allowed |
| A2 | Tournament player | No continues/powerups; hard fail stays high-stakes |
| A3 | Challenges player | Authored levels; endless tier/cosmetics optional or muted |

### Requirements

| ID | Requirement | Priority |
|---|---|---|
| R1 | **Audio state machine** — distinct SFX for aim drag, release, flight loop (or one-shot), rim hit, clean dunk/swish; light pitch jitter to avoid repetition | P0 |
| R2 | **Difficulty tiers** — dunk-count bands drive spawn jitter, obstacle chance, moving-goal unlock, and ambient court mood (not just obstacle-type unlock) | P0 |
| R3 | **Localized dunk juice** — floating `+N` at rim + expanding score ring on dunk, scaled by combo points | P0 |
| R4 | **Moving goal hoops** at high tiers — deterministic sin-wave H/V oscillation; freezes once dunked / during transition | P1 |
| R5 | **Star cosmetics** — unlock/select ball fill + trail tint presets with stars soft currency (local first; Supabase later OK) | P1 |
| R6 | **Aim preview truncation** — preview stops at first *obstacle* hit while keeping wall-bank dots; document pitch amendment | P1 |
| R7 | **Min-launch audit** — weak flicks still produce a readable arc or clear deadzone (no silent duds) | P2 |

### Key flows

| ID | Flow |
|---|---|
| F1 | Drag → aim SFX → release SFX → flight → rim or swish → dunk juice + combo → tier may bump → ambient lerps |
| F2 | Miss → existing continue / tournament rules unchanged; audio miss cue optional |
| F3 | Menu → cosmetics (if unlocked) → apply preset → play with trail/ball tint |
| F4 | High-tier shot → goal oscillates during aim/flight → dunk freezes motion → seamless transition |

### Acceptance examples

| ID | Example |
|---|---|
| AE1 | Mute toggle off: releasing a shot plays release SFX; dunk plays swish; rim bounce plays rim hit |
| AE2 | At dunk count thresholds, court background tint shifts and (at unlock tier) goal begins oscillating |
| AE3 | Dunk awarding 400 pts shows floating `+400` near the goal rim and a short expanding ring |
| AE4 | Stars ≥ unlock cost can select a trail preset; selection persists across runs in the same browser |
| AE5 | Aim dots truncate when predicted path first intersects an active obstacle segment/bumper |

### Scope

**In scope**
- Packages: `packages/logic`, `packages/physics`, `apps/web` (render / game / meta / optional tiny audio module)
- Pure functions + Canvas2D / Web Audio — no new game engines
- Casual/daily ambient tiers; tournament gets juice + audio but same legal mode rules
- Pitch doc note for R6 (preview vs obstacles)

**Out of scope**
- Unity / 3D client, Phaser, Matter
- Full score wipe on casual miss
- Replacing combo multipliers with +1 scoring
- Paid loot boxes / random cosmetics
- New obstacle art packs beyond motion on existing goal hoop
- Backend cosmetics inventory (localStorage Alpha OK; schema can stub)

**Deferred**
- Networked cosmetic sync via Supabase
- Full music bed / adaptive music
- Perfect-swish vs bank-dunk distinct score multipliers (only SFX distinction in this plan)

---

## Planning Contract

### Key technical decisions

| Decision | Choice | Rationale |
|---|---|---|
| KTD1 | Tier key = **dunk count** (`PlayLoop.score` / layout `fromScore`), not point total | Matches layout unlocks + DunkShot3D's +1-per-dunk pacing; points already encode combo |
| KTD2 | New `packages/logic/src/difficulty-tier.ts` pure module | Keeps RunFSM/scoring clean; testable without Canvas |
| KTD3 | Moving goal = fields on goal `Hoop` (`osc` params), stepped in PlayLoop / physics update — **not** a 13th Obstacle type | Avoids obstacle kit inflation; fits "0–1 obstacle per shot" lock |
| KTD4 | Audio via Web Audio API (or HTMLAudioElement pool) in `apps/web/src/audio/` | Stack lock: Canvas2D client; no Unity AudioSource |
| KTD5 | Cosmetics Alpha = localStorage presets keyed by star unlocks | Stars already in `ScoreState`; shop inventory issue can absorb cloud later |
| KTD6 | Preview: extend `predictPath` (or sibling) to optionally collide obstacles and **truncate** | Current pitch comment omits obstacles — document amendment; fairness > pure pitch literal for addictiveness |
| KTD7 | Ambient tier = lerp `COURT` / rail colors in `pitchDraw` from tier palette | DunkShot3D skybox lerp pattern; cheap Canvas2D win |
| KTD8 | Ship order: U1 → U3 → U2 → U4 → U6 → U5 | Juice + audio first (felt immediately); motion/preview next; cosmetics last (retention, more UI) |

### Proposed tier table (directional — tune in implementation)

Dunk counts are **cleared dunks** entering the next shot (`fromScore`).

| Tier | Dunks | Spawn jitter | Obstacle chance | Moving goal | Ambient |
|---|---|---|---|---|---|
| 1 Easy | 0–4 | low (current) | 0 until unlock rules | off | cool grey court |
| 2 Warm | 5–9 | medium | existing unlock RNG | off | warm shift |
| 3 Move | 10–19 | medium+ | existing | on (slow, small amp) | amber |
| 4 Hard | 20–39 | high | prefer denser params (`hard`) | faster | red-orange |
| 5 Chaos | 40–59 | high | always when unlocked types exist | faster + larger amp | violet |
| 6 Nightmare | 60+ | max | always + hard params | max | near-black rails, dim court |

**Constraint:** Endless still max **0–1** obstacle per shot (`STACK_LOCK`). Tier changes probability / param hardness / motion — not obstacle count.

Obstacle-type unlock order in `shot-layout.ts` stays; tiers **compose** on top.

### File map

| Path | Role |
|---|---|
| `packages/logic/src/difficulty-tier.ts` | Pure tier from dunk count + param helpers |
| `packages/logic/src/difficulty-tier.test.ts` | Threshold / param tests |
| `packages/logic/src/shot-layout.ts` | Consume tier for jitter / obstacle chance |
| `packages/logic/src/scoring.ts` | Unchanged economy; dunk points feed popup text |
| `packages/physics/src/types.ts` | Optional `HoopOsc` on `Hoop` |
| `packages/physics/src/aim.ts` | Preview truncation vs obstacles |
| `packages/physics/src/*.test.ts` | Preview + osc step tests |
| `apps/web/src/audio/sfx.ts` | Load/play/mute pool |
| `apps/web/src/audio/sfx.test.ts` | Pure helpers (pitch jitter, gate) where testable |
| `apps/web/src/meta/juice.ts` | Ring + popup helpers |
| `apps/web/src/render/pitchDraw.ts` | Ambient court, popups, rings, cosmetics tint |
| `apps/web/src/render/colors.ts` | Tier palettes |
| `apps/web/src/game/PlayLoop.ts` | Wire audio, tier, osc, juice, cosmetics |
| `apps/web/src/meta/cosmetics.ts` | Unlock table + localStorage |
| `docs/animation-pitch.html` or short `docs/pitch-amendments.md` | R6 note |

### Assumptions

- Procedural/placeholder SFX OK for Alpha (generated beeps or short royalty-free files under `apps/web/public/sfx/`).
- Challenges mode: audio + dunk juice yes; difficulty tiers / moving endless goals **off** (authored layouts own difficulty).
- Mute preference persists in localStorage.
- No change to `getModeRules` / continue legality.

### Sequencing

```
U1 Audio ──┐
U3 Dunk juice ──┼──► U2 Difficulty tiers + ambient ──► U4 Moving goals ──► U6 Preview truncate
                └──► U5 Cosmetics (can parallel after U1 trail hooks)
U7 Min-launch audit (small; fold into U1 or U6)
```

### Risks

| Risk | Mitigation |
|---|---|
| Ambient colors fight pitch brand | Keep Nunito/orange accent; only shift **court fill / rails**, not brand orange |
| Moving goal breaks dunk transition | Freeze osc on dunk; transition uses frozen poses |
| Preview truncate changes feel vs pitch | Explicit amendment; feature-flag or always-on after playtest |
| Audio autoplay policies | Unlock AudioContext on first pointerdown |
| Cosmetics UI scope creep | Single panel: list presets + Equip; no color pickers in Alpha |

---

## Implementation Units

### U1 — Audio state machine

**Goal:** Aim / shoot / flight / rim / swish (and optional miss) with mute + pitch jitter.

**Files:** `apps/web/src/audio/sfx.ts`, `apps/web/src/audio/sfx.test.ts`, `apps/web/src/game/PlayLoop.ts`, `apps/web/public/sfx/*` (or data-URI beeps), optional mute control in `apps/web/src/ui/metaHud.ts`

**Approach:**
- Central `Sfx` module: `resume()`, `setMuted()`, `play(id)`, flight start/stop.
- Hook: drag start → aim; release → shoot + flight; `rimHit` → rim; successful `throughHoop` / dunk → swish + stop flight; miss path → miss cue.
- Pitch jitter ~±5% like DunkShot3D.

**Test scenarios:**
1. `play` respects mute (no throw; internal flag).
2. Flight stop idempotent when called twice.
3. Manual: drag/release/dunk/miss audible; mute silences.

**Verify:** unit tests for helpers; smoke in `npm run dev:web`.

---

### U2 — Difficulty tiers + ambient mood

**Goal:** Dunk-count tiers drive layout params + court color lerp.

**Files:** `packages/logic/src/difficulty-tier.ts`, `packages/logic/src/difficulty-tier.test.ts`, `packages/logic/src/shot-layout.ts`, `packages/logic/src/shot-layout.test.ts`, `packages/logic/src/index.ts`, `apps/web/src/render/colors.ts`, `apps/web/src/render/pitchDraw.ts`, `apps/web/src/game/PlayLoop.ts`

**Approach:**
- `tierFromDunks(n) → 1..6` with thresholds from Planning Contract table (tuneable constants).
- `tierLayoutModifiers(tier)` → jitter scale, obstacle spawn probability multiplier / force, `hard` bias, `movingGoal: boolean` + speed/range (consumed by U4).
- `shot-layout` applies modifiers without violating 0–1 obstacle cap.
- Renderer: `ambientForTier(tier)` colors; lerp toward target over ~0.5–2s (DunkShot3D-style).

**Test scenarios:**
1. Threshold boundaries (4→5 dunks, 9→10, etc.).
2. Tier 1 never requests moving goal.
3. Endless obstacle count still 0 or 1 after modifiers.
4. Challenges path ignores endless tier modifiers.

**Verify:** `npm test -w @trickshot/logic` (+ web render smoke).

---

### U3 — Localized dunk juice (`+N` + score ring)

**Goal:** On dunk, show floating points at goal rim and expanding ring; keep existing combo banner.

**Files:** `apps/web/src/meta/juice.ts`, `apps/web/src/meta/juice.test.ts`, `apps/web/src/render/pitchDraw.ts`, `apps/web/src/render/types.ts` (if needed), `apps/web/src/game/PlayLoop.ts`

**Approach:**
- Spawn particles: `{ x, y, text: '+'+dunkPoints(chain), t, dur }` and `{ x, y, t, dur }` ring.
- Position at goal hoop world coords at dunk instant.
- Draw in `pitchDraw` above court, below or beside combo Fx.
- Intensity can scale with `shakeIntensity` / chain.

**Test scenarios:**
1. Popup text matches `dunkPoints(chainLength)`.
2. Particles expire after `dur`.
3. Manual: dunk shows `+100` / `+200` / etc. at rim.

**Verify:** juice unit tests + visual smoke.

---

### U4 — Moving goal hoops

**Goal:** High-tier goals oscillate H or V with seeded direction; freeze on dunk / transition.

**Files:** `packages/physics/src/types.ts`, optional `packages/physics/src/hoop-osc.ts`, tests, `packages/logic` tier modifiers, `apps/web/src/game/PlayLoop.ts`, `apps/web/src/game/transition.ts` (freeze poses)

**Approach:**
- Add optional `osc?: { axis: 'x'|'y'; amp; spd; phase; originX; originY }` on goal hoop.
- Each tick: if osc and not frozen, update `hoop.x/y` from sin; aim origin stays source hoop.
- Seed axis/phase from `shotRng` for daily determinism.
- On dunk / `beginDunkTransition`: clear osc or freeze at current pose.
- Challenges: never attach osc unless a future authored flag (out of scope).

**Test scenarios:**
1. Position at t and t+dt matches sin formula.
2. Freeze leaves coordinates stable.
3. Replay seed → same axis/phase for same shot.

**Verify:** physics/logic tests; playtest tier ≥3.

---

### U5 — Star cosmetics (ball + trail presets)

**Goal:** Spend/unlock with stars; equip ball fill + trail tint; persist locally.

**Files:** `apps/web/src/meta/cosmetics.ts`, `apps/web/src/meta/cosmetics.test.ts`, thin UI in menu (`PlayLoop` / `metaHud`), `apps/web/src/render/pitchDraw.ts` / trail draw, `apps/web/src/render/trailEffects.ts`

**Approach:**
- Preset table: id, name, starCost, ballCss, trailCss.
- Unlock when lifetime or run stars meet cost (prefer **lifetime stars earned** stored locally — define clearly in code comments).
- Equip writes `localStorage`; PlayLoop reads on run start.
- Alpha UI: simple list in existing menu, not DunkShot3D color pickers.

**Test scenarios:**
1. Cannot equip locked preset.
2. Unlock when stars ≥ cost; persist round-trip.
3. Equipped tint affects draw state fields.

**Verify:** unit tests + menu smoke.

---

### U6 — Aim preview truncation on obstacles

**Goal:** Preview dots stop at first obstacle collision; wall banks still shown.

**Files:** `packages/physics/src/aim.ts`, obstacle collide helpers, `packages/physics` tests, `apps/web/src/game/PlayLoop.ts` (pass obstacles into predict), short pitch amendment doc

**Approach:**
- Today `predictPath` intentionally skips obstacles (comment in `aim.ts`). Change to accept optional obstacles + time, run collide step, **break** (truncate) on hit.
- Keep bank highlighting for walls.
- Document in `docs/pitch-amendments.md` (or pitch sidebar note): preview now matches obstacle blocking for fairness.

**Test scenarios:**
1. Clear path → same length as before (approx).
2. Wall-only bank → bounced dots still present.
3. Bumper/wall obstacle on chord → dots end at/near impact; no dots beyond.
4. Empty obstacle list → prior behavior.

**Verify:** `@trickshot/physics` tests; visual aim at a wall obstacle.

---

### U7 — Min-launch audit (fold into U1 or U6)

**Goal:** No silent dud releases; deadzone intentional and readable.

**Files:** `packages/physics/src/aim.ts` / constants, `PlayLoop` release path

**Approach:** Audit `MIN_SHOT` / `launchFromPull`; ensure below-threshold releases give haptic/audio fail tick (U1) rather than nothing; do **not** invent DunkShot3D `extraVerticalForce` unless playtest proves arcs feel broken — prefer pitch parity.

**Test scenarios:**
1. Sub-min pull returns null and plays fail cue if wired.
2. At-min pull still launches.

---

## Verification Contract

| Gate | Command / check |
|---|---|
| Logic | `npm test -w @trickshot/logic` |
| Physics | `npm test -w @trickshot/physics` |
| Web unit | existing `apps/web` vitest/node tests for touched files |
| Manual feel | `npm run dev:web` — 20 dunks: hear audio, see ambient shift, juice on dunk, moving goal by tier ~10, preview truncates on obstacle |
| Lock | No stack ID changes; endless still 0–1 obstacle |
| Modes | Tournament still no continue CTA |

---

## Definition of Done

**Global**
- [ ] All in-scope units U1–U6 merged (U7 folded)
- [ ] Tests above green
- [ ] Pitch amendment for preview truncation written
- [ ] No casual full-score-reset; combo economy intact
- [ ] Challenges authored layouts unaffected by endless moving-goal tiers

**Per unit:** unit DoD = its test scenarios pass + PlayLoop wired for that feature without breaking menu → play → dunk → miss → continue paths.

---

## Appendix

### DunkShot3D → Trick Shot map

| DunkShot3D | Trick Shot target |
|---|---|
| `DifficultyManager` | `difficulty-tier.ts` + ambient colors |
| `HoopMovement` | `Hoop.osc` in PlayLoop |
| `BallShooter` trajectory truncate | `predictPath` + obstacles |
| `PointPopup` / `ScoreRingEffect` | juice particles in `pitchDraw` |
| AudioSource clips | `apps/web/src/audio/sfx.ts` |
| `BallCustomizerUI` | `cosmetics.ts` presets (simplified) |
| Score wipe on miss | **Do not port** (use existing continue / mode rules) |

### Explicit non-goals (reminder)

- 3D Z-forward hoop spawning
- `AddScore(1)` economy
- Unity Rigidbody tuning constants
- Single generic obstacle prefab replacing the 12-type kit

### Suggested PR slice (~issue-mapped)

1. PR: Audio (U1)
2. PR: Dunk juice (U3)
3. PR: Difficulty tiers + ambient (U2)
4. PR: Moving goals (U4)
5. PR: Preview truncate + pitch note (U6)
6. PR: Cosmetics (U5)

### Origin

Settled in chat 2026-07-28 from analysis of [JoseDanielCU/DunkShot3D](https://github.com/JoseDanielCU/DunkShot3D) vs Trick Shot repo systems.
