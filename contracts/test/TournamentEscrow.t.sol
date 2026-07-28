// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {TournamentEscrow} from "../src/TournamentEscrow.sol";
import {GameEconomics} from "../src/GameEconomics.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract TournamentEscrowHarness is TournamentEscrow {
    function exposedAuthorizeUpgrade(address newImplementation) external {
        _authorizeUpgrade(newImplementation);
    }
}

contract TournamentEscrowTest {
    function test_previewSplit_10000_is1500_8500() public {
        TournamentEscrow escrow = _deployProxyEscrow();
        (uint256 rakeAmount, uint256 netPool) = escrow.previewSplit(10_000);

        assert(rakeAmount == 1_500);
        assert(netPool == 8_500);
    }

    function testFuzz_previewSplit_matchesRakeConstant(uint96 grossPool) public {
        TournamentEscrow escrow = _deployProxyEscrow();
        (uint256 rakeAmount, uint256 netPool) = escrow.previewSplit(grossPool);

        uint256 expectedRake = (uint256(grossPool) * GameEconomics.HOUSE_RAKE_BPS) / 10_000;
        assert(rakeAmount == expectedRake);
        assert(rakeAmount + netPool == grossPool);
    }

    function test_createTournamentPinsHouseRakeFromGameEconomics() public {
        TournamentEscrow escrow = _deployProxyEscrow();

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

    function test_ownerCanAuthorizeUpgradePath() public {
        TournamentEscrowHarness impl = new TournamentEscrowHarness();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(TournamentEscrow.initialize, (address(this), address(this)))
        );

        TournamentEscrowHarness proxied = TournamentEscrowHarness(address(proxy));
        proxied.exposedAuthorizeUpgrade(address(new TournamentEscrowHarness()));
    }

    function _deployProxyEscrow() internal returns (TournamentEscrow) {
        TournamentEscrow impl = new TournamentEscrow();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(TournamentEscrow.initialize, (address(this), address(this)))
        );
        return TournamentEscrow(address(proxy));
    }
}