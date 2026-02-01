/**
 * Pyth Oracle Service
 * 
 * Integrates with Pyth Network for real-time price feeds.
 * Used by Yellow sessions to resolve market outcomes instantly.
 */

import { HermesClient } from '@pythnetwork/hermes-client';

export interface PriceData {
  feedId: string;
  price: number;
  confidence: number;
  publishTime: number;
  expo: number;
}

export class PythPriceService {
  private client: HermesClient;
  private priceCache: Map<string, PriceData> = new Map();
  private cacheMaxAgeMs = 1000; // 1 second cache

  // Common Pyth price feed IDs
  static readonly FEEDS = {
    BTC_USD: '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
    ETH_USD: '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
    SOL_USD: '0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d'
  };

  constructor() {
    // Use Pyth's public Hermes endpoint
    this.client = new HermesClient('https://hermes.pyth.network');
  }

  /**
   * Get latest price for a feed
   */
  async getLatestPrice(feedId: string): Promise<PriceData> {
    // Check cache first
    const cached = this.priceCache.get(feedId);
    if (cached && Date.now() - cached.publishTime < this.cacheMaxAgeMs) {
      return cached;
    }

    try {
      const priceUpdates = await this.client.getLatestPriceUpdates([feedId]);
      
      if (!priceUpdates.parsed || priceUpdates.parsed.length === 0) {
        throw new Error(`No price data for feed ${feedId}`);
      }

      const parsed = priceUpdates.parsed[0];
      const priceInfo = parsed.price;

      const priceData: PriceData = {
        feedId,
        price: Number(priceInfo.price) * Math.pow(10, priceInfo.expo),
        confidence: Number(priceInfo.conf) * Math.pow(10, priceInfo.expo),
        publishTime: parsed.price.publish_time * 1000,
        expo: priceInfo.expo
      };

      this.priceCache.set(feedId, priceData);
      return priceData;
    } catch (error) {
      // Return mock data for demo if Pyth is unavailable
      console.warn(`Pyth fetch failed, using mock data: ${error}`);
      return this.getMockPrice(feedId);
    }
  }

  /**
   * Subscribe to real-time price updates via polling
   * Note: For production, use WebSocket or SSE properly
   */
  async subscribeToFeeds(
    feedIds: string[],
    onUpdate: (price: PriceData) => void,
    intervalMs: number = 1000
  ): Promise<() => void> {
    let running = true;

    const poll = async () => {
      while (running) {
        for (const feedId of feedIds) {
          try {
            const price = await this.getLatestPrice(feedId);
            onUpdate(price);
          } catch (e) {
            console.warn(`Poll failed for ${feedId}:`, e);
          }
        }
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    };

    poll();

    // Return stop function
    return () => { running = false; };
  }

  /**
   * Mock price data for demo/testing
   */
  private getMockPrice(feedId: string): PriceData {
    const mockPrices: Record<string, number> = {
      [PythPriceService.FEEDS.BTC_USD]: 97500,
      [PythPriceService.FEEDS.ETH_USD]: 4850,
      [PythPriceService.FEEDS.SOL_USD]: 185
    };

    return {
      feedId,
      price: mockPrices[feedId] || 100,
      confidence: 0.01,
      publishTime: Date.now(),
      expo: -8
    };
  }
}
