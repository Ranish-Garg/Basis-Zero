/**
 * AMM Router - API Routes for Prediction Market Operations
 * Uses database-backed pool manager for persistent storage
 */

import { Router } from 'express';
import { Outcome } from './types';
import {
    createMarketDB,
    getActiveMarketsDB,
    getMarketsByResolverDB,
    getMarketDB,
    placeBetDB,
    quoteBetDB,
    getPositionDB,
    sellPositionDB,
    resolveMarketDB,
    getMarketsToResolveDB,
    claimWinningsDB
} from './db-pool-manager';

export const ammRouter = Router();

// Create a new market
ammRouter.post('/create', async (req, res) => {
    try {
        const {
            marketId,
            title,
            description,
            category,
            expiresAt,
            initialLiquidity,
            resolutionType,
            oracleConfig,
            resolverAddress
        } = req.body;

        if (!marketId || !title || !expiresAt || !initialLiquidity) {
            return res.status(400).json({
                error: 'Missing required fields: marketId, title, expiresAt, initialLiquidity'
            });
        }

        const market = await createMarketDB({
            marketId,
            title,
            description,
            category: category || 'general',
            expiresAt: new Date(expiresAt),
            initialLiquidity: BigInt(initialLiquidity),
            resolutionType,
            oracleConfig,
            resolverAddress
        });

        res.json({ success: true, market });
    } catch (err) {
        console.error('[AMM Create] Error:', err);
        res.status(500).json({ error: String(err) });
    }
});

// List all active markets
ammRouter.get('/markets', async (req, res) => {
    try {
        const markets = await getActiveMarketsDB();
        res.json({ markets });
    } catch (err) {
        console.error('[AMM Markets] Error:', err);
        res.status(500).json({ error: String(err), markets: [] });
    }
});

// Get markets by resolver address (for profile page - includes all statuses )
ammRouter.get('/markets/resolver/:address', async (req, res) => {
    try {
        const { address } = req.params;
        if (!address) {
            return res.status(400).json({ error: 'Missing resolver address' });
        }
        const markets = await getMarketsByResolverDB(address);
        res.json({ markets });
    } catch (err) {
        console.error('[AMM Markets By Resolver] Error:', err);
        res.status(500).json({ error: String(err), markets: [] });
    }
});

// Get a single market
ammRouter.get('/market/:marketId', async (req, res) => {
    try {
        const market = await getMarketDB(req.params.marketId);
        if (!market) {
            return res.status(404).json({ error: 'Market not found' });
        }
        res.json({ market });
    } catch (err) {
        console.error('[AMM Market] Error:', err);
        res.status(500).json({ error: String(err) });
    }
});

// Quote a bet price
ammRouter.get('/quote', async (req, res) => {
    try {
        const { marketId, amount, outcome } = req.query;

        if (!marketId || !amount || outcome === undefined) {
            return res.status(400).json({ error: 'Missing parameters: marketId, amount, outcome' });
        }

        // Outcome: 0 = YES, 1 = NO
        const outcomeEnum = Number(outcome) === 0 ? Outcome.YES : Outcome.NO;

        const quote = await quoteBetDB(
            String(marketId),
            BigInt(String(amount)),
            outcomeEnum
        );

        if (!quote) {
            return res.status(404).json({ error: 'Market not found or not active' });
        }

        res.json(quote);
    } catch (err) {
        console.error('[AMM Quote] Error:', err);
        res.status(400).json({ error: String(err) });
    }
});

