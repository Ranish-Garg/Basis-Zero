/**
 * Mint & Swap Mechanism
 * 
 * The core betting mechanism for Basis Zero prediction markets.
 * 
 * When a user bets USDC on an outcome, the system executes a two-step process:
 * 1. Virtual Mint: USDC is converted into equal YES and NO shares
 * 2. Virtual Swap: The unwanted shares are "sold" into the AMM pool
 * 
 * Example from spec:
 * - User bets $100 USDC on YES
 * - Step 1: $100 USDC → 100 YES shares + 100 NO shares
 * - Step 2: 100 NO shares sold into pool → receive ~90.91 more YES shares
 * - Result: User holds 190.91 YES shares (effective price ~$0.523)
 * 
 * Based on: "Basis Zero - AMM Pool Technical Logic.md"
 */

import {
    PoolState,
    BetResult,
    Outcome,
    ONE_USDC,
    PRICE_CAP
} from './types';
import {
    calculateSwap,
    getPrices,
    validatePriceCap
} from './pool';

// ═══════════════════════════════════════════════════════════════════════════
// MINT & SWAP (Core Betting Logic)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Execute a "Mint & Swap" bet
 * 
 * This is the primary function for placing bets in the prediction market.
 * 
 * @param pool Current pool state
 * @param usdcAmount Amount of USDC to bet (in base units, 6 decimals)
 * @param betOn Which outcome to bet on (YES or NO)
 * @returns Bet result with shares received and updated pool state
 */
