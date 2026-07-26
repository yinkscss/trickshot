# Product Requirements Document
## "Trick Shot" — A Precision Chain-Hoop Game on Celo

**Document owner:** Senior Product Manager  
**Status:** Draft v1.0 (stack-aligned)  
**Date:** July 26, 2026

> **Stack authority:** Engineering decisions are frozen in [`docs/STACK_LOCK.md`](./STACK_LOCK.md).  
> **If this PRD disagrees with STACK_LOCK, STACK_LOCK wins.** Do not silently change stack IDs (`client=phaser_pwa`, `legal=no_continue_tourney`, etc.) without a new lock review.

---

## 1. Executive Summary

Trick Shot is a mobile-first, single-input arcade game — a precision "swing the ball through a chain of hoops" loop, in the spirit of Ketchapp-style drop/swing games — built on Celo, an Ethereum L2 optimized for low-cost, mobile-friendly stablecoin payments. Unlike Fruit Slash's cosmetic-and-boast model, Trick Shot's monetization is built around three levers: **powerup purchases**, **pay-to-continue**, and a **season pass** — layered on top of skill-based tournaments where the house takes a **15% rake of the prize pool**.

Celo remains the settlement layer of choice: sub-cent transaction fees, gas payable directly in cUSD/USDC/USDT, ~1 second block times, and distribution reach through Opera's MiniPay wallet (16M+ wallets across 65+ countries).

**Client:** web-based **Phaser 3 PWA** (browser / MiniPay first). See STACK_LOCK.

---

## 2. Problem Statement & Opportunity

**Problem:** "Endless chain" arcade games (Dunk Shot, Helix Jump, Stack) monetize almost entirely through interstitial ads and app-store IAP for continues. This caps margins (15–30% app-store take), makes revenge-spend mechanics (continues) opaque, and gives the studio no verifiable, ownable competitive layer.

**Opportunity:**
- Sell powerups and continues directly in stablecoins, at near-zero gas cost, so a $0.49 continue doesn't lose 30 cents to a payment processor or app store.
- Run tournaments where the entry fee and prize pool are transparent and settled on-chain, with the house rake visible and fixed rather than buried in odds.
- Use Celo's MiniPay distribution as a low-CAC channel into emerging markets where stablecoin rails outperform card rails.

---

## 3. Goals & Success Metrics

### Business Goals
1. Launch a free-to-play core loop with paid powerups, paid continues, and a seasonal subscription, reaching positive unit economics within 2 quarters.
2. Stand up skill-based tournaments with a 15% house rake as a recurring, predictable revenue stream — not a one-off event.
3. Achieve Day-30 retention ≥ 20% and a paying-user rate ≥ 6%, with continues as the primary conversion moment in **casual / daily** modes (skill-based "just one more try" spend).

### Non-Goals (v1)
- No peer-to-peer wagering pools (two players staking directly against each other) — tournaments use a fixed entry fee, pooled prize, and house rake, not a betting market.
- No speculative token or yield product at launch.
- No randomized paid loot boxes — powerups and cosmetics are fixed-price, fixed-effect purchases.
- No continues in **paid tournament** mode (`legal=no_continue_tourney` — locked).
- No silent stack swaps (Unity native client, Matter/Arcade as physics authority, non-Celo settlement, etc.) — see STACK_LOCK out-of-scope list.

### Success Metrics (KPIs)

| Metric | Target (Month 6) |
|---|---|
| MAU | 200,000 |
| D1 / D7 / D30 retention | 42% / 23% / 20% |
| Paying user % | 6–9% |
| ARPPU (avg revenue per paying user/mo) | $7–11 |
| Continue-purchase rate (per session with a miss) | 8–12% |
| Season pass attach rate | 10–15% of MAU |
| Tournament entry rate (of paying users) | 20–30% |
| Avg on-chain tx cost per purchase | < $0.01 |
| Gross margin per transaction (after infra + gateway) | > 90% |

---

## 4. Target Users & Personas

1. **Casual Mobile Gamer (primary, global)** — 5–10 minute sessions, spends small amounts on continues in the heat of a run; the wallet is invisible to them.
2. **MiniPay / Emerging-Market Stablecoin User (acquisition wedge)** — already holds cUSD/USDT via Opera MiniPay, low data-cost sensitivity, values near-zero fees for small, frequent purchases like continues and powerups.
3. **Competitive Chain-Runner** — plays for leaderboard position and tournament prize pools; buys powerups in practice/casual modes to push personal-best chains (powerups and continues are unavailable in paid tournaments).

---

## 5. Core Gameplay (Feature Scope)

