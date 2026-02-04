/**
 * Persistent Pool Manager - Uses Supabase for storage
 * Falls back to in-memory if Supabase is not configured
 */

import { PoolState, PoolConfig, BetResult, Outcome, PoolPrices, ONE_USDC } from './types';
import { createPool, getPrices } from './pool';
import { placeBet as placeBetCore, quoteBet, sellPosition as sellPositionCore } from './mint-swap';
import {
    createMarket as dbCreateMarket,
    getActiveMarkets,
    getMarket,
    updateMarketReserves,
    upsertPosition,
    getPosition as dbGetPosition,
    MarketRow,
    PositionRow,
    marketRowToPoolState
} from '@/lib/db/amm-repository';
import { supabase } from '@/lib/db/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// In-Memory Fallback (when Supabase is not configured)
// ═══════════════════════════════════════════════════════════════════════════

interface InMemoryPool {
    pool: PoolState;
    title: string;
    description: string | null;
    expiresAt: string;
    positions: Map<string, { yesShares: bigint; noShares: bigint; costBasis: bigint }>;
}

const inMemoryPools: Map<string, InMemoryPool> = new Map();

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

export interface CreateMarketInput {
    marketId: string;
    title: string;
    description?: string;
    expiresAt?: Date;
    initialLiquidity: bigint;
}

export interface MarketData {
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
}

/**
 * Create a new market
 */
export async function createMarketPersistent(input: CreateMarketInput): Promise<MarketData> {
    const pool = createPool({
        marketId: input.marketId,
        initialLiquidity: input.initialLiquidity,
        virtualLiquidity: input.initialLiquidity
    });

    const expiresAt = input.expiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const prices = getPrices(pool);

    // Try to save to database
    if (supabase) {
        try {
            await dbCreateMarket({
                marketId: input.marketId,
                title: input.title,
                description: input.description,
                expiresAt,
                yesReserves: pool.yesReserves,
                noReserves: pool.noReserves,
                kInvariant: pool.k
            });
            console.log(`[AMM] Market ${input.marketId} saved to database`);
        } catch (error) {
            console.warn('[AMM] Failed to save to database, using in-memory:', error);
            // Fall through to in-memory
        }
    }

    // Always save to in-memory as well (for fast access)
    inMemoryPools.set(input.marketId, {
        pool,
        title: input.title,
        description: input.description || null,
        expiresAt: expiresAt.toISOString(),
        positions: new Map()
    });

    return {
        marketId: input.marketId,
        title: input.title,
        description: input.description || null,
        expiresAt: expiresAt.toISOString(),
        status: 'ACTIVE',
        resolutionValue: null,
        yesReserves: pool.yesReserves.toString(),
        noReserves: pool.noReserves.toString(),
        totalCollateral: pool.totalCollateral.toString(),
        kInvariant: pool.k.toString(),
        prices
    };
}

/**
 * Get all active markets
 */
export async function getMarketsPersistent(): Promise<MarketData[]> {
    const markets: MarketData[] = [];

    // Try to fetch from database first
    if (supabase) {
        try {
            const dbMarkets = await getActiveMarkets();
            for (const row of dbMarkets) {
                const pool = marketRowToPoolState(row);
                const prices = getPrices(pool);
                markets.push({
                    marketId: row.market_id,
                    title: row.title,
                    description: row.description,
                    expiresAt: row.expires_at,
                    status: row.status,
                    resolutionValue: row.resolution_value,
                    yesReserves: row.yes_reserves,
                    noReserves: row.no_reserves,
                    totalCollateral: (BigInt(row.yes_reserves) + BigInt(row.no_reserves)).toString(),
                    kInvariant: row.k_invariant,
                    prices
                });
            }
        } catch (error) {
            console.warn('[AMM] Failed to fetch from database:', error);
        }
    }

    // Also include in-memory markets (may have newer ones not yet in DB)
    for (const [marketId, data] of inMemoryPools) {
        if (!markets.find(m => m.marketId === marketId)) {
            const prices = getPrices(data.pool);
            markets.push({
                marketId,
                title: data.title,
                description: data.description,
                expiresAt: data.expiresAt,
                status: 'ACTIVE',
                resolutionValue: null,
                yesReserves: data.pool.yesReserves.toString(),
                noReserves: data.pool.noReserves.toString(),
                totalCollateral: data.pool.totalCollateral.toString(),
                kInvariant: data.pool.k.toString(),
                prices
            });
        }
    }

    return markets;
}

/**
 * Get quote for a bet
 */
