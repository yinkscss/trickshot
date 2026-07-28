// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface ITournamentEscrow {
    enum TournamentStatus {
        None,
        Created,
        Locked,
        Settled,
        Cancelled
    }

    struct Tournament {
        address entryToken;
        uint256 entryFee;
        uint64 startTime;
        uint64 endTime;
        uint32 minPlayers;
        uint32 maxPlayers;
        uint16 rakeBps;
        TournamentStatus status;
        uint32 playerCount;
        uint256 grossPool;
        uint256 rakeAmount;
        uint256 netPool;
        bytes32 payoutCurveHash;
    }

    event TournamentCreated(
        uint256 indexed id,
        address indexed entryToken,
        uint256 entryFee,
        uint64 start,
        uint64 end,
        uint16 rakeBps,
        uint32 minPlayers,
        uint32 maxPlayers,
        bytes32 payoutCurveHash
    );
    event PlayerEntered(uint256 indexed id, address indexed player, uint256 entryFee);
    event TournamentLocked(uint256 indexed id, uint32 playerCount, uint256 grossPool);
    event TournamentCancelled(uint256 indexed id, string reason);
    event TournamentSettled(uint256 indexed id, uint256 grossPool, uint256 rakeAmount, uint256 netPool);
    event PayoutAssigned(uint256 indexed id, address indexed player, uint256 amount, uint16 rank, uint16 bps);
    event PlayerPaid(uint256 indexed id, address indexed player, uint256 amount);
    event PlayerRefunded(uint256 indexed id, address indexed player, uint256 amount);
    event TreasuryPaid(uint256 indexed id, address indexed treasury, uint256 amount);
    event HouseTreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    error Unauthorized();
    error InvalidTournament();
    error InvalidToken();
    error InvalidTimes();
    error InvalidEntryFee();
    error InvalidPlayerBounds();
    error InvalidPayoutCurve();
    error InvalidStatus();
    error EntryClosed();
    error AlreadyEntered();
    error TooManyPlayers();
    error TooFewPlayers();
    error NothingToWithdraw();
    error InvalidWinnerInput();

    function createTournament(
        address entryToken,
        uint256 entryFee,
        uint64 start,
        uint64 end,
        uint32 minPlayers,
        uint32 maxPlayers,
        uint16[] calldata payoutCurveBps
    ) external returns (uint256 id);

    function enterTournament(uint256 id) external;
    function lockTournament(uint256 id) external;
    function cancelTournament(uint256 id, string calldata reason) external;

    function settleTournament(
        uint256 id,
        address[] calldata winners,
        uint16[] calldata winnerPayoutBps
    ) external;

    function withdraw(uint256 id) external;
    function withdrawTreasury(uint256 id) external;

    function previewSplit(uint256 grossPool) external pure returns (uint256 rakeAmount, uint256 netPool);
    function tournamentAllowsContinues() external pure returns (bool);
    function tournamentAllowsPowerups() external pure returns (bool);
    function getTournament(uint256 id) external view returns (Tournament memory);
    function getPayoutCurve(uint256 id) external view returns (uint16[] memory);
    function getEntrants(uint256 id) external view returns (address[] memory);
}