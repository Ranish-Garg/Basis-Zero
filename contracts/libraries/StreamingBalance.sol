// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title StreamingBalance
 * @notice Library for calculating streaming yield balances
 * @dev Balance = Initial + (Principal × RWA_Rate × ΔTime) - Bets
 */
library StreamingBalance {
    uint256 constant SECONDS_PER_YEAR = 365 days;
    uint256 constant BPS_DENOMINATOR = 10000;

    function getCurrentBalance(
        uint256 principal,
        uint256 rwaRateBps,
        uint256 sessionStart,
        uint256 totalBets
    ) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - sessionStart;
        uint256 yield = (principal * rwaRateBps * elapsed) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
        
        if (principal + yield < totalBets) {
            return 0;
        }
        return principal + yield - totalBets;
    }

    function getAccruedYield(
        uint256 principal,
        uint256 rwaRateBps,
        uint256 startTime
    ) internal view returns (uint256) {
        uint256 elapsed = block.timestamp - startTime;
        return (principal * rwaRateBps * elapsed) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
    }
}
