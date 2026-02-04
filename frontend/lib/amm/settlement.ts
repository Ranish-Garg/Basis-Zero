/**
 * Settlement Logic for Prediction Market Resolution
 * 
 * When a prediction market event ends:
 * - Outcome YES: 1 YES share = $1.00 USDC, 1 NO share = $0.00
 * - Outcome NO: 1 YES share = $0.00, 1 NO share = $1.00 USDC
 * 
 * This module handles the settlement calculations and coordinates
 * with the on-chain settlement contract.
 * 
 * Based on: "Basis Zero - AMM Pool Technical Logic.md"
 */

import {
    PoolState,
    SettlementResult,
    Outcome,
    ONE_USDC,
    PROTOCOL_FEE_BPS,
    BPS_DENOMINATOR
} from './types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * User's position in a market
 */
export interface UserPosition {
    userId: string;
    marketId: string;
    yesShares: bigint;
    noShares: bigint;
    totalCostBasis: bigint; // Total USDC spent on this position
}

/**
 * Market resolution data
 */
export interface MarketResolution {
    marketId: string;
    winningOutcome: Outcome;
    resolvedAt: number;
    oracleSource: string;
    oracleData?: string;
}

/**
 * Complete settlement for all users in a market
 */
export interface MarketSettlement {
    marketId: string;
    resolution: MarketResolution;
    userPayouts: UserSettlement[];
    totalPayout: bigint;
    protocolFeeCollected: bigint;
}

/**
 * Individual user settlement
 */