### 5.1 Core Loop (v1 — table stakes)
- Single-input swing mechanic: tap-hold to release the ball from the current hoop into the next (pitch: drag stretches the **net**; custom 2D aim/flight).
- Chain scoring: consecutive clean swings build a multiplier; a miss ends the run unless a continue or shield is used (**casual / daily only** — not in paid tournaments).
- Obstacles: exactly one obstacle per shot in the pitch-parity loop; roster expands later (spinner bars, moving hoops, narrow-gap hoops).
- Star pickups along the chain feed the soft-currency loop (used for cosmetic and minor powerup purchases without spending cUSD directly).
- Daily challenges, streaks, and local/global leaderboards.

### 5.2 Web3-Native Features
- **Invisible wallet onboarding** via Magic.link — email/social/phone login, non-custodial wallet provisioned behind the scenes.
- **On-chain run attestation:** a player's verified best chain can be minted as a timestamped, shareable proof — same "boast" mechanic as Fruit Slash, offered as an optional add-on rather than the primary monetization lever this time.
- **Tournaments:** entry-fee (cUSD) competitions on a fixed time window; smart-contract-escrowed prize pool; automated payout to top finishers; **house takes a 15% rake of the total prize pool**, distributed transparently on-chain so the rake percentage and payout schedule are verifiable by any entrant before they pay in. Tournament runs are **powerup-free** and **continue-free**.

---

## 6. Business Model & Monetization

### 6.1 Revenue Streams

| Stream | Mechanic | Price range (cUSD) | Notes |
|---|---|---|---|
| Powerups | Aim assist, slow-drop, wide-hoop, magnet-star | $0.29–$1.99 | Sold individually or in bundles; usable in casual/daily; **banned in tournament** |
| Continue | Resume a run after a miss, once per run (paid tier) or watch-to-continue (ad tier) | $0.49–$1.49, scales with chain length reached | Primary conversion in casual/daily — **disabled in paid tournaments** |
| Season Pass | Seasonal reward track: cosmetics, bonus soft-currency, exclusive powerup skins | $4.99 / season (4–6 weeks) | Recurring revenue anchor |
| Tournament entry | Fixed entry fee into a timed leaderboard competition | $1–$20 entry | **House rake: 15% of total prize pool.** Remaining 85% distributed to top finishers per a published payout curve |
| Cosmetic shop | Ball skins, hoop rim styles, trail effects (ERC-1155) | $0.99–$5.99 | Secondary, ownership-driven revenue; not the primary lever in this model |
| Marketplace royalty | Secondary sale of cosmetic NFTs | 5% royalty | Passive long-tail revenue |
| Ads (opt-in, rewarded only) | Watch-to-continue, watch-for-soft-currency | eCPM-based | Non-paying-user monetization and the "free" continue path (casual/daily) |

### 6.2 Why the Continue + Tournament-Rake Model Benefits from On-Chain Rails

- **Micro-transaction viability:** a $0.49 continue only clears app-store IAP economics at scale; at Celo's sub-cent gas cost, it clears at almost any volume, including a single impulse purchase mid-run.
- **Transparent rake:** because the prize pool and the 15% house cut settle via a public smart contract, the rake is auditable by players rather than asserted in a terms-of-service document — a trust signal for a real-money competitive product.
- **Fast settlement:** ~1 second block times mean a continue purchase clears before the player's next input, preserving the "flow state" that endless-runner games depend on.
- **App-store fee avoidance:** routing continues, powerups, and tournament entries through a web/PWA checkout (where store policy allows) keeps the 15–30% app-store cut out of the highest-frequency purchase moments.

### 6.3 Pricing & Economy Guardrails

- Powerups are **not usable in Tournament mode** — tournament runs are powerup-free to preserve competitive integrity and to keep the mode defensible as skill-based rather than pay-to-win.
- Continues are **disabled in paid Tournament mode** (`legal=no_continue_tourney`). Continues remain the primary conversion in casual/daily (paid or rewarded-ad). A prior “continue with score penalty in tournaments” idea was rejected at stack lock in favor of a cleaner skill-game story.
- Daily spend caps with a soft warning, and a self-exclusion/limit-setting option, given real-money tournament stakes.
- No randomized-outcome purchases anywhere in the powerup, continue, or season-pass systems — every purchase has a fixed, disclosed effect.
- **Legal review required, per jurisdiction, before launch.** A fixed entry fee with a disclosed house rake and skill-determined payout is generally treated differently from wagering in many jurisdictions, but this varies by country and by the specific payout structure — confirm with counsel before enabling real-money tournaments in any market. This PRD is not legal advice.

---

## 7. Tech Stack (locked)

