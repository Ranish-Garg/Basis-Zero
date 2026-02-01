/**
 * Market Resolver
 * 
 * Handles prediction market definitions and resolution:
 * - Market creation and management
 * - Pyth oracle integration for price feeds
 * - Outcome resolution and bet settling
 */

import { Router } from 'express';
import { PythPriceService } from './pyth-oracle';

export interface Market {
  id: string;
  title: string;
  description: string;
  category: 'crypto' | 'sports' | 'politics' | 'custom';
  condition: {
    type: 'price_above' | 'price_below' | 'binary';
    asset?: string;
    threshold?: number;
    pythFeedId?: string;
  };
  status: 'open' | 'closed' | 'resolved';
  resolution?: 'YES' | 'NO';
  closeTime: number;
  createdAt: number;
}

export class MarketResolver {
  public router: Router;
  private markets: Map<string, Market> = new Map();
  private pythService: PythPriceService;

  constructor() {
    this.router = Router();
    this.pythService = new PythPriceService();
    this.setupRoutes();
    this.seedDemoMarkets();
  }

  private setupRoutes() {
    // List all markets
    this.router.get('/', (req, res) => {
      const markets = Array.from(this.markets.values());
      res.json({ markets });
    });

    // Get single market
    this.router.get('/:marketId', (req, res) => {
      const market = this.markets.get(req.params.marketId);
      if (!market) {
        return res.status(404).json({ error: 'Market not found' });
      }
      res.json(market);
    });

    // Get market price from oracle
    this.router.get('/:marketId/price', async (req, res) => {
      const market = this.markets.get(req.params.marketId);
      if (!market || !market.condition.pythFeedId) {
        return res.status(404).json({ error: 'Market or feed not found' });
      }

      try {
        const price = await this.pythService.getLatestPrice(market.condition.pythFeedId);
        res.json(price);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch price' });
      }
    });

    // Resolve market (admin only in production)
    this.router.post('/:marketId/resolve', async (req, res) => {
      try {
        const result = await this.resolveMarket(req.params.marketId);
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });
  }

  /**
   * Resolve a market based on oracle data
   */
  async resolveMarket(marketId: string): Promise<{ market: Market; outcome: 'YES' | 'NO' }> {
    const market = this.markets.get(marketId);
    if (!market) {
      throw new Error('Market not found');
    }

    if (market.status === 'resolved') {
      throw new Error('Market already resolved');
    }

    let outcome: 'YES' | 'NO';

    if (market.condition.type === 'price_above' && market.condition.pythFeedId) {
      const price = await this.pythService.getLatestPrice(market.condition.pythFeedId);
      outcome = price.price >= market.condition.threshold! ? 'YES' : 'NO';
    } else if (market.condition.type === 'price_below' && market.condition.pythFeedId) {
      const price = await this.pythService.getLatestPrice(market.condition.pythFeedId);
      outcome = price.price < market.condition.threshold! ? 'YES' : 'NO';
    } else {
      throw new Error('Manual resolution required for binary markets');
    }

    market.status = 'resolved';
    market.resolution = outcome;
    this.markets.set(marketId, market);

    return { market, outcome };
  }

  /**
   * Seed demo markets for hackathon
   */
  private seedDemoMarkets() {
    const demoMarkets: Market[] = [
      {
        id: 'btc-100k-feb',
        title: 'Will BTC exceed $100,000 by Feb 28?',
        description: 'Bitcoin price prediction for end of February 2026',
        category: 'crypto',
        condition: {
          type: 'price_above',
          asset: 'BTC',
          threshold: 100000,
          pythFeedId: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43' // BTC/USD
        },
        status: 'open',
        closeTime: new Date('2026-02-28').getTime(),
        createdAt: Date.now()
      },
      {
        id: 'eth-5k-feb',
        title: 'Will ETH exceed $5,000 by Feb 28?',
        description: 'Ethereum price prediction for end of February 2026',
        category: 'crypto',
        condition: {
          type: 'price_above',
          asset: 'ETH',
          threshold: 5000,
          pythFeedId: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace' // ETH/USD
        },
        status: 'open',
        closeTime: new Date('2026-02-28').getTime(),
        createdAt: Date.now()
      }
    ];

    for (const market of demoMarkets) {
      this.markets.set(market.id, market);
    }
  }
}
