// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {SessionEscrow} from "../src/SessionEscrow.sol";

contract AuthorizeSigner is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address escrowAddress = vm.envAddress("SESSION_ESCROW_ADDRESS");
        
        // Backend signer address (from logs)
        address backendSigner = 0x561009A39f2BC5a975251685Ae8C7F98Fac063C7;
        
        console.log("Authorizing signer:", backendSigner);
        console.log("On contract:", escrowAddress);

        vm.startBroadcast(deployerPrivateKey);

        SessionEscrow(escrowAddress).setNitroliteSigner(backendSigner, true);

        vm.stopBroadcast();
        
        console.log("Signer authorized successfully!");
    }
}
