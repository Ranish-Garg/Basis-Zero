/**
 * AMM Router - API Routes for Prediction Market Operations
 * Uses database-backed pool manager for persistent storage
 */

import { Router } from 'express';
import { Outcome } from './types';
import {
    createMarketDB,
    getActiveMarketsDB,
    getMarketDB,
    placeBetDB,
    quoteBetDB,
    getPositionDB,
    sellPositionDB
} from './db-pool-manager';

export const ammRouter = Router();

// Create a new market
ammRouter.post('/create', async (req, res) => {
    try {
        const { marketId, title, description, category, expiresAt, initialLiquidity } = req.body;

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
            initialLiquidity: BigInt(initialLiquidity)
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

        const result = await placeBetDB(
            marketId,
            userId,
            BigInt(amount),
            outcomeEnum
        );

        res.json(result);
    } catch (err) {
        console.error('[AMM Bet] Error:', err);
        res.status(500).json({ error: String(err) });
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

        res.json({ success: true, ...result });
    } catch (err) {
        console.error('[AMM Sell] Error:', err);
        res.status(500).json({ error: String(err) });
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
