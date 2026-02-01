/**
 * Yellow Network Session Service
 * 
 * Manages Nitrolite state channel sessions for off-chain betting:
 * - Session lifecycle (open, update, close)
 * - State signature handling
 * - Safe Mode enforcement
 */

import { Router } from 'express';
import { type Address } from 'viem';
import { StreamingBalanceCalculator } from './streaming-balance';
import { SafeModeEnforcer } from './safe-mode';

export interface SessionConfig {
  sessionId: string;
  participants: Address[];
  collateral: bigint;
  rwaRateBps: number;
  safeModeEnabled: boolean;
  createdAt: number;
}

export interface SessionState {
  sessionId: string;
  nonce: number;
  balances: Map<Address, bigint>;
  bets: Bet[];
  isFinal: boolean;
  signatures: string[];
}

export interface Bet {
  id: string;
  marketId: string;
  side: 'YES' | 'NO';
  amount: bigint;
  odds: number;
  timestamp: number;
  resolved: boolean;
  pnl?: bigint;
}

export class YellowSessionService {
  public router: Router;
  private sessions: Map<string, SessionConfig> = new Map();
  private states: Map<string, SessionState> = new Map();

  constructor() {
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    // Open a new trading session
    this.router.post('/open', async (req, res) => {
      try {
        const { userAddress, collateral, safeMode } = req.body;
        const session = await this.openSession(
          userAddress,
          BigInt(collateral),
          safeMode
        );
        res.json(session);
      } catch (error) {
        res.status(500).json({ error: 'Failed to open session' });
      }
    });

    // Get current session state
    this.router.get('/:sessionId', async (req, res) => {
      try {
        const state = this.getSessionState(req.params.sessionId);
        if (!state) {
          return res.status(404).json({ error: 'Session not found' });
        }
        res.json(this.serializeState(state));
      } catch (error) {
        res.status(500).json({ error: 'Failed to get session' });
      }
    });

    // Place a bet within a session
    this.router.post('/:sessionId/bet', async (req, res) => {
      try {
        const { marketId, side, amount, signature } = req.body;
        const result = await this.placeBet(
          req.params.sessionId,
          marketId,
          side,
          BigInt(amount),
          signature
        );
        res.json(result);
      } catch (error: any) {
        res.status(400).json({ error: error.message });
      }
    });

    // Close session and settle on-chain
    this.router.post('/:sessionId/close', async (req, res) => {
      try {
        const { signature } = req.body;
        const result = await this.closeSession(req.params.sessionId, signature);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: 'Failed to close session' });
      }
    });

    // Get streaming balance (real-time with yield)
    this.router.get('/:sessionId/balance', async (req, res) => {
      try {
        const balance = this.getStreamingBalance(req.params.sessionId);
        res.json(balance);
      } catch (error) {
        res.status(500).json({ error: 'Failed to get balance' });
      }
    });
  }

  /**
   * Open a new Nitrolite state channel session
   */
  async openSession(
    userAddress: Address,
    collateral: bigint,
    safeModeEnabled: boolean = false
  ): Promise<SessionConfig> {
    const sessionId = `session_${Date.now()}_${userAddress.slice(0, 8)}`;
    
    const config: SessionConfig = {
      sessionId,
      participants: [userAddress],
      collateral,
      rwaRateBps: 520, // Default to BUIDL rate
      safeModeEnabled,
      createdAt: Date.now()
    };

    const initialState: SessionState = {
      sessionId,
      nonce: 0,
      balances: new Map([[userAddress, collateral]]),
      bets: [],
      isFinal: false,
      signatures: []
    };

    this.sessions.set(sessionId, config);
    this.states.set(sessionId, initialState);

    // TODO: Open actual Nitrolite channel on-chain
    
    return config;
  }

  /**
   * Place a bet within an active session
   */
  async placeBet(
    sessionId: string,
    marketId: string,
    side: 'YES' | 'NO',
    amount: bigint,
    signature: string
  ): Promise<{ success: boolean; bet: Bet; newBalance: bigint }> {
    const config = this.sessions.get(sessionId);
    const state = this.states.get(sessionId);

    if (!config || !state) {
      throw new Error('Session not found');
    }

    // Check available balance (with Safe Mode)
    const enforcer = new SafeModeEnforcer(config);
    const available = enforcer.getAvailableBalance(
      config.collateral,
      this.getTotalBets(state),
      config.safeModeEnabled
    );

    if (amount > available) {
      throw new Error(`Insufficient balance. Available: ${available}, Requested: ${amount}`);
    }

    // Create bet
    const bet: Bet = {
      id: `bet_${Date.now()}`,
      marketId,
      side,
      amount,
      odds: 2.0, // TODO: Get from oracle
      timestamp: Date.now(),
      resolved: false
    };

    // Update state
    state.bets.push(bet);
    state.nonce++;
    state.signatures.push(signature);

    const newBalance = enforcer.getAvailableBalance(
      config.collateral,
      this.getTotalBets(state),
      config.safeModeEnabled
    );

    return { success: true, bet, newBalance };
  }

  /**
   * Close session and prepare for on-chain settlement
   */
  async closeSession(sessionId: string, signature: string) {
    const config = this.sessions.get(sessionId);
    const state = this.states.get(sessionId);

    if (!config || !state) {
      throw new Error('Session not found');
    }

    state.isFinal = true;
    state.signatures.push(signature);

    // Calculate final PnL
    const finalBalance = this.calculateFinalBalance(config, state);

    // TODO: Submit to on-chain YellowSessionManager

    return {
      sessionId,
      finalBalance: finalBalance.toString(),
      pnl: (finalBalance - config.collateral).toString(),
      betsPlaced: state.bets.length
    };
  }

  /**
   * Get real-time streaming balance (includes accrued yield)
   */
  getStreamingBalance(sessionId: string) {
    const config = this.sessions.get(sessionId);
    const state = this.states.get(sessionId);

    if (!config || !state) {
      throw new Error('Session not found');
    }

    const calculator = new StreamingBalanceCalculator();
    const elapsed = (Date.now() - config.createdAt) / 1000;
    
    return calculator.calculate(
      config.collateral,
      config.rwaRateBps,
      elapsed,
      this.getTotalBets(state)
    );
  }

  private getSessionState(sessionId: string): SessionState | undefined {
    return this.states.get(sessionId);
  }

  private getTotalBets(state: SessionState): bigint {
    return state.bets
      .filter(b => !b.resolved)
      .reduce((sum, b) => sum + b.amount, BigInt(0));
  }

  private calculateFinalBalance(config: SessionConfig, state: SessionState): bigint {
    const calculator = new StreamingBalanceCalculator();
    const elapsed = (Date.now() - config.createdAt) / 1000;
    const totalBets = this.getTotalBets(state);
    
    // Calculate base balance with yield
    const baseBalance = calculator.calculate(
      config.collateral,
      config.rwaRateBps,
      elapsed,
      BigInt(0)
    );

    // Add/subtract resolved bet PnLs
    const resolvedPnl = state.bets
      .filter(b => b.resolved && b.pnl !== undefined)
      .reduce((sum, b) => sum + b.pnl!, BigInt(0));

    return baseBalance.currentBalance + resolvedPnl - totalBets;
  }

  private serializeState(state: SessionState) {
    return {
      sessionId: state.sessionId,
      nonce: state.nonce,
      balances: Object.fromEntries(
        Array.from(state.balances.entries()).map(([k, v]) => [k, v.toString()])
      ),
      bets: state.bets.map(b => ({
        ...b,
        amount: b.amount.toString(),
        pnl: b.pnl?.toString()
      })),
      isFinal: state.isFinal
    };
  }
}
