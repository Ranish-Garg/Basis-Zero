/**
 * Yellow Network Session Service
 * 
 * Integrates with Yellow's Nitrolite SDK for off-chain state channel betting sessions.
 * 
 * Flow:
 * 1. User locks collateral on SessionEscrow contract with sessionId
 * 2. Backend receives notification and tracks the session
 * 3. Bets are processed off-chain via AMM
 * 4. Session closes with final PnL, backend signs settlement
 * 5. Frontend can call contract.settleSession with signatures
 * 
 * @see https://erc7824.org/quick_start
 */

import { Router } from 'express';
import {
  createECDSAMessageSigner,
  type MessageSigner,
} from '@erc7824/nitrolite';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, createPublicClient, http, type Address, type Hex, keccak256, encodePacked, toHex } from 'viem';
import { polygonAmoy } from 'viem/chains';
import { persistentPoolManager, Outcome } from '../amm';
import * as ammRepository from '../db/amm-repository';
import { SESSION_ESCROW_ADDRESS, SESSION_ESCROW_ABI } from './contracts';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionConfig {
  sessionId: Hex;          // Contract session ID (bytes32)
  user: Address;
  collateral: bigint;
  rwaRateBps: number;      // Yield rate in basis points (520 = 5.2%)
  initialYield: bigint;    // Accrued yield at session start (from contract)
  safeModeEnabled: boolean;
  createdAt: number;
  status: 'pending' | 'active' | 'closing' | 'closed';
}

export interface Bet {
  id: string;
  sessionId: Hex;
  marketId: string;
  side: 'YES' | 'NO';
  amount: bigint;     // USDC Cost
  shares: bigint;     // Shares received
  timestamp: number;
  resolved: boolean;
  won?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// YELLOW SESSION SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class YellowSessionService {
  public router: Router;
  private sessions = new Map<Hex, SessionConfig>();      // sessionId -> session
  private sessionBets = new Map<Hex, Bet[]>();           // sessionId -> bets
  private userSessions = new Map<Address, Hex>();        // user address -> active sessionId
  private signer: MessageSigner | null = null;
  private signerAddress: Address | null = null;
  private privateKey: Hex | null = null;

  constructor() {
    this.router = Router();
    this.setupRoutes();

    // Auto-initialize if env var set (use PRIVATE_KEY from .env)
    const pk = process.env.BACKEND_PRIVATE_KEY || process.env.PRIVATE_KEY;
    if (pk) {
      this.initialize(pk as Hex);
      console.log('🟡 Yellow Session Service auto-initialized from env');
    }
  }

