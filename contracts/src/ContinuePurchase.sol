// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {GameEconomics} from "./GameEconomics.sol";
import {UpgradeableGoverned} from "./UpgradeableGoverned.sol";

/**
 * @title ContinuePurchase
 * @notice Testnet continue purchase contract with explicit tournament-mode ban.
 */
contract ContinuePurchase is UpgradeableGoverned {
    using SafeERC20 for IERC20;

    enum RunMode {
        Casual,
        Daily,
        Tournament
    }

    error InvalidToken();
    error InvalidPrice();
    error TournamentContinuesDisabled();

    event ContinuePurchased(
        address indexed buyer,
        bytes32 indexed runIdHint,
        uint256 price,
        address paymentToken,
        uint64 ts
    );
    event ContinuePriceUpdated(uint256 oldPrice, uint256 newPrice);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);

    IERC20 public paymentToken;
    address public treasury;
    uint256 public continuePrice;

    function initialize(address initialOwner, address token, address initialTreasury, uint256 initialPrice)
        external
        initializer
    {
        __UpgradeableGoverned_init(initialOwner);
        if (token == address(0) || initialTreasury == address(0)) {
            revert InvalidToken();
        }
        if (initialPrice == 0) {
            revert InvalidPrice();
        }
        paymentToken = IERC20(token);
        treasury = initialTreasury;
        continuePrice = initialPrice;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) {
            revert InvalidToken();
        }
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }

    function setContinuePrice(uint256 newPrice) external onlyOwner {
        if (newPrice == 0) {
            revert InvalidPrice();
        }
        uint256 oldPrice = continuePrice;
        continuePrice = newPrice;
        emit ContinuePriceUpdated(oldPrice, newPrice);
    }

    function buyContinue(bytes32 runIdHint, RunMode mode) external whenNotPaused nonReentrant {
        if (!GameEconomics.TOURNAMENT_ALLOWS_CONTINUES && mode == RunMode.Tournament) {
            revert TournamentContinuesDisabled();
        }

        paymentToken.safeTransferFrom(msg.sender, treasury, continuePrice);

        emit ContinuePurchased(
            msg.sender,
            runIdHint,
            continuePrice,
            address(paymentToken),
            uint64(block.timestamp)
        );
    }
}