/**
 * AMM Pool Module - Basis Zero Prediction Market
 * 
 * This module implements the AMM pool logic as specified in:
 * "Basis Zero - AMM Pool Technical Logic.md"
 * 
 * Key Components:
 * - types.ts: Type definitions and constants
 * - pool.ts: Constant product (x*y=k) logic and price calculations
 * - mint-swap.ts: "Mint & Swap" betting mechanism
 * - settlement.ts: Market resolution and payout logic
 * - pool-manager.ts: State management for multiple markets
 */

// Types
export {
    PoolState,
    PoolConfig,
    PoolPrices,
    SwapResult,
    BetResult,
    SettlementResult,
    Outcome,
    USDC_DECIMALS,
    ONE_USDC,
    MAX_PRICE,
    MIN_PRICE,
    PRICE_CAP,
    DEFAULT_VIRTUAL_LIQUIDITY,
    PROTOCOL_FEE_BPS
} from './types';

// Pool logic
export {
    createPool,
    getPrices,
    getSpotPrice,
    calculateSwap,
    validatePriceCap,
    isSwapAllowed,
    getPoolSummary
} from './pool';

// Betting
export {
    placeBet,
    quoteBet,
    placeSafeModeBet,
    sellPosition,
    getPositionValue,
    calculatePayout,
    runSpecExample
} from './mint-swap';

// Settlement
export {
    UserPosition,
    MarketResolution,
    MarketSettlement,
    UserSettlement,
    calculateUserSettlement,
    calculateMarketSettlement,
    generateSettlementProof,
    finalizePool,
    validatePoolSolvency,
    formatSettlementSummary
} from './settlement';

// Pool Manager
export { PoolManager, poolManager } from './pool-manager';
