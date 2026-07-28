// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ContinuePurchase} from "../src/ContinuePurchase.sol";
import {MockERC20} from "./mocks/MockERC20.sol";

contract ContinueBuyer {
    function approveToken(address token, address spender, uint256 amount) external {
        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
        require(ok, "approve failed");
    }

    function buy(address store, bytes32 runIdHint, uint8 mode) external {
        (bool ok,) = store.call(
            abi.encodeWithSignature("buyContinue(bytes32,uint8)", runIdHint, mode)
        );
        require(ok, "buy failed");
    }
}

contract ContinuePurchaseTest {
    function test_continuePurchaseSuccessInCasualMode() public {
        MockERC20 token = new MockERC20();
        ContinuePurchase store = new ContinuePurchase(address(this), address(token), address(this), 1 ether);

        ContinueBuyer buyer = new ContinueBuyer();
        token.mint(address(buyer), 3 ether);

        buyer.approveToken(address(token), address(store), 3 ether);
        buyer.buy(address(store), bytes32("run-1"), uint8(ContinuePurchase.RunMode.Casual));

        assert(token.balanceOf(address(this)) == 1 ether);
    }

    function test_tournamentModeIsRejected() public {
        MockERC20 token = new MockERC20();
        ContinuePurchase store = new ContinuePurchase(address(this), address(token), address(this), 1 ether);

        ContinueBuyer buyer = new ContinueBuyer();
        token.mint(address(buyer), 3 ether);
        buyer.approveToken(address(token), address(store), 3 ether);

        (bool ok,) = address(buyer).call(
            abi.encodeWithSignature(
                "buy(address,bytes32,uint8)",
                address(store),
                bytes32("run-2"),
                uint8(ContinuePurchase.RunMode.Tournament)
            )
        );
        assert(!ok);
    }

    function test_pauseBlocksPurchase() public {
        MockERC20 token = new MockERC20();
        ContinuePurchase store = new ContinuePurchase(address(this), address(token), address(this), 1 ether);
        store.pause();

        (bool ok,) = address(store).call(
            abi.encodeWithSignature(
                "buyContinue(bytes32,uint8)",
                bytes32("run-3"),
                uint8(ContinuePurchase.RunMode.Casual)
            )
        );
        assert(!ok);
    }

    function test_paymentTokenAddressIsPinned() public {
        MockERC20 token = new MockERC20();
        ContinuePurchase store = new ContinuePurchase(address(this), address(token), address(this), 1 ether);
        assert(address(store.paymentToken()) == address(token));
    }
}