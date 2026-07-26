# Product Requirements Document
## "Trick Shot" — A Precision Chain-Hoop Game on Celo

**Document owner:** Senior Product Manager
**Status:** Draft v1.0
**Date:** July 26, 2026

---

## 1. Executive Summary

Trick Shot is a mobile-first, single-input arcade game — a precision "swing the ball through a chain of hoops" loop, in the spirit of Ketchapp-style drop/swing games — built on Celo, an Ethereum L2 optimized for low-cost, mobile-friendly stablecoin payments. Unlike Fruit Slash's cosmetic-and-boast model, Trick Shot's monetization is built around three levers: **powerup purchases**, **pay-to-continue**, and a **season pass** — layered on top of skill-based tournaments where the house takes a **15% rake of the prize pool**.

Celo remains the settlement layer of choice: sub-cent transaction fees, gas payable directly in cUSD/USDC/USDT, ~1 second block times, and distribution reach through Opera's MiniPay wallet (16M+ wallets across 65+ countries).

## 2. Problem Statement & Opportunity

**Problem:** "Endless chain" arcade games (Dunk Shot, Helix Jump, Stack) monetize almost entirely through interstitial ads and app-store IAP for continues. This caps margins (15–30% app-store take), makes revenge-spend mechanics (continues) opaque, and gives the studio no verifiable, ownable competitive layer.

**Opportunity:**
- Sell powerups and continues directly in stablecoins, at near-zero gas cost, so a $0.49 continue doesn't lose 30 cents to a payment processor or app store.
- Run tournaments where the entry fee and prize pool are transparent and settled on-chain, with the house rake visible and fixed rather than buried in odds.
- Use Celo's MiniPay distribution as a low-CAC channel into emerging markets where stablecoin rails outperform card rails.

## 3. Goals & Success Metrics

### Business Goals
1. Launch a free-to-play core loop with paid powerups, paid continues, and a seasonal subscription, reaching positive unit economics within 2 quarters.
2. Stand up skill-based tournaments with a 15% house rake as a recurring, predictable revenue stream — not a one-off event.
3. Achieve Day-30 retention ≥ 20% and a paying-user rate ≥ 6%, with continues as the primary conversion moment (skill-based "just one more try" spend).

### Non-Goals (v1)
- No peer-to-peer wagering pools (two players staking directly against each other) — tournaments use a fixed entry fee, pooled prize, and house rake, not a betting market.
- No speculative token or yield product at launch.
- No randomized paid loot boxes — powerups and cosmetics are fixed-price, fixed-effect purchases.

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

## 4. Target Users & Personas

1. **Casual Mobile Gamer (primary, global)** — 5–10 minute sessions, spends small amounts on continues in the heat of a run; the wallet is invisible to them.
2. **MiniPay / Emerging-Market Stablecoin User (acquisition wedge)** — already holds cUSD/USDT via Opera MiniPay, low data-cost sensitivity, values near-zero fees for small, frequent purchases like continues and powerups.
3. **Competitive Chain-Runner** — plays for leaderboard position and tournament prize pools, buys powerups deliberately to push personal-best chains rather than impulsively mid-run.

## 5. Core Gameplay (Feature Scope)

### 5.1 Core Loop (v1 — table stakes)
- Single-input swing mechanic: tap-hold to release the ball from the current hoop into the next.
- Chain scoring: consecutive clean swings build a multiplier; a miss ends the run unless a continue or shield is used.
- Obstacles: spinner bars, moving hoops, narrow-gap hoops that raise the skill ceiling as the chain lengthens.
- Star pickups along the chain feed the soft-currency loop (used for cosmetic and minor powerup purchases without spending cUSD directly).
- Daily challenges, streaks, and local/global leaderboards.

### 5.2 Web3-Native Features
- **Invisible wallet onboarding** via Magic.link — email/social/phone login, non-custodial wallet provisioned behind the scenes.
- **On-chain run attestation:** a player's verified best chain can be minted as a timestamped, shareable proof — same "boast" mechanic as Fruit Slash, offered as an optional add-on rather than the primary monetization lever this time.
- **Tournaments:** entry-fee (cUSD) competitions on a fixed time window; smart-contract-escrowed prize pool; automated payout to top finishers; **house takes a 15% rake of the total prize pool**, distributed transparently on-chain so the rake percentage and payout schedule are verifiable by any entrant before they pay in.

## 6. Business Model & Monetization

### 6.1 Revenue Streams

| Stream | Mechanic | Price range (cUSD) | Notes |
|---|---|---|---|
| Powerups | Aim assist, slow-drop, wide-hoop, magnet-star | $0.29–$1.99 | Sold individually or in bundles; usable in casual/ranked practice modes |
| Continue | Resume a run after a miss, once per run (paid tier) or watch-to-continue (ad tier) | $0.49–$1.49, scales with chain length reached | Primary conversion moment — the "one more try" spend |
| Season Pass | Seasonal reward track: cosmetics, bonus soft-currency, exclusive powerup skins | $4.99 / season (4–6 weeks) | Recurring revenue anchor |
| Tournament entry | Fixed entry fee into a timed leaderboard competition | $1–$20 entry | **House rake: 15% of total prize pool.** Remaining 85% distributed to top finishers per a published payout curve |
| Cosmetic shop | Ball skins, hoop rim styles, trail effects (ERC-1155) | $0.99–$5.99 | Secondary, ownership-driven revenue; not the primary lever in this model |
| Marketplace royalty | Secondary sale of cosmetic NFTs | 5% royalty | Passive long-tail revenue |
| Ads (opt-in, rewarded only) | Watch-to-continue, watch-for-soft-currency | eCPM-based | Non-paying-user monetization and the "free" continue path |