export function placeBet(
    pool: PoolState,
    usdcAmount: bigint,
    betOn: Outcome
): BetResult {
    if (usdcAmount <= 0n) {
        throw new Error('Bet amount must be positive');
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 1: Virtual Mint
    // ═══════════════════════════════════════════════════════════════════════
    // 
    // Following the collateralization formula: USDC = YES + NO
    // 1 USDC always creates exactly 1 pair of shares (1 YES + 1 NO)
    // This ensures the protocol stays solvent

    const mintedShares = usdcAmount; // 1:1 ratio

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 2: Virtual Swap
    // ═══════════════════════════════════════════════════════════════════════
    // 
    // The unwanted shares are "sold" into the AMM to acquire more of the
    // desired outcome shares.

    const sellOutcome = betOn === Outcome.YES ? Outcome.NO : Outcome.YES;

    // Calculate how many shares we'll get from selling the unwanted side
    const swapResult = calculateSwap(pool, mintedShares, sellOutcome);

    // Validate that the swap doesn't breach the price cap
    if (!validatePriceCap(swapResult.newPoolState)) {
        throw new Error(`Bet would push ${betOn} price above ${PRICE_CAP * 100}% cap`);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // STEP 3: Calculate Final Position
    // ═══════════════════════════════════════════════════════════════════════

    // Total shares of the bet outcome:
    // - mintedShares: from the virtual mint step
    // - swappedShares: from swapping the opposite side
    const swappedShares = swapResult.amountOut;
    const totalShares = mintedShares + swappedShares;

    // Calculate effective price (how much USDC per share of chosen outcome)
    const effectivePrice = Number(usdcAmount) / Number(totalShares);

    // Get the new implied probability after the bet
    const newPrices = getPrices(swapResult.newPoolState);
    const newProbability = betOn === Outcome.YES
        ? newPrices.yesProbability
        : newPrices.noProbability;

    // Update total collateral in the pool
    const updatedPoolState: PoolState = {
        ...swapResult.newPoolState,
        totalCollateral: pool.totalCollateral + usdcAmount
    };

    return {
        usdcIn: usdcAmount,
        outcome: betOn,
        mintedShares,
        swappedShares,
        totalShares,
        effectivePrice,
        newProbability,
        newPoolState: updatedPoolState
    };
}

/**
 * Calculate the expected shares for a bet without executing it
 * 
 * Useful for showing users their expected return before confirming
 * 
 * @param pool Current pool state
 * @param usdcAmount Amount of USDC to bet
 * @param betOn Which outcome to bet on
 * @returns Expected shares and effective price (or null if bet not allowed)
 */
export function quoteBet(
    pool: PoolState,
    usdcAmount: bigint,
    betOn: Outcome
): { expectedShares: bigint; effectivePrice: number; priceImpact: number } | null {
    try {
        const result = placeBet(pool, usdcAmount, betOn);

        // Don't actually update the pool, just return the quote
        return {
            expectedShares: result.totalShares,
            effectivePrice: result.effectivePrice,
            priceImpact: Math.abs(
                result.newProbability -
                (betOn === Outcome.YES
                    ? getPrices(pool).yesProbability
                    : getPrices(pool).noProbability)
            )
        };
    } catch {
        return null;
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// YIELD-BASED BETTING (Safe Mode Integration)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Place a bet using only accrued yield (Safe Mode)
 * 
 * This is the "zero opportunity cost" feature of Basis Zero.
 * Users bet only with their RWA yield, protecting their principal.
 * 
 * @param pool Current pool state
 * @param principalBalance User's principal balance in the vault
 * @param accruedYield User's accrued yield (from RWA)
 * @param yieldPercentToBet Percentage of yield to bet (0-100)
 * @param betOn Which outcome to bet on
 * @returns Bet result or null if insufficient yield
 */
export function placeSafeModeBet(
    pool: PoolState,
    principalBalance: bigint,
    accruedYield: bigint,
    yieldPercentToBet: number,
    betOn: Outcome
): BetResult | null {
    if (principalBalance <= 0n) {
        throw new Error('User must have a deposit to use Safe Mode');
    }

    if (accruedYield <= 0n) {
        return null; // No yield to bet
    }

    if (yieldPercentToBet <= 0 || yieldPercentToBet > 100) {
        throw new Error('Yield percentage must be between 0 and 100');
    }

    // Calculate the USDC amount to bet from yield
    const yieldToBet = (accruedYield * BigInt(Math.floor(yieldPercentToBet * 100))) / 10000n;

    if (yieldToBet <= 0n) {
        return null;
    }

    return placeBet(pool, yieldToBet, betOn);
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate user's position value at current prices
 * 
 * @param yesShares User's YES share balance
 * @param noShares User's NO share balance
 * @param pool Current pool state
 * @returns Current value in USDC-equivalent
 */
export function getPositionValue(
    yesShares: bigint,
    noShares: bigint,
    pool: PoolState
): { yesValue: number; noValue: number; totalValue: number } {
    const prices = getPrices(pool);

    const yesValue = Number(yesShares) / 1e6 * prices.yesPrice;
    const noValue = Number(noShares) / 1e6 * prices.noPrice;

    return {
        yesValue,
        noValue,
        totalValue: yesValue + noValue
    };
}

/**
 * Calculate potential payout if user wins
 * 
 * Winning shares are worth $1.00 each, losing shares are worth $0.00
 * 
 * @param shares Number of shares held
 * @returns Payout in USDC (base units)
 */
export function calculatePayout(shares: bigint): bigint {
    // Each winning share = 1 USDC
    return shares;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAMPLE CALCULATION (From the spec)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run the example from the spec to demonstrate the math
 * 
 * Scenario: User bets $100 USDC on YES
 * Initial Pool: 1000 YES, 1000 NO (50/50)
 */
export function runSpecExample(): void {
    const pool = {
        marketId: 'example',
        yesReserves: 1000n * ONE_USDC,
        noReserves: 1000n * ONE_USDC,
        k: 1000n * ONE_USDC * 1000n * ONE_USDC,
        virtualLiquidity: 0n, // No virtual liquidity for this example
        totalCollateral: 2000n * ONE_USDC,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    console.log('═══════════════════════════════════════════════════════════════');
    console.log('SPEC EXAMPLE: Betting $100 USDC on YES');
    console.log('═══════════════════════════════════════════════════════════════');

    const pricesBefore = getPrices(pool);
    console.log(`\nInitial State:`);
    console.log(`  YES Reserves: ${Number(pool.yesReserves) / 1e6}`);
    console.log(`  NO Reserves:  ${Number(pool.noReserves) / 1e6}`);
    console.log(`  YES Price:    $${pricesBefore.yesPrice.toFixed(2)} (${pricesBefore.yesProbability.toFixed(0)}%)`);

    const betAmount = 100n * ONE_USDC;
    const result = placeBet(pool, betAmount, Outcome.YES);

    console.log(`\nStep 1 - Virtual Mint:`);
    console.log(`  $100 USDC → 100 YES + 100 NO shares`);

    console.log(`\nStep 2 - Virtual Swap (sell 100 NO):`);
    console.log(`  Swapped: ${Number(result.swappedShares) / 1e6} additional YES shares`);

    console.log(`\nResult:`);
    console.log(`  Total YES shares: ${Number(result.totalShares) / 1e6}`);
    console.log(`  Effective Price:  $${result.effectivePrice.toFixed(3)}`);
    console.log(`  New YES Price:    ${result.newProbability.toFixed(1)}%`);

    console.log(`\nNew Pool State:`);
    console.log(`  YES Reserves: ${Number(result.newPoolState.yesReserves) / 1e6}`);
    console.log(`  NO Reserves:  ${Number(result.newPoolState.noReserves) / 1e6}`);
    console.log('═══════════════════════════════════════════════════════════════');
}

// ═══════════════════════════════════════════════════════════════════════════
// SELLING / EXIT LOGIC
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sell a position (shares) back to USDC
 * 
 * Logic: "Swap & Burn"
 * To get USDC, we need equal amounts of YES and NO shares to merge.
 * If user holds S shares of YES:
 * 1. Swap x amount of YES for NO.
 * 2. Receive y amount of NO.
 * 3. We find x such that: (S - x) == y
 * 4. Then merge (S-x) YES + (S-x) NO -> (S-x) USDC.
 * 
 * Derivation:
 * y = R_no - (k / (R_yes + x))
 * We want: S - x = R_no - (k / (R_yes + x))
 * This leads to quadratic equation: x^2 + (R_no + R_yes - S)x - S*R_yes = 0
 * 
 * @param pool Current pool state
 * @param sharesAmount Amount of shares to sell
 * @param outcome Which outcome shares to sell
 * @returns Resulting USDC and new pool state
 */
export function sellPosition(
    pool: PoolState,
    sharesAmount: bigint,
    outcome: Outcome
): { usdcOut: bigint; newPoolState: PoolState; priceImpact: number } {
    if (sharesAmount <= 0n) throw new Error('Shares amount must be positive');

    const reservesHeld = outcome === Outcome.YES ? pool.yesReserves : pool.noReserves;
    const reservesOther = outcome === Outcome.YES ? pool.noReserves : pool.yesReserves;
    const k = pool.k;

    // Quadratic Coefficients: ax^2 + bx + c = 0
    // a = 1
    // b = R_other + R_held - S
    // c = -S * R_held
    
    // We use BigInt but need to be careful with sqrt.
    // Converting to Number for calculation (precision loss acceptable for large numbers)
    
    const R_held = Number(reservesHeld);
    const R_other = Number(reservesOther);
    const S = Number(sharesAmount);
    
    const a = 1;
    const b = R_other + R_held - S;
    const c = -S * R_held;
    
    const discriminant = b * b - 4 * a * c;
    if (discriminant < 0) throw new Error('Solution not found');
    
    const x = (-b + Math.sqrt(discriminant)) / (2 * a);
    const swapAmount = BigInt(Math.floor(x));

    if (swapAmount <= 0n || swapAmount >= sharesAmount) {
        throw new Error('Invalid swap amount calculated');
    }

    // Execute the Swap
    // We are selling 'outcome' shares (swapAmount) to get 'other' shares
    const swapResult = calculateSwap(pool, swapAmount, outcome);
    
    // Check if we achieved parity (approximately)
    const remainingShares = sharesAmount - swapAmount;
    const receivedOther = swapResult.amountOut;
    
    // The amount we can burn is the minimum of the pair
    const burnAmount = remainingShares < receivedOther ? remainingShares : receivedOther;
    
    // Update Pool State
    // The pool already updated its reserves in calculateSwap (it received x YES, gave y NO)
    // Now we update totalCollateral because user is BURNING shares -> removing USDC
    const newPoolState: PoolState = {
        ...swapResult.newPoolState,
        totalCollateral: pool.totalCollateral - burnAmount
    };
    
    // Calculate Price Impact
    const spotPriceBefore = getPrices(pool).yesProbability;
    const spotPriceAfter = getPrices(newPoolState).yesProbability;

    return {
        usdcOut: burnAmount,
        newPoolState,
        priceImpact: Math.abs(spotPriceAfter - spotPriceBefore)
    };
}
