// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SessionEscrow} from "../src/SessionEscrow.sol";

contract DeploySessionEscrow is Script {
    function setUp() public {}

    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address usdcAddress = vm.envAddress("POLYGON_USDC_ADDRESS");
        
        address treasury;
        try vm.envAddress("PROTOCOL_TREASURY") returns (address t) {
            if (t == address(0)) {
                treasury = vm.addr(deployerPrivateKey);
            } else {
                treasury = t;
            }
        } catch {
            treasury = vm.addr(deployerPrivateKey);
        }

        vm.startBroadcast(deployerPrivateKey);

        SessionEscrow escrow = new SessionEscrow(
            usdcAddress,
            treasury,
            100, // 1% Protocol Fee (100 bps)
            1    // Required Signatures
        );

        console.log("SessionEscrow deployed at:", address(escrow));

        // Setup initial trusted signer (Backend Server Address)
        // You should set this to your backend's wallet address
        address backendAddress = 0x561009A39f2BC5a975251685Ae8C7F98Fac063C7;
        escrow.setNitroliteSigner(backendAddress, true);
        
        // Set initial Yield Rate (e.g. 5200 BPS = 52% for demo)
        escrow.setYieldRate(5200);

        vm.stopBroadcast();
    }
}
