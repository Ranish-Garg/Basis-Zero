/**
 * Database-Backed Pool Manager - Uses Supabase for persistent storage
 */

import { PoolState, PoolConfig, BetResult, Outcome } from './types';
import { createPool, getPrices } from './pool';
import { placeBet, quoteBet, sellPosition } from './mint-swap';
import * as db from '../db/amm-repository';

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE-BACKED POOL MANAGER
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateMarketInput {
    marketId: string;
    title: string;
    description?: string;
    category?: string;
    expiresAt: Date;
    initialLiquidity: bigint;
    resolutionType?: 'manual' | 'oracle';
    oracleConfig?: Record<string, unknown>;
    resolverAddress?: string;
}

export interface MarketWithMetadata {
    marketId: string;
    title: string;
    description: string | null;
    category: string;
    expiresAt: string;
    status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
    resolutionValue: 'YES' | 'NO' | null;
    resolutionType: 'manual' | 'oracle' | null;
    oracleConfig: Record<string, unknown> | null;
    resolverAddress: string | null;
    yesReserves: string;
    noReserves: string;
    kInvariant: string;
    createdAt: string;
    prices: {
        yesPrice: number;
        noPrice: number;
        yesProbability: number;
        noProbability: number;
    };
}

/**
 * Create a new prediction market in the database
 */
export async function createMarketDB(input: CreateMarketInput): Promise<MarketWithMetadata> {
    // Calculate initial reserves (equal for 50/50 odds)
    const initialReserves = input.initialLiquidity;
    const kInvariant = initialReserves * initialReserves;

    // Insert into database
    const row = await db.createMarket({
        marketId: input.marketId,
        title: input.title,
        description: input.description,
        category: input.category,
        expiresAt: input.expiresAt,
        yesReserves: initialReserves,
        noReserves: initialReserves,
        kInvariant,
        resolutionType: input.resolutionType,
        oracleConfig: input.oracleConfig,
        resolverAddress: input.resolverAddress
    });

    console.log(`[PoolManager-DB] Created market: ${input.marketId} - ${input.title}`);

    // Calculate prices
    const yesReserves = BigInt(row.yes_reserves);
    const noReserves = BigInt(row.no_reserves);
    const totalReserves = yesReserves + noReserves;
    const yesPrice = totalReserves > 0n ? Number(noReserves) / Number(totalReserves) : 0.5;
    const noPrice = 1 - yesPrice;

    return {
        marketId: row.market_id,
        title: row.title,
        description: row.description,
        category: input.category || 'general',
        expiresAt: row.expires_at,
        status: row.status,
        resolutionValue: row.resolution_value,
        resolutionType: row.resolution_type,
        oracleConfig: row.oracle_config as Record<string, unknown>,
        resolverAddress: row.resolver_address,
        yesReserves: row.yes_reserves,
        noReserves: row.no_reserves,
        kInvariant: row.k_invariant,
        createdAt: row.created_at,
        prices: {
            yesPrice,
            noPrice,
            yesProbability: Math.round(yesPrice * 100),
            noProbability: Math.round(noPrice * 100)
        }
    };
}

/**
 * Get all active markets from the database
 */
export async function getActiveMarketsDB(): Promise<MarketWithMetadata[]> {
    const rows = await db.getActiveMarkets();

    return rows.map(row => {
        const yesReserves = BigInt(row.yes_reserves);
        const noReserves = BigInt(row.no_reserves);
        const totalReserves = yesReserves + noReserves;
        const yesPrice = totalReserves > 0n ? Number(noReserves) / Number(totalReserves) : 0.5;
        const noPrice = 1 - yesPrice;

        return {
            marketId: row.market_id,
            title: row.title,
            description: row.description,
            category: row.category || 'general',
            expiresAt: row.expires_at,
            status: row.status,
            resolutionValue: row.resolution_value,
            resolutionType: row.resolution_type,
            oracleConfig: row.oracle_config as Record<string, unknown>,
            resolverAddress: row.resolver_address,
            yesReserves: row.yes_reserves,
            noReserves: row.no_reserves,
            kInvariant: row.k_invariant,
            createdAt: row.created_at,
            prices: {
                yesPrice,
                noPrice,
                yesProbability: Math.round(yesPrice * 100),
                noProbability: Math.round(noPrice * 100)
            }
        };
    });
}

/**
 * Get a single market from the database
 */
