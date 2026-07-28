// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";

import {TournamentEscrow} from "../src/TournamentEscrow.sol";
import {PowerupShop} from "../src/PowerupShop.sol";
import {ContinuePurchase} from "../src/ContinuePurchase.sol";

contract DeploySepolia is Script {
    struct DeploymentConfig {
        address owner;
        address treasury;
        address paymentToken;
        uint256 continuePrice;
    }

    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        DeploymentConfig memory config = _readConfig();

        vm.startBroadcast(deployerKey);

        TournamentEscrow escrow = new TournamentEscrow(config.owner, config.treasury);
        PowerupShop powerupShop = new PowerupShop(config.owner, config.paymentToken, config.treasury);
        ContinuePurchase continuePurchase =
            new ContinuePurchase(config.owner, config.paymentToken, config.treasury, config.continuePrice);

        vm.stopBroadcast();

        _writeAddressBook(escrow, powerupShop, continuePurchase);
    }

    function _readConfig() internal view returns (DeploymentConfig memory config) {
        config.owner = vm.envAddress("DEPLOY_OWNER");
        config.treasury = vm.envAddress("TREASURY_ADDRESS");
        config.paymentToken = vm.envAddress("PAYMENT_TOKEN");
        config.continuePrice = vm.envUint("CONTINUE_PRICE");
    }

    function _writeAddressBook(
        TournamentEscrow escrow,
        PowerupShop powerupShop,
        ContinuePurchase continuePurchase
    ) internal {
        string memory objectKey = "deployment";
        vm.serializeUint(objectKey, "chainId", block.chainid);
        vm.serializeString(objectKey, "network", "celo-sepolia");
        vm.serializeAddress(objectKey, "tournamentEscrow", address(escrow));
        vm.serializeAddress(objectKey, "powerupShop", address(powerupShop));
        vm.serializeAddress(objectKey, "continuePurchase", address(continuePurchase));
        string memory json = vm.serializeString(objectKey, "deployedAt", vm.toString(block.timestamp));

        vm.writeJson(json, "contracts/deployments/celo-sepolia.json");
    }
}