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
 * Get all markets created by a specific resolver address (any status)
 */
export async function getMarketsByResolverDB(resolverAddress: string): Promise<MarketWithMetadata[]> {
    const rows = await db.getMarketsByResolver(resolverAddress);

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
 * @param userId - The session ID (from activeSessionId) or wallet address
 * Note: When using sessions, userId should be the session_id for proper balance tracking
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

    // Check if userId is a session and has sufficient balance
    const session = await db.getSession(userId);
    if (session) {
        const currentBalance = BigInt(session.current_balance);
        if (currentBalance < usdcAmount) {
            throw new Error(`Insufficient session balance. Available: ${currentBalance}, Required: ${usdcAmount}`);
        }
    }

    // Convert to pool state for AMM calculations
    const pool: PoolState = db.marketRowToPoolState(row);

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

    // Deduct from session balance if this is a session-based bet
    if (session) {
        const newBalance = BigInt(session.current_balance) - usdcAmount;
        const newNonce = session.nonce + 1;
        await db.updateSessionBalance(session.session_id, newBalance, session.latest_signature, newNonce);
    }

    // Calculate new prices
    const newYesReserves = result.newPoolState.yesReserves;
    const newNoReserves = result.newPoolState.noReserves;
    const totalReserves = newYesReserves + newNoReserves;
    const yesPrice = Number(newNoReserves) / Number(totalReserves);
    const noPrice = 1 - yesPrice;

    console.log(`[PoolManager-DB] Bet placed: ${userId} bet ${usdcAmount} on ${outcome} in ${marketId}`);

    // Deduct USDC cost from session balance
    try {
        const session = await db.getSession(userId);
        if (session) {
            const currentBalance = BigInt(session.current_balance);
            const newBalance = currentBalance - usdcAmount;
            const newNonce = session.nonce + 1;
            await db.updateSessionBalance(session.session_id, newBalance, session.latest_signature, newNonce);
            console.log(`[PoolManager-DB] Session balance updated: ${currentBalance} -> ${newBalance} (deducted ${usdcAmount})`);
        }
    } catch (balErr) {
        console.warn(`[PoolManager-DB] Failed to update session balance on buy: ${balErr}`);
    }

    // Record trade for PnL tracking
    try {
        const userAddress = await db.getSessionUserAddress(userId);
        await db.insertTrade({
            sessionId: userId,
            userAddress: userAddress || userId,
            marketId,
            tradeType: 'BUY',
            outcome,
            shares: result.totalShares,
            price: result.effectivePrice,
            costBasis: usdcAmount,
            realizedPnl: 0n,
            marketTitle: row.title
        });
    } catch (tradeErr) {
        console.warn(`[PoolManager-DB] Failed to record trade: ${tradeErr}`);
    }

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

    const pool: PoolState = db.marketRowToPoolState(row);

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
    const pool: PoolState = db.marketRowToPoolState(row);

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

    // Credit session balance if this is a session-based sell
    const session = await db.getSession(userId);
    if (session) {
        const newBalance = BigInt(session.current_balance) + result.usdcOut;
        const newNonce = session.nonce + 1;
        await db.updateSessionBalance(session.session_id, newBalance, session.latest_signature, newNonce);
    }

    // Calculate new prices
    const newYesReserves = result.newPoolState.yesReserves;
    const newNoReserves = result.newPoolState.noReserves;
    const totalReserves = newYesReserves + newNoReserves;
    const yesPrice = Number(newNoReserves) / Number(totalReserves);
    const noPrice = 1 - yesPrice;

    console.log(`[PoolManager-DB] Sold: ${userId} sold ${sharesAmount} ${outcome} shares in ${marketId}`);

    // Add USDC proceeds to session balance
    try {
        const session = await db.getSession(userId);
        if (session) {
            const currentBalance = BigInt(session.current_balance);
            const newBalance = currentBalance + result.usdcOut;
            const newNonce = session.nonce + 1;
            await db.updateSessionBalance(session.session_id, newBalance, session.latest_signature, newNonce);
            console.log(`[PoolManager-DB] Session balance updated: ${currentBalance} -> ${newBalance} (added ${result.usdcOut})`);
        }
    } catch (balErr) {
        console.warn(`[PoolManager-DB] Failed to update session balance on sell: ${balErr}`);
    }

    // Record trade for PnL tracking
    // Realized PnL = USDC received - (shares sold * average entry price)
    try {
        const costBasisForSold = BigInt(Math.round(Number(sharesAmount) * existingPos.average_entry_price));
        const realizedPnl = result.usdcOut - costBasisForSold;
        const userAddress = await db.getSessionUserAddress(userId);
        await db.insertTrade({
            sessionId: userId,
            userAddress: userAddress || userId,
            marketId,
            tradeType: 'SELL',
            outcome,
            shares: sharesAmount,
            price: Number(result.usdcOut) / Number(sharesAmount),
            costBasis: result.usdcOut,
            realizedPnl,
            marketTitle: row.title
        });
    } catch (tradeErr) {
        console.warn(`[PoolManager-DB] Failed to record sell trade: ${tradeErr}`);
    }

    return {
        usdcOut: result.usdcOut.toString(),
        priceImpact: result.priceImpact,
        newPrices: { yesPrice, noPrice }
    };
}