export async function getMarketDB(marketId: string): Promise<MarketWithMetadata | null> {
    const row = await db.getMarket(marketId);
    if (!row) return null;

    const yesReserves = BigInt(row.yes_reserves);
    const noReserves = BigInt(row.no_reserves);
    const totalReserves = yesReserves + noReserves;
    const yesPrice = totalReserves > 0n ? Number(noReserves) / Number(totalReserves) : 0.5;
    const noPrice = 1 - yesPrice;

    return {
        marketId: row.market_id,
        title: row.title,
        description: row.description,
        category: row.category || 'general',
        expiresAt: row.expires_at,
        status: row.status,
        resolutionValue: row.resolution_value,
        resolutionType: row.resolution_type,
        oracleConfig: row.oracle_config as Record<string, unknown>,
        resolverAddress: row.resolver_address,
        yesReserves: row.yes_reserves,
        noReserves: row.no_reserves,
        kInvariant: row.k_invariant,
        createdAt: row.created_at,
        prices: {
            yesPrice,
            noPrice,
            yesProbability: Math.round(yesPrice * 100),
            noProbability: Math.round(noPrice * 100)
        }
    };
}

/**
 * Place a bet on a market (updates database)
 */
export async function placeBetDB(
    marketId: string,
    userId: string,
    usdcAmount: bigint,
    outcome: Outcome
): Promise<{
    success: boolean;
    shares: string;
    effectivePrice: number;
    newPrices: { yesPrice: number; noPrice: number };
}> {
    // Get current market state
    const row = await db.getMarket(marketId);
    if (!row) throw new Error(`Market ${marketId} not found`);
    if (row.status !== 'ACTIVE') throw new Error(`Market ${marketId} is not active`);

    // Convert to pool state for AMM calculations
    const pool: PoolState = {
        marketId: row.market_id,
        yesReserves: BigInt(row.yes_reserves),
        noReserves: BigInt(row.no_reserves),
        k: BigInt(row.k_invariant),
        virtualLiquidity: BigInt(row.yes_reserves),
        totalCollateral: 0n,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: Date.now()
    };

    // Execute bet using AMM
    const result = placeBet(pool, usdcAmount, outcome);

    // Update market reserves in database
    await db.updateMarketReserves(
        marketId,
        result.newPoolState.yesReserves,
        result.newPoolState.noReserves,
        result.newPoolState.k
    );

    // Update user position in database
    const existingPos = await db.getPosition(userId, marketId, outcome);
    const currentShares = existingPos ? BigInt(existingPos.shares) : 0n;
    const newShares = currentShares + result.totalShares;

    await db.upsertPosition(userId, marketId, outcome, newShares, result.effectivePrice);

    // Calculate new prices
    const newYesReserves = result.newPoolState.yesReserves;
    const newNoReserves = result.newPoolState.noReserves;
    const totalReserves = newYesReserves + newNoReserves;
    const yesPrice = Number(newNoReserves) / Number(totalReserves);
    const noPrice = 1 - yesPrice;

    console.log(`[PoolManager-DB] Bet placed: ${userId} bet ${usdcAmount} on ${outcome} in ${marketId}`);

    return {
        success: true,
        shares: result.totalShares.toString(),
        effectivePrice: result.effectivePrice,
        newPrices: { yesPrice, noPrice }
    };
}

/**
 * Quote a bet (no database changes)
 */
export async function quoteBetDB(
    marketId: string,
    usdcAmount: bigint,
    outcome: Outcome
): Promise<{ shares: string; effectivePrice: number; priceImpact: number } | null> {
    const row = await db.getMarket(marketId);
    if (!row || row.status !== 'ACTIVE') return null;

    const pool: PoolState = {
        marketId: row.market_id,
        yesReserves: BigInt(row.yes_reserves),
        noReserves: BigInt(row.no_reserves),
        k: BigInt(row.k_invariant),
        virtualLiquidity: BigInt(row.yes_reserves),
        totalCollateral: 0n,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: Date.now()
    };

    const quote = quoteBet(pool, usdcAmount, outcome);
    if (!quote) return null;

    return {
        shares: quote.expectedShares.toString(),
        effectivePrice: quote.effectivePrice,
        priceImpact: quote.priceImpact
    };
}

/**
 * Get user position in a market
 */
export async function getPositionDB(
    marketId: string,
    userId: string
): Promise<{ yesShares: string; noShares: string; costBasis: string } | null> {
    const yesPos = await db.getPosition(userId, marketId, Outcome.YES);
    const noPos = await db.getPosition(userId, marketId, Outcome.NO);

    if (!yesPos && !noPos) return null;

    return {
        yesShares: yesPos?.shares || '0',
        noShares: noPos?.shares || '0',
        costBasis: '0' // TODO: Track cost basis in positions table
    };
}

/**
 * Sell position (updates database)
 */
