// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PowerupShop
 * @notice Testnet fixed-price powerup store paid in ERC-20 stablecoins.
 * @dev Deterministic purchases only. No RNG paths.
 */
contract PowerupShop is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Sku {
        uint256 unitPrice;
        bool active;
    }

    error InvalidToken();
    error InvalidSku();
    error InactiveSku();
    error InvalidAmount();

    event PowerupPurchased(
        address indexed buyer,
        uint256 indexed skuId,
        uint256 amount,
        uint256 unitPrice,
        uint256 totalPrice,
        address paymentToken,
        uint64 ts
    );
    event SkuUpdated(uint256 indexed skuId, uint256 price, bool active);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    IERC20 public immutable paymentToken;
    address public treasury;

    mapping(uint256 => Sku) public skus;

    constructor(address initialOwner, address token, address initialTreasury) Ownable(initialOwner) {
        if (token == address(0) || initialTreasury == address(0)) {
            revert InvalidToken();
        }
        paymentToken = IERC20(token);
        treasury = initialTreasury;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) {
            revert InvalidToken();
        }
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function setSku(uint256 skuId, uint256 unitPrice, bool active) external onlyOwner {
        if (skuId == 0 || unitPrice == 0) {
            revert InvalidSku();
        }
        skus[skuId] = Sku({unitPrice: unitPrice, active: active});
        emit SkuUpdated(skuId, unitPrice, active);
    }

    function buyPowerup(uint256 skuId) external {
        buy(skuId, 1);
    }

    function buy(uint256 skuId, uint256 amount) public whenNotPaused nonReentrant {
        if (amount == 0) {
            revert InvalidAmount();
        }

        Sku memory sku = skus[skuId];
        if (sku.unitPrice == 0) {
            revert InvalidSku();
        }
        if (!sku.active) {
            revert InactiveSku();
        }

        uint256 totalPrice = sku.unitPrice * amount;
        paymentToken.safeTransferFrom(msg.sender, treasury, totalPrice);

        emit PowerupPurchased(
            msg.sender,
            skuId,
            amount,
            sku.unitPrice,
            totalPrice,
            address(paymentToken),
            uint64(block.timestamp)
        );
    }
}