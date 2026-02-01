// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IGateway
 * @notice Interface for Circle Gateway integration
 * @dev Used for cross-chain USDC deposits via Gateway API
 */
interface IGateway {
    function getUnifiedBalance(address user) external view returns (uint256);
    function executeTransfer(
        address recipient,
        uint256 amount,
        uint32 destinationChain,
        bytes calldata attestation
    ) external;
}
