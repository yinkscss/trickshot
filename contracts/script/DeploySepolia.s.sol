// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script} from "forge-std/Script.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

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

        (string memory networkName, string memory outputPath) = _networkMetadata();

        vm.startBroadcast(deployerKey);

        TournamentEscrow escrowImpl = new TournamentEscrow();
        PowerupShop powerupShopImpl = new PowerupShop();
        ContinuePurchase continuePurchaseImpl = new ContinuePurchase();

        ERC1967Proxy escrowProxy = new ERC1967Proxy(
            address(escrowImpl),
            abi.encodeCall(TournamentEscrow.initialize, (config.owner, config.treasury))
        );
        ERC1967Proxy powerupShopProxy = new ERC1967Proxy(
            address(powerupShopImpl),
            abi.encodeCall(PowerupShop.initialize, (config.owner, config.paymentToken, config.treasury))
        );
        ERC1967Proxy continuePurchaseProxy = new ERC1967Proxy(
            address(continuePurchaseImpl),
            abi.encodeCall(
                ContinuePurchase.initialize,
                (config.owner, config.paymentToken, config.treasury, config.continuePrice)
            )
        );

        vm.stopBroadcast();

        _writeAddressBook(
            escrowImpl,
            powerupShopImpl,
            continuePurchaseImpl,
            TournamentEscrow(address(escrowProxy)),
            PowerupShop(address(powerupShopProxy)),
            ContinuePurchase(address(continuePurchaseProxy)),
            networkName,
            outputPath
        );
    }

    function _networkMetadata() internal view returns (string memory networkName, string memory outputPath) {
        if (block.chainid == 11142220) {
            return ("celo-sepolia", "deployments/celo-sepolia.json");
        }

        if (block.chainid == 42220) {
            // Explicit operator ack to reduce accidental mainnet deploys.
            if (!vm.envBool("ALLOW_MAINNET")) {
                revert("ALLOW_MAINNET must be true for Celo mainnet deploy");
            }
            return ("celo-mainnet", "deployments/celo-mainnet.json");
        }

        revert("Unsupported chain for DeploySepolia script");
    }

    function _readConfig() internal view returns (DeploymentConfig memory config) {
        config.owner = vm.envAddress("DEPLOY_OWNER");
        config.treasury = vm.envAddress("TREASURY_ADDRESS");
        config.paymentToken = vm.envAddress("PAYMENT_TOKEN");
        config.continuePrice = vm.envUint("CONTINUE_PRICE");
    }

    function _writeAddressBook(
        TournamentEscrow escrowImpl,
        PowerupShop powerupShopImpl,
        ContinuePurchase continuePurchaseImpl,
        TournamentEscrow escrowProxy,
        PowerupShop powerupShopProxy,
        ContinuePurchase continuePurchaseProxy,
        string memory networkName,
        string memory outputPath
    ) internal {
        string memory objectKey = "deployment";
        vm.serializeUint(objectKey, "chainId", block.chainid);
        vm.serializeString(objectKey, "network", networkName);
        vm.serializeAddress(objectKey, "tournamentEscrowImpl", address(escrowImpl));
        vm.serializeAddress(objectKey, "powerupShopImpl", address(powerupShopImpl));
        vm.serializeAddress(objectKey, "continuePurchaseImpl", address(continuePurchaseImpl));
        vm.serializeAddress(objectKey, "tournamentEscrow", address(escrowProxy));
        vm.serializeAddress(objectKey, "powerupShop", address(powerupShopProxy));
        vm.serializeAddress(objectKey, "continuePurchase", address(continuePurchaseProxy));
        string memory json = vm.serializeString(objectKey, "deployedAt", vm.toString(block.timestamp));

        vm.writeJson(json, outputPath);
    }
}