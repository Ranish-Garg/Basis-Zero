/**
 * Persistent Pool Manager - Database-backed State Management
 * 
 * This version uses Supabase for persistence instead of in-memory storage.
 * All methods are async to support database operations.
 */

import {
    PoolState,
    PoolConfig,
    BetResult,
    Outcome,
} from './types';
import { createPool, getPrices } from './pool';
import { placeBet, quoteBet, sellPosition } from './mint-swap';
import {
    UserPosition,
    MarketResolution,
    calculateMarketSettlement,
    validatePoolSolvency
} from './settlement';
import * as repo from '../db/amm-repository';

// Extended config with metadata
export interface MarketConfig extends PoolConfig {
    title: string;
    description?: string;
    expiresAt: Date;
}

export class PersistentPoolManager {

    /**
     * Create a new prediction market
     */
    async createMarket(config: MarketConfig): Promise<PoolState> {
        // Check if market already exists
        const existing = await repo.getMarket(config.marketId);
        if (existing) {
            throw new Error(`Market ${config.marketId} already exists`);
        }

        // Create pool state using existing logic
        const pool = createPool(config);

        // Persist to database
        await repo.createMarket({
            marketId: config.marketId,
            title: config.title,
            description: config.description,
            expiresAt: config.expiresAt,
            yesReserves: pool.yesReserves,
            noReserves: pool.noReserves,
            kInvariant: pool.k
        });

        console.log(`[PersistentPoolManager] Created market: ${config.marketId}`);
        return pool;
    }

    /**
     * Get a market's pool state
     */
    async getPool(marketId: string): Promise<PoolState | null> {
        const row = await repo.getMarket(marketId);
        if (!row) return null;
        return repo.marketRowToPoolState(row);
    }

    /**
     * Get all active markets
     */
    async getActiveMarkets(): Promise<PoolState[]> {
        const rows = await repo.getActiveMarkets();
        return rows.map(repo.marketRowToPoolState);
    }

    /**
     * Place a bet on a market
     */
    async placeBet(
        marketId: string,
        userId: string,
        usdcAmount: bigint,
        betOn: Outcome
    ): Promise<BetResult> {
        // Get current market state
        const row = await repo.getMarket(marketId);
        if (!row) throw new Error(`Market ${marketId} not found`);
        if (row.status !== 'ACTIVE') throw new Error(`Market ${marketId} is not active`);

        const pool = repo.marketRowToPoolState(row);

        // Execute bet logic
        const result = placeBet(pool, usdcAmount, betOn);

        // Update market reserves in database
        await repo.updateMarketReserves(
            marketId,
            result.newPoolState.yesReserves,
            result.newPoolState.noReserves,
            result.newPoolState.k
        );

        // Update user position
        const existingPos = await repo.getPosition(userId, marketId, betOn);
        const currentShares = existingPos ? BigInt(existingPos.shares) : 0n;
        const newShares = currentShares + result.totalShares;

        // Safety check: newShares must be > 0 if usdcAmount > 0
        if (usdcAmount > 0n && result.totalShares === 0n) {
            console.error(`[PoolManager] CRITICAL: Bet ${usdcAmount} USDC yielded 0 shares. Pool State:`, pool);
            throw new Error('Bet yielded 0 shares (unexpected)');
        }

        console.log(`[PoolManager] Updating position for ${userId}: Shares ${currentShares} -> ${newShares}`);

        // Calculate new average entry price
        const existingValue = existingPos
            ? Number(existingPos.shares) * existingPos.average_entry_price
            : 0;
        const newValue = Number(usdcAmount) / 1e6;
        const totalValue = existingValue + newValue;
        const avgPrice = totalValue / (Number(newShares) / 1e6);

        await repo.upsertPosition(userId, marketId, betOn, newShares, avgPrice);

        return result;
    }

    /**
     * Quote a bet without executing
     */
    async quoteBet(
        marketId: string,
        usdcAmount: bigint,
        betOn: Outcome
    ): Promise<{ expectedShares: bigint; effectivePrice: number; priceImpact: number } | null> {
        const row = await repo.getMarket(marketId);
        if (!row || row.status !== 'ACTIVE') return null;

        const pool = repo.marketRowToPoolState(row);
        return quoteBet(pool, usdcAmount, betOn);
    }

