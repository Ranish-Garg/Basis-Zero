// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {ArcYieldVault} from "../src/ArcYieldVault.sol";

/**
 * @title DeployArcYieldVault
 * @notice Deployment script for ArcYieldVault on Arc Testnet
 * 
 * Usage:
 *   forge script script/DeployArcYieldVault.s.sol:DeployArcYieldVault \
 *     --rpc-url $ARC_TESTNET_RPC_URL \
 *     --broadcast \
 *     --verify
 * 
 * Note: Arc uses USDC as native gas token, so you need USDC for gas!
 */
contract DeployArcYieldVault is Script {
    // Arc Testnet USDC address (native token)
    address constant ARC_USDC = 0x3600000000000000000000000000000000000000;
    
    // Default configuration
    uint256 constant DEFAULT_RWA_RATE_BPS = 520; // 5.2% APY (T-Bill rate)
    uint256 constant DEFAULT_REQUIRED_SIGNATURES = 1;

    function run() external {
        // Load configuration from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        uint256 rwaRateBps = vm.envOr("INITIAL_RWA_RATE_BPS", DEFAULT_RWA_RATE_BPS);
        uint256 requiredSignatures = vm.envOr("REQUIRED_SETTLEMENT_SIGNATURES", DEFAULT_REQUIRED_SIGNATURES);
        
        console.log("=== ArcYieldVault Deployment ===");
        console.log("Deployer:", deployer);
        console.log("USDC Address:", ARC_USDC);
        console.log("RWA Rate (BPS):", rwaRateBps);
        console.log("Required Signatures:", requiredSignatures);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy ArcYieldVault
        ArcYieldVault vault = new ArcYieldVault(
            ARC_USDC,
            rwaRateBps,
            requiredSignatures
        );

        console.log("ArcYieldVault deployed at:", address(vault));

        // Configure deployer as initial relayer (for testing)
        vault.setRelayerAuthorization(deployer, true);
        console.log("Deployer authorized as relayer");

        // Configure deployer as settlement signer (for testing)
        vault.setSettlementSigner(deployer, true);
        console.log("Deployer authorized as settlement signer");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Add to .env:");
        console.log("ARC_YIELD_VAULT_ADDRESS=", address(vault));
    }
}