  private setupRoutes() {
    // Initialize with private key (for signing settlements)
    this.router.post('/init', async (req, res) => {
      try {
        const { privateKey } = req.body;
        await this.initialize(privateKey);
        res.json({ success: true, address: this.signerAddress });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Open a new betting session (called after contract openSession)
    this.router.post('/open', async (req, res) => {
      try {
        const { userAddress, sessionId, collateral, safeModeEnabled, rwaRateBps } = req.body;

        if (!sessionId || !userAddress) {
          return res.status(400).json({ error: 'sessionId and userAddress required' });
        }

        const session = await this.openSession(
          userAddress as Address,
          sessionId as Hex,
          BigInt(collateral || '0'),
          safeModeEnabled ?? true,
          // DEMO MODE: 520000 bps = 5200% APY (100x boost for testing)
          // Production would use 520 (5.2% APY)
          rwaRateBps ?? 520000
        );
        res.json({ success: true, session: this.serializeSession(session) });
      } catch (error) {
        console.error('[Session Open] Error:', error);
        const message = error instanceof Error ? error.message : String(error);
        res.status(500).json({ error: message });
      }
    });

    // Place a bet in active session
    this.router.post('/bet', async (req, res) => {
      try {
        const { sessionId, marketId, side, amount } = req.body;
        const result = await this.placeBet(
          sessionId as Hex,
          marketId,
          side,
          BigInt(amount)
        );
        res.json({
          success: result.success,
          bet: this.serializeBet(result.bet),
          availableBalance: result.availableBalance.toString(),
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Close session and get settlement signature
    this.router.post('/close', async (req, res) => {
      try {
        const { sessionId } = req.body;

        if (!sessionId) {
          return res.status(400).json({ error: 'sessionId required' });
        }

        const result = await this.closeSession(sessionId as Hex);
        res.json({
          success: result.success,
          pnl: result.pnl.toString(),
          signature: result.signature,
          sessionId: result.sessionId
        });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Recover/re-register an existing on-chain session with backend
    // Use this after backend restart when session is still active on-chain
    this.router.post('/recover', async (req, res) => {
      try {
        const { userAddress, sessionId, collateral, safeModeEnabled } = req.body;

        if (!sessionId || !userAddress) {
          return res.status(400).json({ error: 'sessionId and userAddress required' });
        }

        // Re-register the session
        const session = await this.openSession(
          userAddress as Address,
          sessionId as Hex,
          BigInt(collateral || '0'),
          safeModeEnabled ?? true,
          520000 // Demo rate
        );

        console.log(`🟡 Session recovered: ${sessionId}`);
        res.json({ success: true, session: this.serializeSession(session), recovered: true });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Get session status
    this.router.get('/:sessionId', (req, res) => {
      const sessionId = req.params.sessionId as Hex;
      const session = this.sessions.get(sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      const bets = this.sessionBets.get(sessionId) || [];
      res.json({
        session: this.serializeSession(session),
        bets: bets.map(b => this.serializeBet(b)),
      });
    });

    // Get session by user address
    this.router.get('/user/:address', (req, res) => {
      const userAddress = req.params.address.toLowerCase() as Address;
      const sessionId = this.userSessions.get(userAddress);

      if (!sessionId) {
        return res.json({ session: null });
      }

      const session = this.sessions.get(sessionId);
      const bets = this.sessionBets.get(sessionId) || [];

      res.json({
        session: session ? this.serializeSession(session) : null,
        bets: bets.map(b => this.serializeBet(b)),
      });
    });

    // Get streaming balance (yield calculation)
    this.router.get('/:sessionId/balance', async (req, res) => {
      try {
        const sessionId = req.params.sessionId as Hex;
        const { safeMode } = req.query;

        const balance = await this.getStreamingBalance(
          sessionId,
          safeMode === 'true'
        );

        res.json({
          principal: balance.principal.toString(),
          yield: balance.yield.toString(),
          openBets: balance.openBets.toString(),
          available: balance.available.toString(),
          locked: balance.openBets.toString() // Alias for clarity
        });
      } catch (error) {
        console.error('[Session Balance] Error:', error);
        res.status(500).json({ error: String(error) });
      }
    });
  }

  // Serialize session for JSON response
  private serializeSession(session: SessionConfig) {
    return {
      ...session,
      collateral: session.collateral.toString(),
      initialYield: session.initialYield.toString(),
    };
  }

  // Serialize bet for JSON response
  private serializeBet(bet: Bet) {
    return {
      ...bet,
      amount: bet.amount.toString(),
      shares: bet.shares.toString(),
    };
  }

  /**
   * Initialize the service with server wallet for signing
   */
  async initialize(privateKey: Hex): Promise<void> {
    const account = privateKeyToAccount(privateKey);
    this.signerAddress = account.address;
    this.privateKey = privateKey;
    this.signer = createECDSAMessageSigner(privateKey);

    console.log(`🟡 Yellow Session Service initialized with signer: ${this.signerAddress}`);
  }

  /**
   * Open a new betting session (after user calls contract.openSession)
   */
  async openSession(
    userAddress: Address,
    sessionId: Hex,
    collateral: bigint,
    safeModeEnabled: boolean,
    rwaRateBps: number
  ): Promise<SessionConfig> {
    const normalizedUser = userAddress.toLowerCase() as Address;

    console.log(`🟡 Opening Session for ${userAddress}`);
    console.log(`   Session ID: ${sessionId}`);

    // FETCH ON-CHAIN DATA (Source of Truth)
    const publicClient = createPublicClient({
      chain: polygonAmoy,
      transport: http(process.env.POLYGON_AMOY_RPC_URL)
    });

    let onChainRate = BigInt(rwaRateBps); // Default fallback
    let initialYield = BigInt(0);

    try {
      console.log(`🔌 Syncing with Contract: ${SESSION_ESCROW_ADDRESS}`);

      // 1. Get Yield Rate
      const rateBps = await publicClient.readContract({
        address: SESSION_ESCROW_ADDRESS,
        abi: SESSION_ESCROW_ABI,
        functionName: 'yieldRateBps'
      });
      onChainRate = BigInt(rateBps);
      console.log(`   On-Chain Yield Rate: ${onChainRate} bps`);

      // 2. Get Initial Accrued Yield
      const info = await publicClient.readContract({
        address: SESSION_ESCROW_ADDRESS,
        abi: SESSION_ESCROW_ABI,
        functionName: 'getAccountInfo',
        args: [userAddress]
      });
      // info struct: { principal, yield, locked, activeSessionId, state }
      // Note: viem returns array or object depending on calling convention? 
      // Based on ABI outputs with names, viem returns object or array of values. 
      // ABI has named outputs, so checks types.
      // Assuming viem returns object-like or I access by index if array.
      // Usually returns object if names present? Let's check viem behavior: 
      // ABI defined with names -> returns object if multicall/readContract support it?
      // Actually, with simple ABI readContract returns result matching structure.
      // Let's assume property access works or use 'any'.
      // Safe bet: use (info as any).yield or similar.
      // BUT wait, in my ABI `accounts` returned struct, `getAccountInfo` returned tuple with names.
      // `viem` usually returns array/tuple for multiple return values unless mapped.
      // Let's assume array for safety: [principal, yield, locked, ...]

      // Checking my ABI: getAccountInfo outputs multiple values (tuple), not struct.
      // So return value is array: [principal, yield, locked, activeSessionId, state]

      // Wait, 'info' type? in TS 'readContract' infers type.
      // Because ABI is 'const', TS knows.
      // However, I need to be sure. I'll treat it as array.
      // Wait, 'getAccountInfo' returns multiple values.

      // If I use the updated ABI, I see output names.
      // Just in case, I'll log it.
      const infoResult: any = info;
      // Assuming array-like access
      if (infoResult && typeof infoResult[1] !== 'undefined') {
        initialYield = infoResult[1];
      } else if (infoResult && infoResult.yield) {
        initialYield = infoResult.yield;
      }

      console.log(`   Initial Accrued Yield: ${initialYield}`);

    } catch (error) {
      console.error("⚠️ Failed to sync with contract:", error);
      // Fallback to 0 initial yield and provided rate
    }

    console.log(`   Collateral: ${collateral}`);
    console.log(`   Safe Mode: ${safeModeEnabled}`);

    const session: SessionConfig = {
      sessionId,
      user: normalizedUser,
      collateral,
      rwaRateBps: Number(onChainRate),
      initialYield: initialYield,
      safeModeEnabled, // Should probably enforce strict mode here if contract says so? 
      // Currently user requested "Allow betting full locked amount".
      // Safe Mode boolean in backend is "Bet Only Yield". 
      // Full Mode is "Bet Principal + Yield".
      // This flag comes from frontend request?
      createdAt: Date.now(),
      status: 'active',
    };

    // Persist session to DB
    await ammRepository.upsertSession(
      sessionId,
      normalizedUser,
      collateral,
      Number(onChainRate),
      safeModeEnabled
    );

    this.sessions.set(sessionId, session);
    this.sessionBets.set(sessionId, []);
    this.userSessions.set(normalizedUser, sessionId);

    console.log(`🟡 Session opened: ${sessionId}`);

    return session;
  }

  /**
   * Place a bet in an active session
   */
  async placeBet(
    sessionId: Hex,
    marketId: string,
    side: 'YES' | 'NO',
    amount: bigint
  ): Promise<{ success: boolean; bet: Bet; availableBalance: bigint }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (session.status !== 'active') {
      throw new Error('Session not active');
    }

    // Calculate available balance (ASYNC now)
    const balance = await this.getStreamingBalance(sessionId, session.safeModeEnabled);

    // Check if user has enough AVAILABLE balance (Collateral + Yield - Locked)
    if (amount > balance.available) {
      throw new Error(`Insufficient balance. Available: ${Number(balance.available) / 1e6} USDC, Requested: ${Number(amount) / 1e6} USDC`);
    }

    // Convert side to AMM Outcome
    const outcome = side === 'YES' ? Outcome.YES : Outcome.NO;

    // Execute bet against PERSISTENT AMM Pool
    // This will update the 'positions' table in DB
    const result = await persistentPoolManager.placeBet(
      marketId,
      sessionId, // Use sessionId as userId for DB positions
      amount,
      outcome
    );

    // Create bet record (In-memory for session history, though DB has it too)
    const bet: Bet = {
      id: `bet_${Date.now()}`,
      sessionId,
      marketId,
      side,
      amount,
      shares: result.totalShares,
      timestamp: Date.now(),
      resolved: false,
    };

    // Add to session bets (In-memory cache)
    const bets = this.sessionBets.get(sessionId) || [];
    bets.push(bet);
    this.sessionBets.set(sessionId, bets);

    // Recalculate available balance
    const newBalance = await this.getStreamingBalance(sessionId, session.safeModeEnabled);

    console.log(`🟡 Bet Placed: ${marketId} | ${side} | ${Number(amount) / 1e6} USDC @ ${result.effectivePrice.toFixed(4)}`);

    return {
      success: true,
      bet,
      availableBalance: newBalance.available,
    };
  }

  /**
   * Resolve a bet with outcome
   */
  resolveBet(sessionId: Hex, betId: string, won: boolean): void {
    const bets = this.sessionBets.get(sessionId);
    if (!bets) return;

    const bet = bets.find((b) => b.id === betId);
    if (bet && !bet.resolved) {
      bet.resolved = true;
      bet.won = won;
      console.log(`🟡 Bet resolved: ${betId} - ${won ? 'WON' : 'LOST'}`);
    }
  }

  /**
   * Close a session and generate settlement signature
   */
  async closeSession(sessionId: Hex): Promise<{ success: boolean; pnl: bigint; signature: string; sessionId: Hex }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (!this.privateKey) {
      throw new Error('Service not initialized with private key');
    }

    session.status = 'closing';

    // Auto-settle any remaining positions in ACTIVE markets by force-selling them
    try {
      const activePositions = await ammRepository.getUserActivePositions(sessionId);
      if (activePositions.length > 0) {
        console.log(`🟡 Auto-selling ${activePositions.length} active positions before close`);
        const { sellPositionDB } = await import('../amm/db-pool-manager.js');
        for (const pos of activePositions) {
          const shares = BigInt(pos.shares);
          if (shares > 0n) {
            try {
              const outcome = pos.outcome === 'YES' ? Outcome.YES : Outcome.NO;
              await sellPositionDB(pos.market_id, sessionId, shares, outcome);
              console.log(`🟡 Auto-sold ${shares} ${pos.outcome} shares in ${pos.market_id}`);
            } catch (sellErr) {
              console.warn(`🟡 Failed to auto-sell position ${pos.market_id}/${pos.outcome}: ${sellErr}`);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`🟡 Failed to auto-settle positions on close:`, err);
    }

    // Calculate PnL from DB current_balance (reflects all buys, sells, claims)
    // PnL = current_balance - initial_collateral
    // This is sent to the contract for real on-chain settlement.
    // The contract holds deposits from ALL users, so losers' funds naturally pay winners.
    let pnl = BigInt(0);
    try {
      const dbSession = await ammRepository.getSession(sessionId);
      if (dbSession) {
        const currentBalance = BigInt(dbSession.current_balance);
        const initialCollateral = BigInt(dbSession.initial_collateral);
        pnl = currentBalance - initialCollateral;
        console.log(`🟡 Close PnL from DB: current=${currentBalance}, initial=${initialCollateral}, pnl=${pnl}`);
      } else {
        console.warn(`🟡 Session ${sessionId} not found in DB, falling back to 0 PnL`);
      }
    } catch (err) {
      console.error(`🟡 Failed to read DB session for PnL:`, err);
    }

    // Generate signature for contract settlement
    // Contract expects: keccak256(abi.encodePacked(sessionId, pnl))
    const messageHash = keccak256(
      encodePacked(['bytes32', 'int256'], [sessionId, pnl])
    );

    // Sign with private key
    const account = privateKeyToAccount(this.privateKey);
    const signature = await account.signMessage({ message: { raw: messageHash } });

    // Persist the latest signature and status in DB
    try {
      const dbSession = await ammRepository.getSession(sessionId);
      if (dbSession) {
        await ammRepository.updateSessionBalance(
          sessionId,
          BigInt(dbSession.current_balance),
          signature,
          dbSession.nonce + 1
        );
      }
    } catch (err) {
      console.warn(`🟡 Failed to persist settlement signature to DB:`, err);
    }

    session.status = 'closed';

    // Clean up user mapping
    this.userSessions.delete(session.user);

    console.log(`🟡 Session closed: ${sessionId}`);
    console.log(`   PnL: ${Number(pnl) / 1e6} USDC`);
    console.log(`   Signature generated for contract settlement`);

    return {
      success: true,
      pnl,
      signature,
      sessionId
    };
  }

  /**
   * Get streaming balance with yield calculation and Locked PnL
   */
  async getStreamingBalance(
    sessionId: Hex,
    safeMode: boolean
  ): Promise<{ principal: bigint; yield: bigint; openBets: bigint; available: bigint }> {
    let session = this.sessions.get(sessionId);

    // Lazy hydration from DB if missing (e.g. after restart)
    if (!session) {
      try {
        const row = await ammRepository.getSession(sessionId);
        if (row) {
          session = {
            sessionId: row.session_id as Hex,
            user: row.user_address as Address,
            collateral: BigInt(row.initial_collateral),
            rwaRateBps: (row as any).rwa_rate_bps || 520,
            initialYield: BigInt(0),
            safeModeEnabled: (row as any).safe_mode_enabled ?? true,
            createdAt: new Date(row.created_at).getTime(),
            status: row.status === 'OPEN' ? 'active' : 'closed' as any
          };
          this.sessions.set(sessionId, session);
          this.userSessions.set(session.user, sessionId);
          console.log(`[Session Balance] Hydrated session ${sessionId} from DB`);
        }
      } catch (err) {
        console.error(`[Session Balance] Failed to hydrate session ${sessionId}`, err);
      }
    }

    if (!session) {
      return { principal: BigInt(0), yield: BigInt(0), openBets: BigInt(0), available: BigInt(0) };
    }

    // 1. Calculate Accrued Yield
    const elapsedMs = Date.now() - session.createdAt;
    const elapsedSeconds = elapsedMs / 1000;
    const secondsPerYear = 365 * 24 * 60 * 60;

    // yield = principal * rate * time / (year * 10000)
    const newYieldSinceSessionStart =
      (session.collateral * BigInt(session.rwaRateBps) * BigInt(Math.floor(elapsedSeconds))) /
      BigInt(Math.floor(secondsPerYear * 10000));

    // Total Yield = Initial (Synced) + New (Local)
    const yieldAmount = (session.initialYield || BigInt(0)) + newYieldSinceSessionStart;


    // 2. Calculate Locked Amount (Used for bets)
    // Only count positions from ACTIVE markets (not resolved/cancelled)
    // Locked = Sum(Shares * AvgEntryPrice) for positions in ACTIVE markets only
    let openBetsLocked = BigInt(0);

    try {
      const positions = await ammRepository.getUserActivePositions(sessionId);

      for (const pos of positions) {
        // shares is string in DB, average_entry_price is number
        const sharesProps = BigInt(pos.shares);
        if (sharesProps > 0n) {
          // Cost Basis = Shares * AvgPrice
          // Note: Shares are in 6 decimals (USDC). Price is ratio 0-1.
          // So Cost = Shares * Price
          const cost = Number(sharesProps) * pos.average_entry_price;
          openBetsLocked += BigInt(Math.floor(cost));
        }
      }
    } catch (err) {
      console.error(`[Session Balance] Failed to fetch DB positions for ${sessionId}`, err);
      // Fallback to in-memory if DB fails (though this might be out of sync)
      const bets = this.sessionBets.get(sessionId) || [];
      openBetsLocked = bets
        .filter((b) => !b.resolved)
        .reduce((sum, b) => sum + b.amount, BigInt(0));
    }


    // 3. Calculate Available
    // Available = (Principal + Yield) - Locked
    const totalLiquidity = session.collateral + yieldAmount;
    let available = totalLiquidity - openBetsLocked;

    if (available < 0n) available = BigInt(0);

    return {
      principal: session.collateral,
      yield: yieldAmount,
      openBets: openBetsLocked,
      available,
    };
  }
}

export default YellowSessionService;
