// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IYieldVault
 * @notice Interface for the VelocityYieldVault
 */
interface IYieldVault {
    function deposit(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function getAccruedYield(address user) external view returns (uint256);
    function lockForSession(address user, uint256 amount) external;
    function settleSession(address user, int256 pnl) external;
}
