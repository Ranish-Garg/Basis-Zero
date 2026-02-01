// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ArcYieldVault} from "../src/ArcYieldVault.sol";
import {SessionEscrow} from "../src/SessionEscrow.sol";

/**
 * @title DeployAll
 * @notice Deploy both contracts in sequence (for local testing with fork)
 * 
 * For testnet deployment, use individual scripts:
 *   - DeployArcYieldVault.s.sol (Arc Testnet)
 *   - DeploySessionEscrow.s.sol (Polygon Amoy)
 * 
 * This script is for local anvil testing with forked networks.
 */
contract DeployAll is Script {
    // Token addresses (testnets)
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    address constant POLYGON_AMOY_USDC = 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582;
    
    // Configuration
    uint256 constant RWA_RATE_BPS = 520;
    uint256 constant PROTOCOL_FEE_BPS = 1000;
    uint256 constant REQUIRED_SIGNATURES = 1;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        console.log("=== Basis-Zero Full Deployment ===");
        console.log("Deployer:", deployer);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy ArcYieldVault
        ArcYieldVault vault = new ArcYieldVault(
            ARC_USDC,
            RWA_RATE_BPS,
            REQUIRED_SIGNATURES
        );
        console.log("ArcYieldVault:", address(vault));
        
        vault.setRelayerAuthorization(deployer, true);
        vault.setSettlementSigner(deployer, true);

        // Deploy SessionEscrow
        SessionEscrow escrow = new SessionEscrow(
            POLYGON_AMOY_USDC,
            deployer, // treasury
            PROTOCOL_FEE_BPS,
            REQUIRED_SIGNATURES
        );
        console.log("SessionEscrow:", address(escrow));
        
        escrow.setRelayerAuthorization(deployer, true);
        escrow.setNitroliteSigner(deployer, true);

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("ARC_YIELD_VAULT_ADDRESS=", address(vault));
        console.log("SESSION_ESCROW_ADDRESS=", address(escrow));
    }
}
