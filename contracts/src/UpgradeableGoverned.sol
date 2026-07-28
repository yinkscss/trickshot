// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Initializable} from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts/proxy/utils/UUPSUpgradeable.sol";

abstract contract UpgradeableGoverned is Initializable, UUPSUpgradeable {
    error UpgradeableUnauthorized();
    error UpgradeableInvalidOwner();
    error UpgradeableEnforcedPause();
    error UpgradeableExpectedPause();
    error UpgradeableReentrantCall();

    uint256 private constant NOT_ENTERED = 1;
    uint256 private constant ENTERED = 2;

    address private _owner;
    bool private _paused;
    uint256 private _reentrancyStatus;

    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);
    event Paused(address indexed account);
    event Unpaused(address indexed account);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier onlyOwner() {
        if (msg.sender != _owner) {
            revert UpgradeableUnauthorized();
        }
        _;
    }

    modifier whenNotPaused() {
        if (_paused) {
            revert UpgradeableEnforcedPause();
        }
        _;
    }

    modifier whenPaused() {
        if (!_paused) {
            revert UpgradeableExpectedPause();
        }
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus == ENTERED) {
            revert UpgradeableReentrantCall();
        }
        _reentrancyStatus = ENTERED;
        _;
        _reentrancyStatus = NOT_ENTERED;
    }

    function owner() public view returns (address) {
        return _owner;
    }

    function paused() public view returns (bool) {
        return _paused;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) {
            revert UpgradeableInvalidOwner();
        }
        address oldOwner = _owner;
        _owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function pause() external onlyOwner whenNotPaused {
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner whenPaused {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    function __UpgradeableGoverned_init(address initialOwner) internal onlyInitializing {
        if (initialOwner == address(0)) {
            revert UpgradeableInvalidOwner();
        }
        _owner = initialOwner;
        _reentrancyStatus = NOT_ENTERED;
        emit OwnershipTransferred(address(0), initialOwner);
    }

    function _authorizeUpgrade(address) internal override onlyOwner {}
}