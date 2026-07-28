// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TournamentEscrow} from "../src/TournamentEscrow.sol";
import {GameEconomics} from "../src/GameEconomics.sol";

contract TournamentEscrowTest {
    function test_previewSplit_10000_is1500_8500() public {
        TournamentEscrow escrow = new TournamentEscrow(address(this), address(this));
        (uint256 rakeAmount, uint256 netPool) = escrow.previewSplit(10_000);

        assert(rakeAmount == 1_500);
        assert(netPool == 8_500);
    }

    function testFuzz_previewSplit_matchesRakeConstant(uint96 grossPool) public {
        TournamentEscrow escrow = new TournamentEscrow(address(this), address(this));
        (uint256 rakeAmount, uint256 netPool) = escrow.previewSplit(grossPool);

        uint256 expectedRake = (uint256(grossPool) * GameEconomics.HOUSE_RAKE_BPS) / 10_000;
        assert(rakeAmount == expectedRake);
        assert(rakeAmount + netPool == grossPool);
    }

    function test_createTournamentPinsHouseRakeFromGameEconomics() public {
        TournamentEscrow escrow = new TournamentEscrow(address(this), address(this));

        uint16[] memory curve = new uint16[](2);
        curve[0] = 7000;
        curve[1] = 3000;

        uint256 id = escrow.createTournament(
            address(0xC0FFEE),
            10 ether,
            uint64(block.timestamp + 1 days),
            uint64(block.timestamp + 2 days),
            2,
            100,
            curve
        );

        TournamentEscrow.Tournament memory t = escrow.getTournament(id);

        assert(t.entryToken == address(0xC0FFEE));
        assert(t.entryFee == 10 ether);
        assert(t.startTime < t.endTime);
        assert(t.minPlayers == 2);
        assert(t.maxPlayers == 100);
        assert(t.rakeBps == GameEconomics.HOUSE_RAKE_BPS);
    }
}