    /**
     * Sell a position back to the pool
     */
    async sellPosition(
        marketId: string,
        userId: string,
        sharesAmount: bigint,
        outcome: Outcome
    ): Promise<{ usdcOut: bigint; newPoolState: PoolState; priceImpact: number }> {
        const row = await repo.getMarket(marketId);
        if (!row) throw new Error(`Market ${marketId} not found`);
        if (row.status !== 'ACTIVE') throw new Error(`Market ${marketId} is not active`);

        // Check user has enough shares
        const pos = await repo.getPosition(userId, marketId, outcome);
        if (!pos) throw new Error('User has no position to sell');

        const currentShares = BigInt(pos.shares);
        if (currentShares < sharesAmount) {
            throw new Error(`Insufficient shares. Held: ${currentShares}, Selling: ${sharesAmount}`);
        }

        const pool = repo.marketRowToPoolState(row);
        const result = sellPosition(pool, sharesAmount, outcome);

        // Update market reserves
        await repo.updateMarketReserves(
            marketId,
            result.newPoolState.yesReserves,
            result.newPoolState.noReserves,
            result.newPoolState.k
        );

        // Update user position
        const newShares = currentShares - sharesAmount;
        await repo.upsertPosition(userId, marketId, outcome, newShares, pos.average_entry_price);

        return result;
    }

    /**
     * Get a user's position in a market
     */
    async getPosition(marketId: string, userId: string): Promise<{
        yesShares: bigint;
        noShares: bigint;
    } | null> {
        const yesPos = await repo.getPosition(userId, marketId, Outcome.YES);
        const noPos = await repo.getPosition(userId, marketId, Outcome.NO);

        if (!yesPos && !noPos) return null;

        return {
            yesShares: yesPos ? BigInt(yesPos.shares) : 0n,
            noShares: noPos ? BigInt(noPos.shares) : 0n
        };
    }

    /**
     * Get all positions for a market (for settlement)
     */
    async getAllPositions(marketId: string): Promise<UserPosition[]> {
        const rows = await repo.getMarketPositions(marketId);

        // Group by user
        const userMap = new Map<string, UserPosition>();

        for (const row of rows) {
            let pos = userMap.get(row.user_id);
            if (!pos) {
                pos = {
                    userId: row.user_id,
                    marketId,
                    yesShares: 0n,
                    noShares: 0n,
                    totalCostBasis: 0n
                };
                userMap.set(row.user_id, pos);
            }

            const shares = BigInt(row.shares);
            if (row.outcome === 'YES') {
                pos.yesShares = shares;
            } else {
                pos.noShares = shares;
            }
        }

        return Array.from(userMap.values());
    }

    /**
     * Resolve a market with a winning outcome
     */
    async resolveMarket(resolution: MarketResolution): Promise<void> {
        const row = await repo.getMarket(resolution.marketId);
        if (!row) throw new Error(`Market ${resolution.marketId} not found`);
        if (row.status !== 'ACTIVE') throw new Error(`Market already ${row.status}`);

        const pool = repo.marketRowToPoolState(row);
        const positions = await this.getAllPositions(resolution.marketId);

        if (!validatePoolSolvency(pool, positions, resolution.winningOutcome)) {
            throw new Error('Pool solvency check failed');
        }

        await repo.resolveMarket(resolution.marketId, resolution.winningOutcome);
        console.log(`[PersistentPoolManager] Resolved market: ${resolution.marketId} → ${resolution.winningOutcome}`);
    }

    /**
     * Calculate settlement for a resolved market
     */
    async settleMarket(marketId: string) {
        const row = await repo.getMarket(marketId);
        if (!row) throw new Error(`Market ${marketId} not found`);
        if (row.status !== 'RESOLVED' || !row.resolution_value) {
            throw new Error('Market not resolved');
        }

        const positions = await this.getAllPositions(marketId);
        const resolution: MarketResolution = {
            marketId,
            winningOutcome: row.resolution_value === 'YES' ? Outcome.YES : Outcome.NO,
            resolvedAt: Date.now(),
            oracleSource: 'database'
        };

        return calculateMarketSettlement(positions, resolution);
    }

    /**
     * Get current prices for a market
     */
    async getPrices(marketId: string) {
        const row = await repo.getMarket(marketId);
        if (!row) return null;

        const pool = repo.marketRowToPoolState(row);
        return getPrices(pool);
    }
}

// Singleton instance
export const persistentPoolManager = new PersistentPoolManager();
