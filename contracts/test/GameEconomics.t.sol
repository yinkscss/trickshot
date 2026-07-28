// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {GameEconomics} from "../src/GameEconomics.sol";

contract GameEconomicsTest {
    function test_rakeSplitsAreFifteenEightyFive() public pure {
        assert(GameEconomics.HOUSE_RAKE_BPS == 1500);
        assert(GameEconomics.PLAYER_SHARE_BPS == 8500);
        assert(uint256(GameEconomics.HOUSE_RAKE_BPS) + uint256(GameEconomics.PLAYER_SHARE_BPS) == 10_000);
    }

    function test_tournamentPostureMatchesStackLock() public pure {
        assert(!GameEconomics.TOURNAMENT_ALLOWS_CONTINUES);
        assert(!GameEconomics.TOURNAMENT_ALLOWS_POWERUPS);
    }
}
