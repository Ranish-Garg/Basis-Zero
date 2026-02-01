/**
 * Streaming Balance Calculator
 * 
 * Implements the core formula:
 * Balance = Initial + (Principal × RWA_Rate × ΔTime) - OpenBets
 * 
 * This runs off-chain in the Yellow session to provide real-time
 * balance updates including accrued yield.
 */

export interface StreamingBalanceResult {
  principal: bigint;
  accruedYield: bigint;
  openBets: bigint;
  currentBalance: bigint;
  yieldPerSecond: bigint;
  elapsedSeconds: number;
}

export class StreamingBalanceCalculator {
  private readonly SECONDS_PER_YEAR = 365 * 24 * 60 * 60;
  private readonly BPS_DENOMINATOR = 10000;

  /**
   * Calculate the current streaming balance
   * 
   * @param principal - Initial deposit amount
   * @param rwaRateBps - Annual yield rate in basis points (500 = 5%)
   * @param elapsedSeconds - Time since session start
   * @param openBets - Total amount in unresolved bets
   */
  calculate(
    principal: bigint,
    rwaRateBps: number,
    elapsedSeconds: number,
    openBets: bigint
  ): StreamingBalanceResult {
    const accruedYield = this.calculateYield(principal, rwaRateBps, elapsedSeconds);
    const yieldPerSecond = this.calculateYieldPerSecond(principal, rwaRateBps);
    
    let currentBalance = principal + accruedYield;
    if (currentBalance > openBets) {
      currentBalance = currentBalance - openBets;
    } else {
      currentBalance = BigInt(0);
    }

    return {
      principal,
      accruedYield,
      openBets,
      currentBalance,
      yieldPerSecond,
      elapsedSeconds
    };
  }

  /**
   * Calculate yield accrued over a time period
   */
  calculateYield(principal: bigint, rwaRateBps: number, elapsedSeconds: number): bigint {
    // yield = principal * rate * time / (year * bps_denominator)
    const numerator = principal * BigInt(rwaRateBps) * BigInt(Math.floor(elapsedSeconds));
    const denominator = BigInt(this.SECONDS_PER_YEAR) * BigInt(this.BPS_DENOMINATOR);
    
    return numerator / denominator;
  }

  /**
   * Calculate yield rate per second (for UI ticking display)
   */
  calculateYieldPerSecond(principal: bigint, rwaRateBps: number): bigint {
    return (principal * BigInt(rwaRateBps)) / 
           (BigInt(this.SECONDS_PER_YEAR) * BigInt(this.BPS_DENOMINATOR));
  }

  /**
   * Project future balance at a given timestamp
   */
  projectBalance(
    principal: bigint,
    rwaRateBps: number,
    sessionStartMs: number,
    targetTimestampMs: number,
    openBets: bigint
  ): bigint {
    const elapsedSeconds = (targetTimestampMs - sessionStartMs) / 1000;
    const result = this.calculate(principal, rwaRateBps, elapsedSeconds, openBets);
    return result.currentBalance;
  }
}
