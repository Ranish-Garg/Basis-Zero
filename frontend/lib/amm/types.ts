/**
 * AMM Pool Types for Basis Zero Prediction Market
 * 
 * Based on: "Basis Zero - AMM Pool Technical Logic.md"
 * 
 * Architecture:
 * - Collateralization: USDC = YES + NO (ensures 1 USDC = 1 pair of shares)
 * - Trading: x * y = k (constant product for price discovery)
 */

// ═══════════════════════════════════════════════════════════════════════════
// CORE TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Represents a prediction market pool state
 */
export interface PoolState {
    /** Market identifier */
    marketId: string;

    /** YES token reserves in the pool */
    yesReserves: bigint;

    /** NO token reserves in the pool */
    noReserves: bigint;

    /** Constant product invariant (k = x * y) */
    k: bigint;

    /** Virtual liquidity offset for slippage protection */
    virtualLiquidity: bigint;

    /** Total USDC collateral backing this pool */
    totalCollateral: bigint;

    /** Pool creation timestamp */
    createdAt: number;

    /** Last update timestamp */
    updatedAt: number;
}

/**
 * Outcome types for prediction market
 */
export enum Outcome {
    YES = 'YES',
    NO = 'NO'
}

/**
 * Result of a swap operation
 */
export interface SwapResult {
    /** Amount of tokens received from the swap */
    amountOut: bigint;

    /** Effective price paid per token */
    effectivePrice: number;

    /** Price impact as a percentage (0-100) */
    priceImpact: number;

    /** New pool state after the swap */
    newPoolState: PoolState;
}

/**
 * Result of a "Mint & Swap" bet operation
 */
export interface BetResult {
    /** USDC amount bet */
    usdcIn: bigint;

    /** Outcome chosen (YES or NO) */
    outcome: Outcome;

    /** Shares received from initial mint */
    mintedShares: bigint;

    /** Additional shares received from swap */
    swappedShares: bigint;

    /** Total shares received */
    totalShares: bigint;

    /** Effective price per share */
    effectivePrice: number;

    /** New implied probability after the bet */
    newProbability: number;

    /** Updated pool state */
    newPoolState: PoolState;
}

/**
 * Pool price information
 */
export interface PoolPrices {
    /** Price of YES share (0-1) */
    yesPrice: number;

    /** Price of NO share (0-1) */
    noPrice: number;

    /** Implied probability of YES outcome (0-100%) */
    yesProbability: number;

    /** Implied probability of NO outcome (0-100%) */
    noProbability: number;
}

/**
 * Configuration for creating a new pool
 */
export interface PoolConfig {
    /** Market identifier */
    marketId: string;

    /** Initial liquidity for each side */
    initialLiquidity: bigint;

    /** Virtual liquidity offset (default: 50000 * 10^6 for USDC) */
    virtualLiquidity?: bigint;
}

/**
 * Settlement result after market resolution
 */
export interface SettlementResult {
    /** The winning outcome */
    winningOutcome: Outcome;

    /** User's shares of winning outcome */
    winningShares: bigint;

    /** USDC payout amount */
    payout: bigint;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** USDC has 6 decimals */
export const USDC_DECIMALS = 6;

/** 1 USDC in base units */
export const ONE_USDC = BigInt(10 ** USDC_DECIMALS);

/** Maximum price for a share (1.00 USDC) */
export const MAX_PRICE = 1.0;

/** Minimum price for a share (to prevent division issues) */
export const MIN_PRICE = 0.01;

/** Maximum allowed price cap (99%) to maintain stability */
export const PRICE_CAP = 0.99;

/** Default virtual liquidity offset (50,000 USDC worth) */
export const DEFAULT_VIRTUAL_LIQUIDITY = BigInt(50_000) * ONE_USDC;

/** Protocol fee in basis points (100 = 1%) */
export const PROTOCOL_FEE_BPS = 100;

/** Basis points denominator */
export const BPS_DENOMINATOR = 10_000;

// ═══════════════════════════════════════════════════════════════════════════
// FRONTEND API TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Market with frontend-friendly format (serialized BigInts)
 */
export interface Market {
    marketId: string;
    title: string;
    description: string | null;
    expiresAt: string;
    status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
    resolutionValue: 'YES' | 'NO' | null;
    yesReserves: string;
    noReserves: string;
    totalCollateral: string;
    kInvariant: string;
    prices: PoolPrices;
    // Optional UI fields for display
    category?: string;
    trending?: boolean;
    participants?: number;
    volume?: string;
}

/**
 * Bet quote response
 */
export interface BetQuote {
    expectedShares: string;
    effectivePrice: number;
    priceImpact: number;
}

/**
 * User position in a market
 */
export interface Position {
    yesShares: string;
    noShares: string;
    costBasis: string;
}

/**
 * Result of selling a position
 */
export interface SellResult {
    usdcOut: string;
    priceImpact: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Format USDC amount from base units to display string
 * @param amount Amount in base units (6 decimals)
 * @returns Formatted string like "100.00"
 */
export function formatUSDC(amount: string | bigint): string {
    const value = typeof amount === 'string' ? BigInt(amount) : amount;
    const whole = value / BigInt(10 ** USDC_DECIMALS);
    const frac = value % BigInt(10 ** USDC_DECIMALS);
    const fracStr = frac.toString().padStart(USDC_DECIMALS, '0').slice(0, 2);
    return `${whole}.${fracStr}`;
}

/**
 * Parse user input to USDC base units
 * @param input User input like "100" or "50.25"
 * @returns Amount in base units (6 decimals)
 */
export function parseUSDCInput(input: string): string {
    const num = parseFloat(input);
    if (isNaN(num) || num < 0) return '0';
    return Math.floor(num * 10 ** USDC_DECIMALS).toString();
}

