/**
 * AMM Pool - Core Constant Product Logic
 * 
 * Implements the dual-formula architecture:
 * 1. Collateralization: USDC = YES + NO
 * 2. Trading: x * y = k (constant product)
 * 
 * Based on: "Basis Zero - AMM Pool Technical Logic.md"
 */

import {
    PoolState,
    PoolConfig,
    PoolPrices,
    SwapResult,
    Outcome,
    ONE_USDC,
    DEFAULT_VIRTUAL_LIQUIDITY,
    PRICE_CAP,
    MIN_PRICE
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// POOL CREATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Creates a new prediction market pool with initial liquidity
 * 
 * Initial state: 50/50 probability (equal reserves)
 * 
 * @param config Pool configuration
 * @returns Initial pool state
 */
export function createPool(config: PoolConfig): PoolState {
    const { marketId, initialLiquidity, virtualLiquidity } = config;

    if (initialLiquidity <= 0n) {
        throw new Error('Initial liquidity must be positive');
    }

    const vLiquidity = virtualLiquidity ?? DEFAULT_VIRTUAL_LIQUIDITY;

    // Start with equal reserves (50/50 probability)
    const yesReserves = initialLiquidity;
    const noReserves = initialLiquidity;
    const k = yesReserves * noReserves;

    return {
        marketId,
        yesReserves,
        noReserves,
        k,
        virtualLiquidity: vLiquidity,
        totalCollateral: initialLiquidity * 2n, // Both sides backed by USDC
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRICE CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate implied prices from pool reserves
 * 
 * Formula: Price_YES = y / (x + y) where x=YES, y=NO reserves
 * 
 * Uses virtual liquidity to "deepen" the market and reduce slippage
 * 
 * @param pool Current pool state
 * @returns Current prices and probabilities
 */
export function getPrices(pool: PoolState): PoolPrices {
    // Apply virtual liquidity offset to reduce price impact
    const effectiveYes = pool.yesReserves + pool.virtualLiquidity;
    const effectiveNo = pool.noReserves + pool.virtualLiquidity;
    const total = effectiveYes + effectiveNo;

    // Price of YES = NO_reserves / (YES_reserves + NO_reserves)
    // Higher NO reserves = higher YES price (more demand for YES)
    const yesPrice = Number(effectiveNo) / Number(total);
    const noPrice = Number(effectiveYes) / Number(total);

    return {
        yesPrice: Math.min(Math.max(yesPrice, MIN_PRICE), PRICE_CAP),
        noPrice: Math.min(Math.max(noPrice, MIN_PRICE), PRICE_CAP),
        yesProbability: yesPrice * 100,
        noProbability: noPrice * 100
    };
}

/**
 * Get the spot price for a given outcome (before any swap)
 * 
 * @param pool Current pool state
 * @param outcome Which outcome to price
 * @returns Spot price (0 to 1)
 */
export function getSpotPrice(pool: PoolState, outcome: Outcome): number {
    const prices = getPrices(pool);
    return outcome === Outcome.YES ? prices.yesPrice : prices.noPrice;
}

// ═══════════════════════════════════════════════════════════════════════════
// SWAP LOGIC (Constant Product x * y = k)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate output amount for a swap using constant product formula
 * 
 * When selling token A for token B:
 * - New A reserves = A + amountIn
 * - New B reserves = k / (A + amountIn)
 * - Amount out = B - new B reserves
 * 
 * @param pool Current pool state
 * @param amountIn Amount of tokens to swap in
 * @param sellOutcome Which outcome tokens to sell (receive the opposite)
 * @returns Swap result with output amount and new pool state
 */
export function calculateSwap(
    pool: PoolState,
    amountIn: bigint,
    sellOutcome: Outcome
): SwapResult {
    if (amountIn <= 0n) {
        throw new Error('Amount must be positive');
    }

    const spotPriceBefore = getSpotPrice(pool, sellOutcome === Outcome.YES ? Outcome.NO : Outcome.YES);

    let newYesReserves: bigint;
    let newNoReserves: bigint;
    let amountOut: bigint;

    if (sellOutcome === Outcome.NO) {
        // Selling NO tokens, receiving YES tokens
        // NO reserves increase, YES reserves decrease
        newNoReserves = pool.noReserves + amountIn;
        newYesReserves = pool.k / newNoReserves;
        amountOut = pool.yesReserves - newYesReserves;
    } else {
        // Selling YES tokens, receiving NO tokens
        // YES reserves increase, NO reserves decrease
        newYesReserves = pool.yesReserves + amountIn;
        newNoReserves = pool.k / newYesReserves;
        amountOut = pool.noReserves - newNoReserves;
    }

    // Ensure we don't drain the pool completely
    if (amountOut <= 0n) {
        throw new Error('Insufficient liquidity for this swap');
    }

    const newPoolState: PoolState = {
        ...pool,
        yesReserves: newYesReserves,
        noReserves: newNoReserves,
        // k stays constant (that's the invariant!)
        updatedAt: Date.now()
    };

    // Calculate effective price and price impact
    const effectivePrice = Number(amountIn) / Number(amountOut);
    const spotPriceAfter = getSpotPrice(newPoolState, sellOutcome === Outcome.YES ? Outcome.NO : Outcome.YES);
    const priceImpact = Math.abs(spotPriceAfter - spotPriceBefore) / spotPriceBefore * 100;

    return {
        amountOut,
        effectivePrice,
        priceImpact,
        newPoolState
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// PRICE VALIDATION (Edge Case Handling)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that a pool state doesn't violate the $1.00 price cap
 * 
 * From the spec: "The Node must reject any state signature where Price_YES > 0.99"
 * 
 * @param pool Pool state to validate
 * @returns true if valid, false if price cap violated
 */
export function validatePriceCap(pool: PoolState): boolean {
    const prices = getPrices(pool);
    return prices.yesPrice <= PRICE_CAP && prices.noPrice <= PRICE_CAP;
}

/**
 * Check if a proposed swap would violate the price cap
 * 
 * @param pool Current pool state
 * @param amountIn Amount to swap
 * @param sellOutcome Outcome to sell
 * @returns true if swap is allowed, false if it would breach price cap
 */
export function isSwapAllowed(
    pool: PoolState,
    amountIn: bigint,
    sellOutcome: Outcome
): boolean {
    try {
        const result = calculateSwap(pool, amountIn, sellOutcome);
        return validatePriceCap(result.newPoolState);
    } catch {
        return false;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate how much of a token you need to sell to move the price to a target
 * 
 * Useful for arbitrage calculations
 * 
 * @param pool Current pool state
 * @param targetPrice Target price for the outcome (0 to 1)
 * @param outcome Which outcome to target
 * @returns Amount of opposite tokens to sell
 */
export function calculateAmountForTargetPrice(
    pool: PoolState,
    targetPrice: number,
    outcome: Outcome
): bigint {
    if (targetPrice <= MIN_PRICE || targetPrice >= PRICE_CAP) {
        throw new Error(`Target price must be between ${MIN_PRICE} and ${PRICE_CAP}`);
    }

    // From: price_YES = y / (x + y)
    // Solve for reserves ratio given target price
    // This is a simplified calculation - real implementation would account for virtual liquidity

    const currentPrices = getPrices(pool);
    const currentPrice = outcome === Outcome.YES ? currentPrices.yesPrice : currentPrices.noPrice;

    if (Math.abs(currentPrice - targetPrice) < 0.001) {
        return 0n; // Already at target
    }

    // Calculate the reserve ratio needed
    // For YES: targetPrice = effectiveNo / (effectiveYes + effectiveNo)
    // Rearranging: effectiveYes = effectiveNo * (1 - targetPrice) / targetPrice

    const totalReserves = pool.yesReserves + pool.noReserves;

    if (outcome === Outcome.YES) {
        // To increase YES price, we need more NO reserves (sell NO, buy YES)
        const targetNoRatio = targetPrice;
        const targetNoReserves = BigInt(Math.floor(Number(totalReserves) * targetNoRatio));
        const deltaNo = targetNoReserves - pool.noReserves;
        return deltaNo > 0n ? deltaNo : 0n;
    } else {
        // To increase NO price, we need more YES reserves (sell YES, buy NO)
        const targetYesRatio = targetPrice;
        const targetYesReserves = BigInt(Math.floor(Number(totalReserves) * targetYesRatio));
        const deltaYes = targetYesReserves - pool.yesReserves;
        return deltaYes > 0n ? deltaYes : 0n;
    }
}

/**
 * Get a human-readable summary of the pool state
 */
export function getPoolSummary(pool: PoolState): string {
    const prices = getPrices(pool);
    return `
Pool: ${pool.marketId}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Reserves:
  YES: ${Number(pool.yesReserves) / 1e6} shares
  NO:  ${Number(pool.noReserves) / 1e6} shares
  k:   ${pool.k}

Prices:
  YES: $${prices.yesPrice.toFixed(4)} (${prices.yesProbability.toFixed(1)}%)
  NO:  $${prices.noPrice.toFixed(4)} (${prices.noProbability.toFixed(1)}%)

Total Collateral: $${Number(pool.totalCollateral) / 1e6} USDC
Virtual Liquidity: $${Number(pool.virtualLiquidity) / 1e6} USDC
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`.trim();
}
