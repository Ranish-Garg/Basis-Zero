// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title INitrolite
 * @notice Interface for Yellow Network Nitrolite protocol
 * @dev ERC-7824 state channel implementation
 */
interface INitrolite {
    struct SessionState {
        bytes32 sessionId;
        address[] participants;
        uint256[] balances;
        uint64 nonce;
        bool isFinal;
    }

    function openSession(
        address[] calldata participants,
        uint256[] calldata initialBalances
    ) external returns (bytes32 sessionId);

    function closeSession(
        bytes32 sessionId,
        SessionState calldata finalState,
        bytes[] calldata signatures
    ) external;

    function disputeSession(
        bytes32 sessionId,
        SessionState calldata state,
        bytes[] calldata signatures
    ) external;
}