export async function sellPositionDB(
    marketId: string,
    userId: string,
    sharesAmount: bigint,
    outcome: Outcome
): Promise<{ usdcOut: string; priceImpact: number; newPrices: { yesPrice: number; noPrice: number } }> {
    // Get current market state
    const row = await db.getMarket(marketId);
    if (!row) throw new Error(`Market ${marketId} not found`);
    if (row.status !== 'ACTIVE') throw new Error(`Market ${marketId} is not active`);

    // Check user has enough shares
    const existingPos = await db.getPosition(userId, marketId, outcome);
    if (!existingPos) throw new Error('User has no position to sell');
    const currentShares = BigInt(existingPos.shares);
    if (currentShares < sharesAmount) {
        throw new Error(`Insufficient shares. Held: ${currentShares}, Selling: ${sharesAmount}`);
    }

    // Convert to pool state
    const pool: PoolState = {
        marketId: row.market_id,
        yesReserves: BigInt(row.yes_reserves),
        noReserves: BigInt(row.no_reserves),
        k: BigInt(row.k_invariant),
        virtualLiquidity: BigInt(row.yes_reserves),
        totalCollateral: 0n,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: Date.now()
    };

    // Execute sell using AMM
    const result = sellPosition(pool, sharesAmount, outcome);

    // Update market reserves
    await db.updateMarketReserves(
        marketId,
        result.newPoolState.yesReserves,
        result.newPoolState.noReserves,
        result.newPoolState.k
    );

    // Update user position
    const newShares = currentShares - sharesAmount;
    await db.upsertPosition(userId, marketId, outcome, newShares, existingPos.average_entry_price);

    // Calculate new prices
    const newYesReserves = result.newPoolState.yesReserves;
    const newNoReserves = result.newPoolState.noReserves;
    const totalReserves = newYesReserves + newNoReserves;
    const yesPrice = Number(newNoReserves) / Number(totalReserves);
    const noPrice = 1 - yesPrice;

    console.log(`[PoolManager-DB] Sold: ${userId} sold ${sharesAmount} ${outcome} shares in ${marketId}`);

    return {
        usdcOut: result.usdcOut.toString(),
        priceImpact: result.priceImpact,
        newPrices: { yesPrice, noPrice }
    };
}

/**
 * Resolve a market
 */
export async function resolveMarketDB(
    marketId: string,
    winner: Outcome,
    resolvedBy?: string
): Promise<void> {
    const row = await db.getMarket(marketId);
    if (!row) throw new Error('Market not found');
    if (row.status !== 'ACTIVE') throw new Error('Market is not active');

    // Update database
    await db.resolveMarket(marketId, winner, resolvedBy);

    console.log(`[PoolManager-DB] Resolved market: ${marketId} - Winner: ${winner}`);
}

/**
 * Get markets pending resolution
 */
export async function getMarketsToResolveDB(): Promise<MarketWithMetadata[]> {
    const rows = await db.getMarketsToResolve();

    return rows.map(row => {
        const yesReserves = BigInt(row.yes_reserves);
        const noReserves = BigInt(row.no_reserves);
        const totalReserves = yesReserves + noReserves;
        const yesPrice = totalReserves > 0n ? Number(noReserves) / Number(totalReserves) : 0.5;
        const noPrice = 1 - yesPrice;

        return {
            marketId: row.market_id,
            title: row.title,
            description: row.description,
            category: row.category || 'general',
            expiresAt: row.expires_at,
            status: row.status,
            resolutionValue: row.resolution_value,
            resolutionType: row.resolution_type,
            oracleConfig: row.oracle_config as Record<string, unknown>,
            yesReserves: row.yes_reserves,
            noReserves: row.no_reserves,
            kInvariant: row.k_invariant,
            createdAt: row.created_at,
            prices: {
                yesPrice,
                noPrice,
                yesProbability: Math.round(yesPrice * 100),
                noProbability: Math.round(noPrice * 100)
            }
        };
    });
}

/**
 * Claim winnings from a resolved market
 */
export async function claimWinningsDB(
    marketId: string,
    userId: string
): Promise<{ success: boolean; payout: string }> {
    // 1. Check market status
    const row = await db.getMarket(marketId);
    if (!row) throw new Error('Market not found');
    if (row.status !== 'RESOLVED') throw new Error('Market not resolved');
    if (!row.resolution_value) throw new Error('Market resolution value missing');

    const winningOutcome = row.resolution_value === 'YES' ? Outcome.YES : Outcome.NO;

    // 2. Get user position for winning outcome
    const position = await db.getPosition(userId, marketId, winningOutcome);
    if (!position) throw new Error('No position found');

    // Check internal shares
    const shares = BigInt(position.shares);
    if (shares <= 0n) throw new Error('No winnings to claim');

    // 3. Payout = Shares * 1.0 (since 1 share of winner = 1 USDC collateral)
    const payout = shares;

    // 4. Update position (shares -> 0)
    await db.upsertPosition(userId, marketId, winningOutcome, 0n, position.average_entry_price);

    // 5. Update User Balance (Session)
    const session = await db.getSessionByUser(userId);
    if (!session) {
        throw new Error('No active session found to credit winnings');
    }

    const currentBalance = BigInt(session.current_balance);
    const newBalance = currentBalance + payout;
    const newNonce = session.nonce + 1;

    await db.updateSessionBalance(session.session_id, newBalance, session.latest_signature, newNonce);

    console.log(`[PoolManager] Claimed ${payout} USDC for ${userId} in ${marketId}`);

    return {
        success: true,
        payout: payout.toString()
    };
}
