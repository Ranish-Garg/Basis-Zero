// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SessionEscrow} from "../src/SessionEscrow.sol";

/**
 * @title DeploySessionEscrow
 * @notice Deployment script for SessionEscrow on Polygon Amoy
 * 
 * Usage:
 *   forge script script/DeploySessionEscrow.s.sol:DeploySessionEscrow \
 *     --rpc-url $POLYGON_AMOY_RPC_URL \
 *     --broadcast \
 *     --verify
 */
contract DeploySessionEscrow is Script {
    // Polygon Amoy USDC address (Circle test USDC)
    address constant POLYGON_AMOY_USDC = 0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582;
    
    // Default configuration
    uint256 constant DEFAULT_PROTOCOL_FEE_BPS = 1000; // 10%
    uint256 constant DEFAULT_REQUIRED_SIGNATURES = 1;

    function run() external {
        // Load configuration from environment
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        
        // Protocol treasury (defaults to deployer if not set)
        address treasury = vm.envOr("PROTOCOL_TREASURY", deployer);
        uint256 protocolFeeBps = vm.envOr("PROTOCOL_FEE_BPS", DEFAULT_PROTOCOL_FEE_BPS);
        uint256 requiredSignatures = vm.envOr("REQUIRED_SETTLEMENT_SIGNATURES", DEFAULT_REQUIRED_SIGNATURES);
        
        console.log("=== SessionEscrow Deployment ===");
        console.log("Deployer:", deployer);
        console.log("USDC Address:", POLYGON_AMOY_USDC);
        console.log("Treasury:", treasury);
        console.log("Protocol Fee (BPS):", protocolFeeBps);
        console.log("Required Signatures:", requiredSignatures);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy SessionEscrow
        SessionEscrow escrow = new SessionEscrow(
            POLYGON_AMOY_USDC,
            treasury,
            protocolFeeBps,
            requiredSignatures
        );

        console.log("SessionEscrow deployed at:", address(escrow));

        // Configure deployer as initial relayer (for testing)
        escrow.setRelayerAuthorization(deployer, true);
        console.log("Deployer authorized as relayer");

        // Configure deployer as Nitrolite signer (for testing)
        escrow.setNitroliteSigner(deployer, true);
        console.log("Deployer authorized as Nitrolite signer");

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Add to .env:");
        console.log("SESSION_ESCROW_ADDRESS=", address(escrow));
    }
}
