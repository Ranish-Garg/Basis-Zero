// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockRWAToken
 * @notice Mock yield-bearing RWA token (simulates BUIDL/OUSG)
 * @dev Accrues yield per block for testing
 */
contract MockRWAToken is ERC20 {
    uint256 public ratePerSecondBps = 158; // ~5% APY in basis points per second

    mapping(address => uint256) public depositTimestamp;

    constructor() ERC20("Mock RWA Token", "mRWA") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function deposit(address user, uint256 usdcAmount) external {
        depositTimestamp[user] = block.timestamp;
        _mint(user, usdcAmount);
    }

    function getAccruedYield(address user) external view returns (uint256) {
        uint256 elapsed = block.timestamp - depositTimestamp[user];
        uint256 balance = balanceOf(user);
        return (balance * ratePerSecondBps * elapsed) / (365 days * 10000);
    }

    function redeem(address user, uint256 amount) external returns (uint256) {
        uint256 yield = this.getAccruedYield(user);
        _burn(user, amount);
        return amount + yield;
    }
}