/**
 * Resolve a market and auto-settle all positions for all users.
 * Winning shares = $1 each, losing shares = $0.
 * PnL is calculated and session balances are updated for every holder.
 */
export async function resolveMarketDB(
    marketId: string,
    winner: Outcome,
    resolvedBy?: string
): Promise<void> {
    const row = await db.getMarket(marketId);
    if (!row) throw new Error('Market not found');
    if (row.status !== 'ACTIVE') throw new Error('Market is not active');

    // 1. Update market status to RESOLVED
    await db.resolveMarket(marketId, winner, resolvedBy);
    console.log(`[PoolManager-DB] Resolved market: ${marketId} - Winner: ${winner}`);

    // 2. Auto-settle all positions for all users
    const losingOutcome = winner === Outcome.YES ? Outcome.NO : Outcome.YES;

    try {
        const allPositions = await db.getMarketPositions(marketId);
        console.log(`[PoolManager-DB] Auto-settling ${allPositions.length} positions for market ${marketId}`);

        // Group positions by user_id (sessionId)
        const userPositions = new Map<string, { win: typeof allPositions[0] | null; lose: typeof allPositions[0] | null }>();
        for (const pos of allPositions) {
            const shares = BigInt(pos.shares);
            if (shares <= 0n) continue;

            const userId = pos.user_id;
            if (!userPositions.has(userId)) {
                userPositions.set(userId, { win: null, lose: null });
            }
            const entry = userPositions.get(userId)!;
            const outcomeEnum = pos.outcome === 'YES' ? Outcome.YES : Outcome.NO;
            if (outcomeEnum === winner) {
                entry.win = pos;
            } else {
                entry.lose = pos;
            }
        }

        // Settle each user
        for (const [userId, positions] of userPositions) {
            const winShares = positions.win ? BigInt(positions.win.shares) : 0n;
            const loseShares = positions.lose ? BigInt(positions.lose.shares) : 0n;

            // Payout = winning shares * $1 each
            const payout = winShares;

            // PnL calculation
            const winCostBasis = positions.win
                ? BigInt(Math.round(Number(winShares) * positions.win.average_entry_price))
                : 0n;
            const loseCostBasis = positions.lose
                ? BigInt(Math.round(Number(loseShares) * positions.lose.average_entry_price))
                : 0n;
            const realizedPnl = payout - winCostBasis - loseCostBasis;

            // Zero out both positions
            if (positions.win && winShares > 0n) {
                await db.upsertPosition(userId, marketId, winner, 0n, positions.win.average_entry_price);
            }
            if (positions.lose && loseShares > 0n) {
                await db.upsertPosition(userId, marketId, losingOutcome, 0n, positions.lose.average_entry_price);
            }

            // Credit payout to session balance
            if (payout > 0n) {
                try {
                    const session = await db.getSession(userId);
                    if (session) {
                        const currentBalance = BigInt(session.current_balance);
                        const newBalance = currentBalance + payout;
                        const newNonce = session.nonce + 1;
                        await db.updateSessionBalance(session.session_id, newBalance, session.latest_signature, newNonce);
                    }
                } catch (balErr) {
                    console.warn(`[PoolManager-DB] Failed to credit payout for ${userId}: ${balErr}`);
                }
            }

            // Record CLAIM trade for PnL tracking
            try {
                const userAddress = await db.getSessionUserAddress(userId);
                await db.insertTrade({
                    sessionId: userId,
                    userAddress: userAddress || userId,
                    marketId,
                    tradeType: 'CLAIM',
                    outcome: winner,
                    shares: winShares + loseShares,
                    price: winShares > 0n ? 1.0 : 0,
                    costBasis: payout,
                    realizedPnl,
                    marketTitle: row.title
                });
            } catch (tradeErr) {
                console.warn(`[PoolManager-DB] Failed to record claim trade for ${userId}: ${tradeErr}`);
            }

            console.log(`[PoolManager-DB] Settled ${userId}: payout=${payout}, PnL=${realizedPnl}`);
        }
    } catch (settleErr) {
        console.error(`[PoolManager-DB] Auto-settlement failed for market ${marketId}:`, settleErr);
    }
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
 * Claim winnings from a resolved market
 * Winning shares = $1 each (1 USDC per share)
 * PnL = payout - cost basis (shares * average_entry_price)
 */
export async function claimWinningsDB(
    marketId: string,
    userId: string
): Promise<{ success: boolean; payout: string; realizedPnl: string }> {
    // 1. Check market status
    const row = await db.getMarket(marketId);
    if (!row) throw new Error('Market not found');
    if (row.status !== 'RESOLVED') throw new Error('Market not resolved');
    if (!row.resolution_value) throw new Error('Market resolution value missing');

    const winningOutcome = row.resolution_value === 'YES' ? Outcome.YES : Outcome.NO;
    const losingOutcome = row.resolution_value === 'YES' ? Outcome.NO : Outcome.YES;

    // 2. Get user position for winning outcome
    const winningPosition = await db.getPosition(userId, marketId, winningOutcome);
    const losingPosition = await db.getPosition(userId, marketId, losingOutcome);

    const winShares = winningPosition ? BigInt(winningPosition.shares) : 0n;
    const loseShares = losingPosition ? BigInt(losingPosition.shares) : 0n;

    if (winShares <= 0n && loseShares <= 0n) throw new Error('No positions to claim');

    // 3. Payout = winning shares * $1 each; losing shares = $0
    const payout = winShares; // 1 USDC per winning share

    // 4. Calculate realized PnL
    // For winning side: PnL = payout - cost basis
    const winCostBasis = winningPosition
        ? BigInt(Math.round(Number(winShares) * winningPosition.average_entry_price))
        : 0n;
    // For losing side: PnL = 0 - cost basis (total loss)
    const loseCostBasis = losingPosition
        ? BigInt(Math.round(Number(loseShares) * losingPosition.average_entry_price))
        : 0n;

    const realizedPnl = payout - winCostBasis - loseCostBasis;

    // 5. Zero out both positions
    if (winningPosition && winShares > 0n) {
        await db.upsertPosition(userId, marketId, winningOutcome, 0n, winningPosition.average_entry_price);
    }
    if (losingPosition && loseShares > 0n) {
        await db.upsertPosition(userId, marketId, losingOutcome, 0n, losingPosition.average_entry_price);
    // 5. Update User Balance (Session)
    // userId is actually the session_id when trading through sessions
    const session = await db.getSession(userId);
    if (!session) {
        throw new Error('No active session found to credit winnings');
    }

    // 6. Update User Balance (Session)
    if (payout > 0n) {
        const session = await db.getSessionByUser(userId);
        if (!session) {
            // Try looking up the session from the userId (which may be sessionId)
            const sessionDirect = await db.getSession(userId);
            if (!sessionDirect) {
                throw new Error('No active session found to credit winnings');
            }
            const currentBalance = BigInt(sessionDirect.current_balance);
            const newBalance = currentBalance + payout;
            const newNonce = sessionDirect.nonce + 1;
            await db.updateSessionBalance(sessionDirect.session_id, newBalance, sessionDirect.latest_signature, newNonce);
        } else {
            const currentBalance = BigInt(session.current_balance);
            const newBalance = currentBalance + payout;
            const newNonce = session.nonce + 1;
            await db.updateSessionBalance(session.session_id, newBalance, session.latest_signature, newNonce);
        }
    }

    // 7. Record claim trade
    try {
        const userAddress = await db.getSessionUserAddress(userId);
        await db.insertTrade({
            sessionId: userId,
            userAddress: userAddress || userId,
            marketId,
            tradeType: 'CLAIM',
            outcome: winningOutcome,
            shares: winShares + loseShares,
            price: winShares > 0n ? 1.0 : 0,
            costBasis: payout,
            realizedPnl,
            marketTitle: row.title
        });
    } catch (tradeErr) {
        console.warn(`[PoolManager-DB] Failed to record claim trade: ${tradeErr}`);
    }

    console.log(`[PoolManager] Claimed ${payout} USDC for ${userId} in ${marketId} (PnL: ${realizedPnl})`);

    return {
        success: true,
        payout: payout.toString(),
        realizedPnl: realizedPnl.toString()
    };
}