export async function getQuotePersistent(
    marketId: string,
    amount: bigint,
    outcome: Outcome
): Promise<{ expectedShares: bigint; effectivePrice: number; priceImpact: number } | null> {
    const pool = await getPoolState(marketId);
    if (!pool) return null;

    return quoteBet(pool, amount, outcome);
}

/**
 * Place a bet
 */
export async function placeBetPersistent(
    marketId: string,
    userId: string,
    amount: bigint,
    outcome: Outcome
): Promise<BetResult> {
    const pool = await getPoolState(marketId);
    if (!pool) throw new Error(`Market ${marketId} not found`);

    const result = placeBetCore(pool, amount, outcome);

    // Update pool state
    await updatePoolState(marketId, result.newPoolState);

    // Update user position
    await updateUserPosition(marketId, userId, outcome, result.totalShares, result.effectivePrice);

    return result;
}

/**
 * Sell position
 */
export async function sellPositionPersistent(
    marketId: string,
    userId: string,
    amount: bigint,
    outcome: Outcome
): Promise<{ usdcOut: bigint; priceImpact: number }> {
    const pool = await getPoolState(marketId);
    if (!pool) throw new Error(`Market ${marketId} not found`);

    const result = sellPositionCore(pool, amount, outcome);

    // Update pool state
    await updatePoolState(marketId, result.newPoolState);

    return {
        usdcOut: result.usdcOut,
        priceImpact: result.priceImpact
    };
}

/**
 * Get user position
 */
export async function getPositionPersistent(
    marketId: string,
    userId: string
): Promise<{ yesShares: string; noShares: string; costBasis: string } | null> {
    // Try database first
    if (supabase) {
        try {
            const [yesPos, noPos] = await Promise.all([
                dbGetPosition(userId, marketId, Outcome.YES),
                dbGetPosition(userId, marketId, Outcome.NO)
            ]);

            if (yesPos || noPos) {
                return {
                    yesShares: yesPos?.shares || '0',
                    noShares: noPos?.shares || '0',
                    costBasis: '0' // TODO: track cost basis
                };
            }
        } catch (error) {
            console.warn('[AMM] Failed to get position from database:', error);
        }
    }

    // Fall back to in-memory
    const inMemory = inMemoryPools.get(marketId);
    if (inMemory) {
        const pos = inMemory.positions.get(userId);
        if (pos) {
            return {
                yesShares: pos.yesShares.toString(),
                noShares: pos.noShares.toString(),
                costBasis: pos.costBasis.toString()
            };
        }
    }

    return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function getPoolState(marketId: string): Promise<PoolState | null> {
    // Check in-memory first (faster)
    const inMemory = inMemoryPools.get(marketId);
    if (inMemory) return inMemory.pool;

    // Try database
    if (supabase) {
        try {
            const row = await getMarket(marketId);
            if (row) {
                const pool = marketRowToPoolState(row);
                // Cache in memory
                inMemoryPools.set(marketId, {
                    pool,
                    title: row.title,
                    description: row.description,
                    expiresAt: row.expires_at,
                    positions: new Map()
                });
                return pool;
            }
        } catch (error) {
            console.warn('[AMM] Failed to get pool from database:', error);
        }
    }

    return null;
}

async function updatePoolState(marketId: string, newPool: PoolState): Promise<void> {
    // Update in-memory
    const inMemory = inMemoryPools.get(marketId);
    if (inMemory) {
        inMemory.pool = newPool;
    }

    // Update database
    if (supabase) {
        try {
            await updateMarketReserves(
                marketId,
                newPool.yesReserves,
                newPool.noReserves,
                newPool.k
            );
        } catch (error) {
            console.warn('[AMM] Failed to update pool in database:', error);
        }
    }
}

async function updateUserPosition(
    marketId: string,
    userId: string,
    outcome: Outcome,
    shares: bigint,
    price: number
): Promise<void> {
    // Update in-memory
    const inMemory = inMemoryPools.get(marketId);
    if (inMemory) {
        let pos = inMemory.positions.get(userId);
        if (!pos) {
            pos = { yesShares: 0n, noShares: 0n, costBasis: 0n };
            inMemory.positions.set(userId, pos);
        }
        if (outcome === Outcome.YES) {
            pos.yesShares += shares;
        } else {
            pos.noShares += shares;
        }
    }

    // Update database
    if (supabase) {
        try {
            // Get existing position to add to it
            const existing = await dbGetPosition(userId, marketId, outcome);
            const existingShares = existing ? BigInt(existing.shares) : 0n;
            const newShares = existingShares + shares;

            await upsertPosition(userId, marketId, outcome, newShares, price);
        } catch (error) {
            console.warn('[AMM] Failed to update position in database:', error);
        }
    }
}
