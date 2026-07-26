// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/**
 * @title GameEconomics
 * @notice Locked tournament economics from docs/STACK_LOCK.md
 * @dev Full escrow ships at Public Launch; Alpha only freezes constants.
 */
library GameEconomics {
    /// @notice House rake of prize pool — 15%
    uint16 internal constant HOUSE_RAKE_BPS = 1500;

    /// @notice Player share of prize pool — 85%
    uint16 internal constant PLAYER_SHARE_BPS = 8500;

    /// @notice Locked: continues disabled in paid tournaments
    bool internal constant TOURNAMENT_ALLOWS_CONTINUES = false;

    /// @notice Locked: powerups banned in tournament mode
    bool internal constant TOURNAMENT_ALLOWS_POWERUPS = false;
}
