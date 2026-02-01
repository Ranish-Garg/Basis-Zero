/**
 * RWA Yield Oracle
 * 
 * Fetches and caches yield rates from various RWA providers:
 * - BUIDL (BlackRock)
 * - OUSG (Ondo)
 * 
 * Used by the streaming balance calculation
 */

export interface RWARate {
  symbol: string;
  name: string;
  apyBps: number; // APY in basis points (500 = 5%)
  lastUpdated: number;
  source: string;
}

export class RWAYieldOracle {
  private rates: Map<string, RWARate> = new Map();
  private cacheTimeMs = 5 * 60 * 1000; // 5 minute cache

  constructor() {
    // Initialize with default rates
    this.rates.set('BUIDL', {
      symbol: 'BUIDL',
      name: 'BlackRock USD Institutional Digital Liquidity Fund',
      apyBps: 520, // ~5.2% APY
      lastUpdated: Date.now(),
      source: 'mock'
    });

    this.rates.set('OUSG', {
      symbol: 'OUSG',
      name: 'Ondo Short-Term US Government Treasuries',
      apyBps: 490, // ~4.9% APY
      lastUpdated: Date.now(),
      source: 'mock'
    });
  }

  /**
   * Get current yield rate for an RWA token
   */
  getRate(symbol: string): RWARate | undefined {
    return this.rates.get(symbol);
  }

  /**
   * Get the best available rate across all RWA providers
   */
  getBestRate(): RWARate {
    let best: RWARate | undefined;
    for (const rate of this.rates.values()) {
      if (!best || rate.apyBps > best.apyBps) {
        best = rate;
      }
    }
    return best!;
  }

  /**
   * Refresh rates from external sources
   */
  async refreshRates(): Promise<void> {
    // TODO: Fetch actual rates from RWA provider APIs
    // For hackathon, we use static mock rates
  }

  /**
   * Calculate yield for a given principal over time
   */
  calculateYield(principal: bigint, rateBps: number, durationSeconds: number): bigint {
    const secondsPerYear = BigInt(365 * 24 * 60 * 60);
    const bpsDenominator = BigInt(10000);
    
    return (principal * BigInt(rateBps) * BigInt(durationSeconds)) / (secondsPerYear * bpsDenominator);
  }
}

// Singleton instance
export const rwaOracle = new RWAYieldOracle();
