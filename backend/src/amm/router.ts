
import { Router } from 'express';
import { poolManager } from './pool-manager';
import { Outcome } from './types';

export const ammRouter = Router();

// Create a new market (Admin only in production)
ammRouter.post('/create', (req, res) => {
    try {
        const { marketId, initialLiquidity } = req.body;
        const pool = poolManager.createMarket({
            marketId,
            initialLiquidity: BigInt(initialLiquidity),
            virtualLiquidity: BigInt(initialLiquidity) // Default to 1:1 virtual liquidity for depth
        });
        res.json({ success: true, pool });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// List all active markets with current prices
ammRouter.get('/markets', (req, res) => {
    const markets = poolManager.getActiveMarkets();
    const summaries = markets.map(pool => ({
        ...pool,
        prices: poolManager.getPrices(pool.marketId),
        // Convert BigInt to string for JSON
        yesReserves: pool.yesReserves.toString(),
        noReserves: pool.noReserves.toString(),
        totalCollateral: pool.totalCollateral.toString(),
        k: pool.k.toString(),
        virtualLiquidity: pool.virtualLiquidity.toString()
    }));
    res.json({ markets: summaries });
});

// Quote a bet price
ammRouter.get('/quote', (req, res) => {
    const { marketId, amount, outcome } = req.query;
    try {
        const quote = poolManager.quoteBet(
            String(marketId),
            BigInt(String(amount)),
            Number(outcome) as unknown as Outcome
        );
        if (!quote) return res.status(404).json({ error: 'Market not found' });
        
        res.json({
            shares: quote.expectedShares.toString(),
            effectivePrice: quote.effectivePrice,
            priceImpact: quote.priceImpact
        });
    } catch (err) {
        res.status(400).json({ error: String(err) });
    }
});

// Place a bet
ammRouter.post('/bet', (req, res) => {
    const { marketId, userId, amount, outcome } = req.body;
    try {
        const result = poolManager.placeBet(
            marketId,
            userId,
            BigInt(amount),
            Number(outcome) as unknown as Outcome
        );

        res.json({
            success: true,
            // betId not directly returned by placeBet, generating or omitting
            shares: result.totalShares.toString(),
            price: result.effectivePrice,
            newPoolState: {
                yesPrice: result.newPoolState.yesReserves.toString(), 
                noPrice: result.newPoolState.noReserves.toString()
            }
        });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// Sell a position
ammRouter.post('/sell', (req, res) => {
    const { marketId, userId, amount, outcome } = req.body;
    try {
        const result = poolManager.sellPosition(
            marketId,
            userId,
            BigInt(amount),
            Number(outcome) as unknown as Outcome
        );

        res.json({
            success: true,
            usdcOut: result.usdcOut.toString(),
            priceImpact: result.priceImpact,
            newPoolState: {
                yesPrice: result.newPoolState.yesReserves.toString(), 
                noPrice: result.newPoolState.noReserves.toString()
            }
        });
    } catch (err) {
        res.status(500).json({ error: String(err) });
    }
});

// Get user position
ammRouter.get('/position/:marketId/:userId', (req, res) => {
    const { marketId, userId } = req.params;
    const pos = poolManager.getPosition(marketId, userId);
    if (!pos) return res.json({ position: null });
    
    res.json({
        position: {
            yesShares: pos.yesShares.toString(),
            noShares: pos.noShares.toString(),
            costBasis: pos.totalCostBasis.toString()
        }
    });
});
