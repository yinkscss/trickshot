// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {GameEconomics} from "../src/GameEconomics.sol";

contract GameEconomicsTest is Test {
    function test_rakeSplitsAreFifteenEightyFive() public pure {
        assertEq(GameEconomics.HOUSE_RAKE_BPS, 1500);
        assertEq(GameEconomics.PLAYER_SHARE_BPS, 8500);
        assertEq(
            uint256(GameEconomics.HOUSE_RAKE_BPS) + uint256(GameEconomics.PLAYER_SHARE_BPS),
            10_000
        );
    }

    function test_tournamentPostureMatchesStackLock() public pure {
        assertFalse(GameEconomics.TOURNAMENT_ALLOWS_CONTINUES);
        assertFalse(GameEconomics.TOURNAMENT_ALLOWS_POWERUPS);
    }
}
