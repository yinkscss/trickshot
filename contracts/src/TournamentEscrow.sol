// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {GameEconomics} from "./GameEconomics.sol";
import {ITournamentEscrow} from "./interfaces/ITournamentEscrow.sol";

/**
 * @title TournamentEscrow
 * @notice Non-mainnet tournament escrow skeleton with transparent 85/15 settlement.
 * @dev This is an Alpha/Beta foundation and not the audited mainnet escrow.
 */
contract TournamentEscrow is ITournamentEscrow, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 internal constant BPS_DENOMINATOR = 10_000;

    address public houseTreasury;
    uint256 public nextTournamentId = 1;

    mapping(uint256 => Tournament) internal tournaments;
    mapping(uint256 => uint16[]) internal payoutCurves;
    mapping(uint256 => address[]) internal entrants;
    mapping(uint256 => mapping(address => bool)) internal hasEntered;
    mapping(uint256 => mapping(address => uint256)) internal claimableByPlayer;
    mapping(uint256 => uint256) internal claimableByTreasury;

    constructor(address initialOwner, address initialTreasury) Ownable(initialOwner) {
        if (initialTreasury == address(0)) {
            revert InvalidToken();
        }
        houseTreasury = initialTreasury;
    }

    function setHouseTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) {
            revert InvalidToken();
        }
        address oldTreasury = houseTreasury;
        houseTreasury = newTreasury;
        emit HouseTreasuryUpdated(oldTreasury, newTreasury);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function createTournament(
        address entryToken,
        uint256 entryFee,
        uint64 start,
        uint64 end,
        uint32 minPlayers,
        uint32 maxPlayers,
        uint16[] calldata payoutCurveBps
    ) external onlyOwner whenNotPaused returns (uint256 id) {
        if (entryToken == address(0)) {
            revert InvalidToken();
        }
        if (entryFee == 0) {
            revert InvalidEntryFee();
        }
        if (start >= end) {
            revert InvalidTimes();
        }
        if (minPlayers == 0 || maxPlayers == 0 || minPlayers > maxPlayers) {
            revert InvalidPlayerBounds();
        }

        bytes32 payoutCurveHash = _validateAndHashPayoutCurve(payoutCurveBps);

        id = nextTournamentId++;

        Tournament storage t = tournaments[id];
        t.entryToken = entryToken;
        t.entryFee = entryFee;
        t.startTime = start;
        t.endTime = end;
        t.minPlayers = minPlayers;
        t.maxPlayers = maxPlayers;
        t.rakeBps = GameEconomics.HOUSE_RAKE_BPS;
        t.status = TournamentStatus.Created;
        t.payoutCurveHash = payoutCurveHash;

        for (uint256 i = 0; i < payoutCurveBps.length; i++) {
            payoutCurves[id].push(payoutCurveBps[i]);
        }

        emit TournamentCreated(
            id,
            entryToken,
            entryFee,
            start,
            end,
            t.rakeBps,
            minPlayers,
            maxPlayers,
            payoutCurveHash
        );
    }

    function enterTournament(uint256 id) external nonReentrant whenNotPaused {
        Tournament storage t = tournaments[id];
        if (t.status != TournamentStatus.Created) {
            revert InvalidStatus();
        }
        if (block.timestamp >= t.startTime) {
            revert EntryClosed();
        }
        if (hasEntered[id][msg.sender]) {
            revert AlreadyEntered();
        }
        if (t.playerCount >= t.maxPlayers) {
            revert TooManyPlayers();
        }

        hasEntered[id][msg.sender] = true;
        entrants[id].push(msg.sender);
        t.playerCount += 1;
        t.grossPool += t.entryFee;

        IERC20(t.entryToken).safeTransferFrom(msg.sender, address(this), t.entryFee);

        emit PlayerEntered(id, msg.sender, t.entryFee);
    }

    function lockTournament(uint256 id) external onlyOwner whenNotPaused {
        Tournament storage t = tournaments[id];
        if (t.status != TournamentStatus.Created) {
            revert InvalidStatus();
        }
        if (block.timestamp < t.startTime) {
            revert InvalidStatus();
        }
        if (t.playerCount < t.minPlayers) {
            revert TooFewPlayers();
        }

        t.status = TournamentStatus.Locked;
        emit TournamentLocked(id, t.playerCount, t.grossPool);
    }

    function cancelTournament(uint256 id, string calldata reason) external onlyOwner whenNotPaused {
        Tournament storage t = tournaments[id];
        if (t.status != TournamentStatus.Created && t.status != TournamentStatus.Locked) {
            revert InvalidStatus();
        }

        t.status = TournamentStatus.Cancelled;

        address[] storage players = entrants[id];
        for (uint256 i = 0; i < players.length; i++) {
            claimableByPlayer[id][players[i]] += t.entryFee;
            emit PlayerRefunded(id, players[i], t.entryFee);
        }

        emit TournamentCancelled(id, reason);
    }

    function settleTournament(
        uint256 id,
        address[] calldata winners,
        uint16[] calldata winnerPayoutBps
    ) external onlyOwner whenNotPaused {
        Tournament storage t = tournaments[id];
        if (t.status != TournamentStatus.Locked) {
            revert InvalidStatus();
        }
        if (winners.length == 0 || winners.length != winnerPayoutBps.length) {
            revert InvalidWinnerInput();
        }

        uint256 totalWinnerBps;
        for (uint256 i = 0; i < winnerPayoutBps.length; i++) {
            totalWinnerBps += winnerPayoutBps[i];
        }
        if (totalWinnerBps != BPS_DENOMINATOR) {
            revert InvalidWinnerInput();
        }

        (uint256 rakeAmount, uint256 netPool) = previewSplit(t.grossPool);
        t.rakeAmount = rakeAmount;
        t.netPool = netPool;

        uint256 paidFromNet;
        for (uint256 i = 0; i < winners.length; i++) {
            uint16 bps = winnerPayoutBps[i];
            uint256 amount = (netPool * bps) / BPS_DENOMINATOR;
            claimableByPlayer[id][winners[i]] += amount;
            paidFromNet += amount;
            emit PayoutAssigned(id, winners[i], amount, uint16(i + 1), bps);
        }

        // Any residual dust from integer division goes to treasury.
        claimableByTreasury[id] += rakeAmount + (netPool - paidFromNet);

        t.status = TournamentStatus.Settled;

        emit TournamentSettled(id, t.grossPool, rakeAmount, netPool);
    }

    function withdraw(uint256 id) external nonReentrant {
        Tournament storage t = tournaments[id];
        uint256 amount = claimableByPlayer[id][msg.sender];
        if (amount == 0) {
            revert NothingToWithdraw();
        }

        claimableByPlayer[id][msg.sender] = 0;
        IERC20(t.entryToken).safeTransfer(msg.sender, amount);

        emit PlayerPaid(id, msg.sender, amount);
    }

    function withdrawTreasury(uint256 id) external nonReentrant {
        if (msg.sender != houseTreasury) {
            revert Unauthorized();
        }

        Tournament storage t = tournaments[id];
        uint256 amount = claimableByTreasury[id];
        if (amount == 0) {
            revert NothingToWithdraw();
        }

        claimableByTreasury[id] = 0;
        IERC20(t.entryToken).safeTransfer(msg.sender, amount);

        emit TreasuryPaid(id, msg.sender, amount);
    }

    function previewSplit(uint256 grossPool) public pure returns (uint256 rakeAmount, uint256 netPool) {
        rakeAmount = (grossPool * GameEconomics.HOUSE_RAKE_BPS) / BPS_DENOMINATOR;
        netPool = grossPool - rakeAmount;
    }

    function tournamentAllowsContinues() external pure returns (bool) {
        return GameEconomics.TOURNAMENT_ALLOWS_CONTINUES;
    }

    function tournamentAllowsPowerups() external pure returns (bool) {
        return GameEconomics.TOURNAMENT_ALLOWS_POWERUPS;
    }

    function getTournament(uint256 id) external view returns (Tournament memory) {
        return tournaments[id];
    }

    function getPayoutCurve(uint256 id) external view returns (uint16[] memory) {
        return payoutCurves[id];
    }

    function getEntrants(uint256 id) external view returns (address[] memory) {
        return entrants[id];
    }

    function _validateAndHashPayoutCurve(uint16[] calldata payoutCurveBps)
        internal
        pure
        returns (bytes32 payoutCurveHash)
    {
        if (payoutCurveBps.length == 0) {
            revert InvalidPayoutCurve();
        }

        uint256 totalBps;
        for (uint256 i = 0; i < payoutCurveBps.length; i++) {
            totalBps += payoutCurveBps[i];
        }

        if (totalBps != BPS_DENOMINATOR) {
            revert InvalidPayoutCurve();
        }

        payoutCurveHash = keccak256(abi.encode(payoutCurveBps));
    }
}