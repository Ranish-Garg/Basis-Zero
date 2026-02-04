/**
 * Pool Manager - State Management for Multiple Prediction Markets
 */

import {
    PoolState,
    PoolConfig,
    BetResult,
    Outcome,
    ONE_USDC
} from './types';
import { createPool, getPrices, getPoolSummary } from './pool';
import { placeBet, quoteBet, placeSafeModeBet, sellPosition, getPositionValue } from './mint-swap';
import {
    UserPosition,
    MarketResolution,
    calculateMarketSettlement,
    formatSettlementSummary,
    validatePoolSolvency
} from './settlement';

interface Position {
    yesShares: bigint;
    noShares: bigint;
    totalCostBasis: bigint;
    bets: BetRecord[];
}

interface BetRecord {
    betId: string;
    timestamp: number;
    usdcAmount: bigint;
    outcome: Outcome;
    sharesReceived: bigint;
    effectivePrice: number;
}

interface ManagedPool {
    pool: PoolState;
    positions: Map<string, Position>;
    status: 'active' | 'resolved' | 'cancelled';
    resolution?: MarketResolution;
}

export class PoolManager {
    private pools: Map<string, ManagedPool> = new Map();

    createMarket(config: PoolConfig): PoolState {
        if (this.pools.has(config.marketId)) {
            throw new Error(`Market ${config.marketId} already exists`);
        }
        const pool = createPool(config);
        this.pools.set(config.marketId, { pool, positions: new Map(), status: 'active' });
        console.log(`[PoolManager] Created market: ${config.marketId}`);
        return pool;
    }

    getPool(marketId: string): PoolState | null {
        return this.pools.get(marketId)?.pool ?? null;
    }

    getActiveMarkets(): PoolState[] {
        return Array.from(this.pools.values())
            .filter(m => m.status === 'active')
            .map(m => m.pool);
    }

    placeBet(marketId: string, userId: string, usdcAmount: bigint, betOn: Outcome): BetResult {
        const managed = this.pools.get(marketId);
        if (!managed) throw new Error(`Market ${marketId} not found`);
        if (managed.status !== 'active') throw new Error(`Market ${marketId} is not active`);

        const result = placeBet(managed.pool, usdcAmount, betOn);
        managed.pool = result.newPoolState;

        let pos = managed.positions.get(userId);
        if (!pos) {
            pos = { yesShares: 0n, noShares: 0n, totalCostBasis: 0n, bets: [] };
            managed.positions.set(userId, pos);
        }
        if (betOn === Outcome.YES) pos.yesShares += result.totalShares;
        else pos.noShares += result.totalShares;
        pos.totalCostBasis += usdcAmount;
        pos.bets.push({
            betId: `${marketId}-${userId}-${Date.now()}`,
            timestamp: Date.now(),
            usdcAmount,
            outcome: betOn,
            sharesReceived: result.totalShares,
            effectivePrice: result.effectivePrice
        });
        return result;
    }

    quoteBet(marketId: string, usdcAmount: bigint, betOn: Outcome) {
        const managed = this.pools.get(marketId);
        if (!managed || managed.status !== 'active') return null;
        return quoteBet(managed.pool, usdcAmount, betOn);
    }

    sellPosition(marketId: string, userId: string, sharesAmount: bigint, outcome: Outcome) {
        const managed = this.pools.get(marketId);
        if (!managed) throw new Error(`Market ${marketId} not found`);
        if (managed.status !== 'active') throw new Error(`Market ${marketId} is not active`);

        const pos = managed.positions.get(userId);
        if (!pos) throw new Error('User has no position to sell');

        const currentShares = outcome === Outcome.YES ? pos.yesShares : pos.noShares;
        if (currentShares < sharesAmount) {
            throw new Error(`Insufficient shares. Held: ${currentShares}, Selling: ${sharesAmount}`);
        }

        const result = sellPosition(managed.pool, sharesAmount, outcome);
        managed.pool = result.newPoolState;

        // Update User Position
        if (outcome === Outcome.YES) pos.yesShares -= sharesAmount;
        else pos.noShares -= sharesAmount;

        return result;
    }

    getPosition(marketId: string, userId: string): Position | null {
        return this.pools.get(marketId)?.positions.get(userId) ?? null;
    }

    getAllPositions(marketId: string): UserPosition[] {
        const managed = this.pools.get(marketId);
        if (!managed) return [];
        return Array.from(managed.positions.entries()).map(([userId, pos]) => ({
            userId, marketId, yesShares: pos.yesShares, noShares: pos.noShares, totalCostBasis: pos.totalCostBasis
        }));
    }

    resolveMarket(resolution: MarketResolution): void {
        const managed = this.pools.get(resolution.marketId);
        if (!managed) throw new Error(`Market ${resolution.marketId} not found`);
        if (managed.status !== 'active') throw new Error(`Market already ${managed.status}`);
        const positions = this.getAllPositions(resolution.marketId);
        if (!validatePoolSolvency(managed.pool, positions, resolution.winningOutcome)) {
            throw new Error('Pool solvency check failed');
        }
        managed.status = 'resolved';
        managed.resolution = resolution;
    }

    settleMarket(marketId: string) {
        const managed = this.pools.get(marketId);
        if (!managed) throw new Error(`Market ${marketId} not found`);
        if (managed.status !== 'resolved' || !managed.resolution) throw new Error('Market not resolved');
        return calculateMarketSettlement(this.getAllPositions(marketId), managed.resolution);
    }

    getPrices(marketId: string) {
        const managed = this.pools.get(marketId);
        return managed ? getPrices(managed.pool) : null;
    }
}

export const poolManager = new PoolManager();
