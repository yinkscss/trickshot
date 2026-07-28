# TournamentEscrow Events for Goldsky

Contract source: `contracts/src/TournamentEscrow.sol`

## Recommended entities

- Tournament (id)
- TournamentEntry (id + player)
- TournamentPayout (id + player + rank)
- TournamentPayment (id + player)
- TournamentTreasuryPayment (id)

## Event catalog

### TournamentCreated

Signature:

`TournamentCreated(uint256 indexed id, address indexed entryToken, uint256 entryFee, uint64 start, uint64 end, uint16 rakeBps, uint32 minPlayers, uint32 maxPlayers, bytes32 payoutCurveHash)`

Use:

- Create tournament row.
- Persist fee/token/time window and fixed rake bps.
- Persist `payoutCurveHash` to cross-check backend payout declarations.

### PlayerEntered

Signature:

`PlayerEntered(uint256 indexed id, address indexed player, uint256 entryFee)`

Use:

- Create entrant row per `(id, player)`.
- Increment entrant counters and gross pool estimates off-chain.

### TournamentLocked

Signature:

`TournamentLocked(uint256 indexed id, uint32 playerCount, uint256 grossPool)`

Use:

- Mark tournament as entry-closed and lock player count/pool snapshot.

### TournamentCancelled

Signature:

`TournamentCancelled(uint256 indexed id, string reason)`

Use:

- Mark cancellation cause for analytics and support workflows.

### TournamentSettled

Signature:

`TournamentSettled(uint256 indexed id, uint256 grossPool, uint256 rakeAmount, uint256 netPool)`

Use:

- Canonical settlement totals.
- Required for rake analytics dashboards.

### PayoutAssigned

Signature:

`PayoutAssigned(uint256 indexed id, address indexed player, uint256 amount, uint16 rank, uint16 bps)`

Use:

- Persist payout intent by rank for each winner.
- Power result pages and delayed withdrawal UIs.

### PlayerPaid

Signature:

`PlayerPaid(uint256 indexed id, address indexed player, uint256 amount)`

Use:

- Mark payout execution completion.
- Required baseline event in issue acceptance list.

### PlayerRefunded

Signature:

`PlayerRefunded(uint256 indexed id, address indexed player, uint256 amount)`

Use:

- Track refund credits emitted during cancellations.

### TreasuryPaid

Signature:

`TreasuryPaid(uint256 indexed id, address indexed treasury, uint256 amount)`

Use:

- Track realized house revenue transfers.

### HouseTreasuryUpdated

Signature:

`HouseTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury)`

Use:

- Governance/config audit trail.

## Mapping notes

- Treat `(txHash, logIndex)` as immutable idempotency key for API confirms.
- Prefer storing numeric values as BigInt/BigDecimal in subgraph mappings.
- Keep tournament id as canonical join key across entities.