// Place a bet
ammRouter.post('/bet', async (req, res) => {
    try {
        const { marketId, userId, amount, outcome } = req.body;

        if (!marketId || !userId || !amount || outcome === undefined) {
            return res.status(400).json({ error: 'Missing parameters: marketId, userId, amount, outcome' });
        }

        // Outcome: 0 = YES, 1 = NO
        const outcomeEnum = Number(outcome) === 0 ? Outcome.YES : Outcome.NO;

        // Validate bet amount
        const betAmount = BigInt(amount);
        if (betAmount <= 0n) {
            return res.status(400).json({ error: 'Bet amount must be positive' });
        }

        const result = await placeBetDB(
            marketId,
            userId,
            betAmount,
            outcomeEnum
        );

        res.json(result);
    } catch (err) {
        console.error('[AMM Bet] Error:', err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        res.status(500).json({ error: errorMessage });
    }
});

// Sell a position
ammRouter.post('/sell', async (req, res) => {
    try {
        const { marketId, userId, amount, outcome } = req.body;

        if (!marketId || !userId || !amount || outcome === undefined) {
            return res.status(400).json({ error: 'Missing parameters: marketId, userId, amount, outcome' });
        }

        // Outcome: 0 = YES, 1 = NO
        const outcomeEnum = Number(outcome) === 0 ? Outcome.YES : Outcome.NO;

        const result = await sellPositionDB(
            marketId,
            userId,
            BigInt(amount),
            outcomeEnum
        );

        res.json(result);
    } catch (err) {
        console.error('[AMM Sell] Error:', err);
        res.status(500).json({ error: String(err) });
    }
});

// Resolve a market
ammRouter.post('/resolve', async (req, res) => {
    try {
        const { marketId, outcome, resolvedBy } = req.body;

        if (!marketId || outcome === undefined) {
            return res.status(400).json({ error: 'Missing parameters: marketId, outcome' });
        }

        // Outcome: 0 = YES, 1 = NO
        const outcomeEnum = Number(outcome) === 0 ? Outcome.YES : Outcome.NO;

        await resolveMarketDB(marketId, outcomeEnum, resolvedBy);

        res.json({ success: true });
    } catch (err) {
        console.error('[AMM Resolve] Error:', err);
        res.status(500).json({ error: String(err) });
    }
});

// Get markets pending resolution
ammRouter.get('/pending-resolution', async (req, res) => {
    try {
        const markets = await getMarketsToResolveDB();
        res.json({ markets });
    } catch (err) {
        console.error('[AMM Pending Resolution] Error:', err);
        res.status(500).json({ error: String(err), markets: [] });
    }
});

// Get all positions for a user across all markets
ammRouter.get('/positions/:userId', async (req, res) => {
    try {
        const { userId } = req.params;

        // Only count positions from ACTIVE markets for totalValue (locked amount)
        const { getUserActivePositions } = await import('../db/amm-repository.js');
        const activePositions = await getUserActivePositions(userId);

        // Calculate total value only from active market positions
        let totalValue = 0n;
        for (const pos of activePositions) {
            const shares = BigInt(pos.shares || '0');
            if (shares > 0n) {
                totalValue += shares;
            }
        }

        res.json({
            positions: activePositions.map((p: { market_id: string; outcome: string; shares: string; average_entry_price: number }) => ({
                marketId: p.market_id,
                outcome: p.outcome,
                shares: p.shares,
                averageEntryPrice: p.average_entry_price
            })),
            totalValue: totalValue.toString()
        });
    } catch (err) {
        console.error('[AMM User Positions] Error:', err);
        res.status(500).json({ error: String(err), positions: [], totalValue: '0' });
    }
});


// Get user position
ammRouter.get('/position/:marketId/:userId', async (req, res) => {
    try {
        const { marketId, userId } = req.params;
        const position = await getPositionDB(marketId, userId);

        res.json({ position });
    } catch (err) {
        console.error('[AMM Position] Error:', err);
        res.status(500).json({ error: String(err), position: null });
    }
});

// Claim winnings
ammRouter.post('/claim', async (req, res) => {
    try {
        const { marketId, userId } = req.body;

        if (!marketId || !userId) {
            return res.status(400).json({ error: 'Missing parameters: marketId, userId' });
        }

        const result = await claimWinningsDB(marketId, userId);
        res.json(result);
    } catch (err) {
        console.error('[AMM Claim] Error:', err);
        res.status(500).json({ error: String(err) });
    }
});

// Get trade history for a user
ammRouter.get('/trades/:userAddress', async (req, res) => {
    try {
        const { userAddress } = req.params;
        if (!userAddress) {
            return res.status(400).json({ error: 'Missing user address' });
        }

        const { getTradesByUser } = await import('../db/amm-repository.js');
        const trades = await getTradesByUser(userAddress);

        res.json({
            trades: trades.map(t => ({
                id: t.id,
                sessionId: t.session_id,
                userAddress: t.user_address,
                marketId: t.market_id,
                tradeType: t.trade_type,
                outcome: t.outcome,
                shares: t.shares,
                price: t.price,
                costBasis: t.cost_basis,
                realizedPnl: t.realized_pnl,
                marketTitle: t.market_title,
                createdAt: t.created_at
            }))
        });
    } catch (err) {
        console.error('[AMM Trades] Error:', err);
        res.status(500).json({ error: String(err), trades: [] });
    }
});