export interface UserSettlement {
    userId: string;
    winningShares: bigint;
    losingShares: bigint;
    grossPayout: bigint;
    protocolFee: bigint;
    netPayout: bigint;
    profitLoss: bigint; // Net PnL from cost basis
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTLEMENT CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculate settlement for a single user position
 * 
 * @param position User's position in the market
 * @param winningOutcome The resolved winning outcome
 * @param applyFee Whether to deduct protocol fee
 * @returns Settlement result with payout details
 */
export function calculateUserSettlement(
    position: UserPosition,
    winningOutcome: Outcome,
    applyFee: boolean = true
): UserSettlement {
    const { yesShares, noShares, totalCostBasis, userId } = position;

    // Determine winning and losing shares
    let winningShares: bigint;
    let losingShares: bigint;

    if (winningOutcome === Outcome.YES) {
        winningShares = yesShares;
        losingShares = noShares;
    } else {
        winningShares = noShares;
        losingShares = yesShares;
    }

    // Each winning share is worth 1 USDC
    const grossPayout = winningShares;

    // Calculate protocol fee (only on profits, not gross payout)
    let protocolFee = 0n;
    if (applyFee && grossPayout > totalCostBasis) {
        const profit = grossPayout - totalCostBasis;
        protocolFee = (profit * BigInt(PROTOCOL_FEE_BPS)) / BigInt(BPS_DENOMINATOR);
    }

    const netPayout = grossPayout - protocolFee;
    const profitLoss = netPayout - totalCostBasis;

    return {
        userId,
        winningShares,
        losingShares,
        grossPayout,
        protocolFee,
        netPayout,
        profitLoss
    };
}

/**
 * Calculate settlement for all users in a market
 * 
 * @param positions Array of all user positions
 * @param resolution Market resolution data
 * @returns Complete market settlement
 */
export function calculateMarketSettlement(
    positions: UserPosition[],
    resolution: MarketResolution
): MarketSettlement {
    const userPayouts: UserSettlement[] = [];
    let totalPayout = 0n;
    let protocolFeeCollected = 0n;

    for (const position of positions) {
        if (position.marketId !== resolution.marketId) {
            continue; // Skip positions from other markets
        }

        const settlement = calculateUserSettlement(position, resolution.winningOutcome);
        userPayouts.push(settlement);

        totalPayout += settlement.netPayout;
        protocolFeeCollected += settlement.protocolFee;
    }

    return {
        marketId: resolution.marketId,
        resolution,
        userPayouts,
        totalPayout,
        protocolFeeCollected
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// SETTLEMENT PROOF GENERATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Generate a settlement proof for on-chain submission
 * 
 * This proof is used by the SessionEscrow contract to verify
 * and execute the settlement.
 * 
 * @param settlement User settlement data
 * @param marketId Market identifier
 * @param sessionId Yellow Network session ID
 * @returns Encoded settlement proof
 */
export function generateSettlementProof(
    settlement: UserSettlement,
    marketId: string,
    sessionId: string
): {
    encodedProof: string;
    proofHash: string;
    pnl: bigint;
} {
    // The proof contains all necessary data for on-chain verification
    const proofData = {
        sessionId,
        marketId,
        userId: settlement.userId,
        winningShares: settlement.winningShares.toString(),
        losingShares: settlement.losingShares.toString(),
        grossPayout: settlement.grossPayout.toString(),
        protocolFee: settlement.protocolFee.toString(),
        netPayout: settlement.netPayout.toString(),
        pnl: settlement.profitLoss.toString(),
        timestamp: Date.now()
    };

    const encodedProof = btoa(JSON.stringify(proofData));

    // In production, this would be a proper hash (keccak256, etc.)
    const proofHash = `0x${Array.from(encodedProof.slice(0, 32)).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('')}`;

    return {
        encodedProof,
        proofHash,
        pnl: settlement.profitLoss
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// POOL FINALIZATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Finalize a pool after market resolution
 * 
 * This "closes" the pool and prevents further trading.
 * 
 * @param pool Pool to finalize
 * @param resolution Market resolution
 * @returns Finalized pool state
 */
export function finalizePool(
    pool: PoolState,
    resolution: MarketResolution
): PoolState & { finalized: true; resolution: MarketResolution } {
    if (pool.marketId !== resolution.marketId) {
        throw new Error('Market ID mismatch');
    }

    return {
        ...pool,
        finalized: true,
        resolution,
        updatedAt: Date.now()
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validate that total payouts don't exceed pool collateral
 * 
 * This is a sanity check to ensure the pool remains solvent.
 * 
 * @param pool Pool state
 * @param positions All user positions
 * @param winningOutcome The winning outcome
 * @returns true if pool has sufficient collateral
 */
export function validatePoolSolvency(
    pool: PoolState,
    positions: UserPosition[],
    winningOutcome: Outcome
): boolean {
    let totalWinningShares = 0n;

    for (const position of positions) {
        if (position.marketId !== pool.marketId) continue;

        totalWinningShares += winningOutcome === Outcome.YES
            ? position.yesShares
            : position.noShares;
    }

    // Total payout can't exceed collateral
    // Due to the USDC = YES + NO formula, this should always hold
    return totalWinningShares <= pool.totalCollateral;
}

/**
 * Verify that a resolution comes from a valid oracle source
 * 
 * @param resolution Resolution to verify
 * @param allowedOracles List of allowed oracle addresses/identifiers
 * @returns true if oracle is allowed
 */
export function verifyOracleSource(
    resolution: MarketResolution,
    allowedOracles: string[]
): boolean {
    return allowedOracles.includes(resolution.oracleSource);
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format settlement summary for logging/display
 */
export function formatSettlementSummary(settlement: MarketSettlement): string {
    const lines = [
        '═══════════════════════════════════════════════════════════════',
        `MARKET SETTLEMENT: ${settlement.marketId}`,
        '═══════════════════════════════════════════════════════════════',
        `Winning Outcome: ${settlement.resolution.winningOutcome}`,
        `Resolved At: ${new Date(settlement.resolution.resolvedAt).toISOString()}`,
        `Oracle: ${settlement.resolution.oracleSource}`,
        '',
        'USER PAYOUTS:',
        '───────────────────────────────────────────────────────────────'
    ];

    for (const payout of settlement.userPayouts) {
        const pnlSign = payout.profitLoss >= 0n ? '+' : '';
        lines.push(
            `  ${payout.userId}:`,
            `    Winning Shares: ${Number(payout.winningShares) / 1e6}`,
            `    Net Payout: $${(Number(payout.netPayout) / 1e6).toFixed(2)}`,
            `    P&L: ${pnlSign}$${(Number(payout.profitLoss) / 1e6).toFixed(2)}`
        );
    }

    lines.push(
        '───────────────────────────────────────────────────────────────',
        `Total Payout: $${(Number(settlement.totalPayout) / 1e6).toFixed(2)}`,
        `Protocol Fee: $${(Number(settlement.protocolFeeCollected) / 1e6).toFixed(2)}`,
        '═══════════════════════════════════════════════════════════════'
    );

    return lines.join('\n');
}