### 6.2 Why the Continue + Tournament-Rake Model Benefits from On-Chain Rails

- **Micro-transaction viability:** a $0.49 continue only clears app-store IAP economics at scale; at Celo's sub-cent gas cost, it clears at almost any volume, including a single impulse purchase mid-run.
- **Transparent rake:** because the prize pool and the 15% house cut settle via a public smart contract, the rake is auditable by players rather than asserted in a terms-of-service document — a trust signal for a real-money competitive product.
- **Fast settlement:** ~1 second block times mean a continue purchase clears before the player's next input, preserving the "flow state" that endless-runner games depend on.
- **App-store fee avoidance:** routing continues, powerups, and tournament entries through a web/PWA checkout (where store policy allows) keeps the 15–30% app-store cut out of the highest-frequency purchase moments.

### 6.3 Pricing & Economy Guardrails

- Powerups are **not usable in Tournament mode** — tournament runs are powerup-free to preserve competitive integrity and to keep the mode defensible as skill-based rather than pay-to-win.
- Continues **are allowed** in Tournament mode but count against the player's final score (e.g., a fixed point penalty per continue) so spending doesn't simply buy the win outright.
- Daily spend caps with a soft warning, and a self-exclusion/limit-setting option, given real-money tournament stakes.
- No randomized-outcome purchases anywhere in the powerup, continue, or season-pass systems — every purchase has a fixed, disclosed effect.
- **Legal review required, per jurisdiction, before launch.** A fixed entry fee with a disclosed house rake and skill-determined payout is generally treated differently from wagering in many jurisdictions, but this varies by country and by the specific payout structure — confirm with counsel before enabling real-money tournaments in any market. This PRD is not legal advice.

## 7. Tech Stack Recommendation

Unchanged from the Fruit Slash PRD's stack, since both games share the same Celo-native purchase and attestation infrastructure:

| Layer | Choice |
|---|---|
| Blockchain | Celo (Ethereum L2) |
| Wallet/Auth | Magic.link (embedded wallets, passwordless) |
| On-chain data indexing | Goldsky (Subgraphs + Mirror) |
| Smart contracts | Solidity, Foundry, OpenZeppelin |
| Tournament escrow/payout | Purpose-built escrow contract: collects entry fees, holds prize pool, splits 85%/15% on settlement, publishes payout on-chain |
| Game client | Web-based (Phaser 3 PWA / browser-first); optional Capacitor wrap later for stores |
| Backend | Node.js/TypeScript, Postgres, Redis |
| Hosting | AWS/GCP + Cloudflare |

**Tournament payout contract notes:** the escrow contract should emit an event at pool close (entries locked, rake computed, remaining pool split per the published payout curve) so Goldsky can index it into a public, queryable leaderboard/payout history — this is what makes the "transparent rake" claim in §6.2 actually verifiable rather than asserted.

## 8. Security, Compliance & Risk

- Smart contract audit mandatory before mainnet launch — this now includes the tournament escrow/payout contract specifically, given it holds pooled player funds.
- KYC/AML: tournament payouts above regulatory thresholds will likely require KYC; plan for a pluggable identity/compliance provider before scaling tournament stakes past small-dollar entry fees.
- Anti-cheat: server-authoritative chain/score validation, since tournament payouts create a direct financial incentive to falsify client-side scores.
- Regulatory review per country on the tournament entry-fee/rake model — skill-game vs. gambling classification varies globally and is the single largest legal risk in this PRD.
- Responsible spending: caps and cooldowns on continues and tournament entries specifically, since both are designed around in-the-moment spend decisions.

## 9. Rollout Plan

| Phase | Scope | Timeline |
|---|---|---|
| Alpha | Core swing mechanic + wallet onboarding + powerup shop, testnet | Weeks 1–8 |
| Closed Beta | Add pay-to-continue, season pass, Goldsky indexing/leaderboards, mainnet with real cUSD | Weeks 9–14 |
| Public Launch | Tournaments live with escrow/payout contract, MiniPay co-marketing push | Week 16 |
| Post-launch | Cosmetic marketplace, boast/attestation minting as an add-on, expand tournament stake tiers | Ongoing |

## 10. Open Questions for Stakeholder Sign-off

1. What is the maximum tournament entry fee and prize pool size we're comfortable with pre-KYC, and at what threshold does KYC become mandatory?
2. Does the continue-penalty design (fixed point deduction per continue in Tournament mode) sufficiently preserve the "skill-based" classification, or does legal want continues disabled entirely in paid tournaments?
3. What jurisdictions are in scope for launch, and has legal confirmed the 15% rake / payout-curve model in each?
4. Do we price continues at a flat rate or scale them with chain length reached (higher continue price the further a player has progressed)? Needs a data-backed pricing test before Beta.

*This PRD reflects product and business strategy recommendations current as of July 2026. Blockchain infrastructure details (Celo, Goldsky, Magic.link feature sets and pricing) should be reconfirmed against current vendor documentation before final engineering commitment.*
