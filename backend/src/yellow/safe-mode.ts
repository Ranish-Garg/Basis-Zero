/**
 * Safe Mode Enforcer
 * 
 * Implements the "yield-only" betting restriction:
 * - In Safe Mode: Users can only bet with accrued yield
 * - In Full Mode: Users can bet with principal + yield
 * 
 * This is the core innovation that makes prediction market
 * participation "zero cost" for risk-averse users.
 */

import type { SessionConfig } from './session-service';
import { StreamingBalanceCalculator } from './streaming-balance';

export class SafeModeEnforcer {
  private calculator: StreamingBalanceCalculator;
  private config: SessionConfig;

  constructor(config: SessionConfig) {
    this.config = config;
    this.calculator = new StreamingBalanceCalculator();
  }

  /**
   * Get available balance for betting based on mode
   * 
   * @param principal - Initial deposit
   * @param openBets - Current open bets
   * @param safeMode - If true, only yield is available
   */
  getAvailableBalance(
    principal: bigint,
    openBets: bigint,
    safeMode: boolean
  ): bigint {
    const elapsedSeconds = (Date.now() - this.config.createdAt) / 1000;
    const result = this.calculator.calculate(
      principal,
      this.config.rwaRateBps,
      elapsedSeconds,
      openBets
    );

    if (safeMode) {
      // Safe Mode: Only yield is available for betting
      // Available = accruedYield - openBets (from yield portion)
      if (result.accruedYield > openBets) {
        return result.accruedYield - openBets;
      }
      return BigInt(0);
    } else {
      // Full Mode: Principal + yield - openBets
      return result.currentBalance;
    }
  }

  /**
   * Check if a bet amount is allowed in current mode
   */
  canPlaceBet(
    amount: bigint,
    principal: bigint,
    openBets: bigint,
    safeMode: boolean
  ): { allowed: boolean; reason?: string; available: bigint } {
    const available = this.getAvailableBalance(principal, openBets, safeMode);

    if (amount > available) {
      const mode = safeMode ? 'Safe Mode (yield only)' : 'Full Mode';
      return {
        allowed: false,
        reason: `Insufficient balance in ${mode}. Available: ${available}, Requested: ${amount}`,
        available
      };
    }

    return { allowed: true, available };
  }

  /**
   * Get breakdown of balance for UI display
   */
  getBalanceBreakdown(principal: bigint, openBets: bigint): {
    principal: string;
    accruedYield: string;
    openBets: string;
    availableSafeMode: string;
    availableFullMode: string;
  } {
    const safeAvailable = this.getAvailableBalance(principal, openBets, true);
    const fullAvailable = this.getAvailableBalance(principal, openBets, false);
    
    const elapsedSeconds = (Date.now() - this.config.createdAt) / 1000;
    const result = this.calculator.calculate(
      principal,
      this.config.rwaRateBps,
      elapsedSeconds,
      openBets
    );

    return {
      principal: principal.toString(),
      accruedYield: result.accruedYield.toString(),
      openBets: openBets.toString(),
      availableSafeMode: safeAvailable.toString(),
      availableFullMode: fullAvailable.toString()
    };
  }
}
