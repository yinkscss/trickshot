// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {PowerupShop} from "../src/PowerupShop.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

contract PowerupShopBuyer {
    function approveToken(address token, address spender, uint256 amount) external {
        (bool ok,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, amount));
        require(ok, "approve failed");
    }

    function buy(address shop, uint256 skuId, uint256 amount) external {
        (bool ok,) = shop.call(abi.encodeWithSignature("buy(uint256,uint256)", skuId, amount));
        require(ok, "buy failed");
    }
}

contract PowerupShopTest {
    function test_buySuccessTransfersStablecoinToTreasury() public {
        MockERC20 token = new MockERC20();
        PowerupShop shop = _deployProxyShop(token);

        PowerupShopBuyer buyer = new PowerupShopBuyer();
        token.mint(address(buyer), 100 ether);
        shop.setSku(1, 2 ether, true);

        buyer.approveToken(address(token), address(shop), 100 ether);
        buyer.buy(address(shop), 1, 3);

        assert(token.balanceOf(address(this)) == 6 ether);
    }

    function test_pauseBlocksPurchasePath() public {
        MockERC20 token = new MockERC20();
        PowerupShop shop = _deployProxyShop(token);
        shop.setSku(1, 1 ether, true);
        shop.pause();

        (bool ok,) = address(shop).call(abi.encodeWithSignature("buy(uint256,uint256)", 1, 1));
        assert(!ok);
    }

    function test_inactiveSkuReverts() public {
        MockERC20 token = new MockERC20();
        PowerupShop shop = _deployProxyShop(token);

        PowerupShopBuyer buyer = new PowerupShopBuyer();
        token.mint(address(buyer), 10 ether);
        shop.setSku(2, 1 ether, false);

        buyer.approveToken(address(token), address(shop), 10 ether);
        (bool ok,) = address(buyer).call(abi.encodeWithSignature("buy(address,uint256,uint256)", address(shop), 2, 1));
        assert(!ok);
    }

    function test_paymentTokenAddressIsPinned() public {
        MockERC20 token = new MockERC20();
        PowerupShop shop = _deployProxyShop(token);
        assert(address(shop.paymentToken()) == address(token));
    }

    function _deployProxyShop(MockERC20 token) internal returns (PowerupShop) {
        PowerupShop impl = new PowerupShop();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(impl),
            abi.encodeCall(PowerupShop.initialize, (address(this), address(token), address(this)))
        );
        return PowerupShop(address(proxy));
    }
}