Canonical freeze: [`docs/STACK_LOCK.md`](./STACK_LOCK.md). Summary:

| Layer | Choice | Lock ID |
|---|---|---|
| Blockchain | Celo (Ethereum L2); Alpha = Celo Sepolia `11142220` | `chain=celo` |
| Wallet/Auth | Magic.link (embedded wallets, passwordless) | `wallet=magic` |
| On-chain data indexing | Goldsky (Subgraphs + Mirror) — Beta+ | `indexing=goldsky` |
| Smart contracts | Solidity, Foundry, OpenZeppelin | `contracts=foundry` |
| Tournament escrow/payout | Purpose-built escrow: entry fees, 85%/15% split, on-chain payout events | (contracts) |
| Game client | Phaser 3 PWA / browser-first; optional Capacitor later | `client=phaser_pwa` |
| Physics / aim | Custom 2D integrator (pitch parity — not Matter/Arcade as authority) | `physics=custom_2d` |
| Backend | Supabase (Postgres + Edge Functions + JS client) | `backend=supabase` |
| Hosting | AWS/GCP + Cloudflare | `hosting=aws_cf` |
| Launch platforms | PWA / MiniPay web first | `platforms=pwa_first` |
| Monetization priority (v1) | Continues + powerups first | `monetization=continue_powerup` |
| Score authority | Client play + server replay checks | `anticheat=hybrid` |
| Tournament legal | No continues in paid tournaments | `legal=no_continue_tourney` |

**Out-of-scope stack swaps** (require a new lock review — do not “just try”):
- Unity (or other native) as the primary client
- Phaser Matter / Arcade Physics as the gameplay authority (rendering OK; integrator owns aim/flight)
- Non-Celo L1/L2 settlement for Alpha money paths
- Replacing Magic with a WalletConnect-primary onboarding for v1
- Replacing Supabase with a custom Node/Postgres/Redis stack without a lock review
- Loot-box / RNG paid rewards
- Re-enabling tournament continues without legal + lock update

**Tournament payout contract notes:** the escrow contract should emit an event at pool close (entries locked, rake computed, remaining pool split per the published payout curve) so Goldsky can index it into a public, queryable leaderboard/payout history — this is what makes the "transparent rake" claim in §6.2 actually verifiable rather than asserted.

---

## 8. Security, Compliance & Risk

- Smart contract audit mandatory before mainnet launch — this now includes the tournament escrow/payout contract specifically, given it holds pooled player funds.
- KYC/AML: tournament payouts above regulatory thresholds will likely require KYC; plan for a pluggable identity/compliance provider before scaling tournament stakes past small-dollar entry fees.
- Anti-cheat: **hybrid** — client plays with the custom 2D integrator; server replay-checks submitted runs (`anticheat=hybrid`). Tournaments must not accept continues or powerups.
- Regulatory review per country on the tournament entry-fee/rake model — skill-game vs. gambling classification varies globally and is the single largest legal risk in this PRD.
- Responsible spending: caps and cooldowns on continues (casual/daily) and tournament entries specifically, since both are designed around in-the-moment spend decisions.

---

## 9. Rollout Plan

| Phase | Scope | Timeline |
|---|---|---|
| Alpha | Core swing mechanic + wallet onboarding + powerup shop, Celo Sepolia testnet | Weeks 1–8 |
| Closed Beta | Add pay-to-continue, season pass, Goldsky indexing/leaderboards, mainnet with real cUSD | Weeks 9–14 |
| Public Launch | Tournaments live with escrow/payout contract (no continues / no powerups in paid tournaments), MiniPay co-marketing push | Week 16 |
| Post-launch | Cosmetic marketplace, boast/attestation minting as an add-on, expand tournament stake tiers | Ongoing |

---

## 10. Open Questions for Stakeholder Sign-off

1. What is the maximum tournament entry fee and prize pool size we're comfortable with pre-KYC, and at what threshold does KYC become mandatory?
2. ~~Continues in tournaments (penalty vs disabled)?~~ **Resolved by STACK_LOCK:** continues are **disabled** in paid tournaments (`legal=no_continue_tourney`). Re-open only with counsel + a new lock review.
3. What jurisdictions are in scope for launch, and has legal confirmed the 15% rake / payout-curve model in each?
4. Do we price continues at a flat rate or scale them with chain length reached (higher continue price the further a player has progressed)? Needs a data-backed pricing test before Beta (casual/daily only).

*This PRD reflects product and business strategy recommendations current as of July 2026. Stack IDs are frozen in STACK_LOCK.md. Blockchain vendor details (Celo, Goldsky, Magic.link) should be reconfirmed against current documentation before production cutover.*
