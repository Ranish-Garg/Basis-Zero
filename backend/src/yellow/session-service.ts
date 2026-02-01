/**
 * Yellow Network Session Service
 * 
 * Integrates with Yellow's Nitrolite SDK for off-chain state channel betting sessions.
 * 
 * Flow:
 * 1. User creates channel at apps.yellow.com
 * 2. Backend connects to ClearNode via WebSocket
 * 3. User opens application session for betting
 * 4. Bets are processed off-chain with signed state updates
 * 5. Session closes with final allocations
 * 
 * @see https://erc7824.org/quick_start
 */

import { Router } from 'express';
import WebSocket from 'ws';
import {
  createAuthRequestMessage,
  createAuthVerifyMessage,
  createEIP712AuthMessageSigner,
  createAppSessionMessage,
  createCloseAppSessionMessage,
  createECDSAMessageSigner,
  parseAnyRPCResponse,
  parseAuthChallengeResponse,
  parseCreateAppSessionResponse,
  parseCloseAppSessionResponse,
  RPCMethod,
  RPCProtocolVersion,
  type MessageSigner,
} from '@erc7824/nitrolite';
import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http, type Address, type Hex } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface SessionConfig {
  sessionId: string;
  appSessionId: string;
  user: Address;
  collateral: bigint;
  rwaRateBps: number;
  safeModeEnabled: boolean;
  createdAt: number;
  status: 'pending' | 'active' | 'closing' | 'closed';
}

export interface Bet {
  id: string;
  marketId: string;
  side: 'YES' | 'NO';
  amount: bigint;
  timestamp: number;
  resolved: boolean;
  won?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEARNODE CONNECTION
// ═══════════════════════════════════════════════════════════════════════════

class ClearNodeConnection {
  private url: string;
  private ws: WebSocket | null = null;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectInterval = 3000;
  private jwtToken: string | null = null;
  private onMessageCallback: ((data: string) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  setMessageHandler(handler: (data: string) => void) {
    this.onMessageCallback = handler;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log(`🟡 Connected to ClearNode at ${this.url}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        resolve();
      };

      this.ws.onmessage = (event) => {
        if (this.onMessageCallback) {
          this.onMessageCallback(event.data.toString());
        }
      };

      this.ws.onerror = (error) => {
        console.error('ClearNode WebSocket error:', error);
        reject(error);
      };

      this.ws.onclose = (event) => {
        this.isConnected = false;
        console.log(`ClearNode WebSocket closed: ${event.code} ${event.reason}`);
        this.attemptReconnect();
      };
    });
  }

  private attemptReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Maximum ClearNode reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectInterval * Math.pow(2, this.reconnectAttempts - 1);
    console.log(`Reconnecting to ClearNode in ${delay}ms`);

    setTimeout(() => {
      this.connect().catch(console.error);
    }, delay);
  }

  send(message: string): void {
    if (!this.isConnected || !this.ws) {
      throw new Error('ClearNode not connected');
    }
    this.ws.send(message);
  }

  async sendAndWait<T>(message: string, parseResponse: (raw: string) => T, timeoutMs = 10000): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.onMessageCallback = originalHandler;
        reject(new Error('ClearNode request timeout'));
      }, timeoutMs);

      const originalHandler = this.onMessageCallback;

      this.onMessageCallback = (data: string) => {
        try {
          const response = parseResponse(data);
          clearTimeout(timeout);
          this.onMessageCallback = originalHandler;
          resolve(response);
        } catch {
          // Not the response we're looking for, try original handler
          if (originalHandler) {
            originalHandler(data);
          }
        }
      };

      this.send(message);
    });
  }

  setJwtToken(token: string) {
    this.jwtToken = token;
  }

  getJwtToken(): string | null {
    return this.jwtToken;
  }

  disconnect() {
    if (this.ws) {
      this.ws.close(1000, 'User initiated disconnect');
      this.ws = null;
    }
    this.isConnected = false;
  }

  get connected(): boolean {
    return this.isConnected;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// YELLOW SESSION SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class YellowSessionService {
  public router: Router;
  private clearNode: ClearNodeConnection;
  private sessions = new Map<string, SessionConfig>();
  private sessionBets = new Map<string, Bet[]>();
  private walletClient: ReturnType<typeof createWalletClient> | null = null;
  private signer: MessageSigner | null = null;
  private serverAddress: Address | null = null;

  constructor() {
    this.router = Router();
    this.clearNode = new ClearNodeConnection(
      process.env.YELLOW_CLEARNODE_URL || 'wss://clearnet.yellow.com/ws'
    );
    this.setupRoutes();
  }

  private setupRoutes() {
    // Initialize connection with wallet
    this.router.post('/init', async (req, res) => {
      try {
        const { privateKey } = req.body;
        await this.initialize(privateKey);
        res.json({ success: true, address: this.serverAddress });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Open a new betting session
    this.router.post('/open', async (req, res) => {
      try {
        const { userAddress, collateral, safeModeEnabled, rwaRateBps } = req.body;
        const session = await this.openSession(
          userAddress as Address,
          BigInt(collateral),
          safeModeEnabled ?? true,
          rwaRateBps ?? 520
        );
        res.json({ success: true, session: this.serializeSession(session) });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Place a bet in active session
    this.router.post('/bet', async (req, res) => {
      try {
        const { sessionId, marketId, side, amount } = req.body;
        const result = await this.placeBet(
          sessionId,
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

    // Close session with final allocations
    this.router.post('/close', async (req, res) => {
      try {
        const { sessionId } = req.body;
        const result = await this.closeSession(sessionId);
        res.json({ success: result.success, pnl: result.pnl.toString() });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Get session status
    this.router.get('/:sessionId', (req, res) => {
      const session = this.sessions.get(req.params.sessionId);
      if (!session) {
        return res.status(404).json({ error: 'Session not found' });
      }
      const bets = this.sessionBets.get(req.params.sessionId) || [];
      res.json({
        session: this.serializeSession(session),
        bets: bets.map(b => this.serializeBet(b)),
      });
    });

    // Get streaming balance
    this.router.get('/:sessionId/balance', (req, res) => {
      const { safeMode } = req.query;
      const balance = this.getStreamingBalance(
        req.params.sessionId,
        safeMode === 'true'
      );
      res.json({
        principal: balance.principal.toString(),
        yield: balance.yield.toString(),
        openBets: balance.openBets.toString(),
        available: balance.available.toString(),
      });
    });
  }

  // Serialize session for JSON response
  private serializeSession(session: SessionConfig) {
    return {
      ...session,
      collateral: session.collateral.toString(),
    };
  }

  // Serialize bet for JSON response
  private serializeBet(bet: Bet) {
    return {
      ...bet,
      amount: bet.amount.toString(),
    };
  }

  /**
   * Initialize the service with server wallet
   */
  async initialize(privateKey: Hex): Promise<void> {
    const account = privateKeyToAccount(privateKey);
    this.serverAddress = account.address;

    this.walletClient = createWalletClient({
      account,
      chain: arbitrumSepolia,
      transport: http(),
    });

    // Create ECDSA message signer for Nitrolite
    this.signer = createECDSAMessageSigner(privateKey);

    // Connect to ClearNode
    await this.clearNode.connect();

    // Authenticate with ClearNode
    await this.authenticate();

    console.log(`🟡 Yellow Session Service initialized with address: ${this.serverAddress}`);
  }

  /**
   * Authenticate with ClearNode using EIP-712
   */
  private async authenticate(): Promise<void> {
    if (!this.walletClient || !this.serverAddress) {
      throw new Error('Wallet not initialized');
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour

    // Create auth request
    const authRequest = await createAuthRequestMessage({
      address: this.serverAddress,
      session_key: this.serverAddress,
      application: 'basis-zero',
      expires_at: BigInt(expiresAt),
      scope: 'console',
      allowances: [],
    });

    // Set up message handler for auth flow
    this.clearNode.setMessageHandler(async (data: string) => {
      try {
        const response = parseAnyRPCResponse(data);

        if (response.method === RPCMethod.AuthChallenge) {
          const challenge = parseAuthChallengeResponse(data);
          
          // Create EIP-712 signer for auth
          const eip712Signer = createEIP712AuthMessageSigner(
            this.walletClient!,
            {
              scope: 'console',
              session_key: this.serverAddress!,
              expires_at: BigInt(expiresAt),
              allowances: [],
            },
            { name: 'Basis-Zero' }
          );

          // Create and send auth verify
          const authVerify = await createAuthVerifyMessage(eip712Signer, challenge);
          this.clearNode.send(authVerify);
        }

        if (response.method === RPCMethod.AuthVerify) {
          const params = response.params as { success?: boolean; jwt_token?: string };
          if (params.success && params.jwt_token) {
            this.clearNode.setJwtToken(params.jwt_token);
            console.log('🟡 ClearNode authentication successful');
          } else {
            console.error('ClearNode authentication failed');
          }
        }
      } catch (error) {
        console.error('Auth message handling error:', error);
      }
    });

    // Send initial auth request
    this.clearNode.send(authRequest);
  }

  /**
   * Open a new betting session
   */
  async openSession(
    userAddress: Address,
    collateral: bigint,
    safeModeEnabled: boolean,
    rwaRateBps: number
  ): Promise<SessionConfig> {
    if (!this.signer || !this.serverAddress) {
      throw new Error('Service not initialized');
    }

    const sessionId = `session_${Date.now()}_${userAddress.slice(2, 10)}`;

    // Create app session message
    const signedMessage = await createAppSessionMessage(this.signer, {
      definition: {
        application: 'basis-zero',
        protocol: RPCProtocolVersion.NitroRPC_0_2,
        participants: [userAddress, this.serverAddress],
        weights: [100, 0],
        quorum: 100,
        challenge: 0,
        nonce: Date.now(),
      },
      allocations: [
        {
          participant: userAddress,
          asset: 'usdc',
          amount: collateral.toString(),
        },
        {
          participant: this.serverAddress,
          asset: 'usdc',
          amount: '0',
        },
      ],
    });

    // Send and wait for response
    const response = await this.clearNode.sendAndWait(
      signedMessage,
      parseCreateAppSessionResponse
    );

    const appSessionId = response.params?.appSessionId || `app_${Date.now()}`;

    const session: SessionConfig = {
      sessionId,
      appSessionId: appSessionId as string,
      user: userAddress,
      collateral,
      rwaRateBps,
      safeModeEnabled,
      createdAt: Date.now(),
      status: 'active',
    };

    this.sessions.set(sessionId, session);
    this.sessionBets.set(sessionId, []);

    console.log(`🟡 Session opened: ${sessionId} (app: ${appSessionId})`);

    return session;
  }

  /**
   * Place a bet in an active session
   */
  async placeBet(
    sessionId: string,
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

    // Calculate available balance
    const balance = this.getStreamingBalance(sessionId, session.safeModeEnabled);
    if (amount > balance.available) {
      throw new Error(`Insufficient balance. Available: ${balance.available}, Requested: ${amount}`);
    }

    // Create bet
    const bet: Bet = {
      id: `bet_${Date.now()}`,
      marketId,
      side,
      amount,
      timestamp: Date.now(),
      resolved: false,
    };

    // Add to session bets
    const bets = this.sessionBets.get(sessionId) || [];
    bets.push(bet);
    this.sessionBets.set(sessionId, bets);

    // Note: In production, this would submit an app state update to ClearNode
    // using createSubmitAppStateMessage

    const newBalance = this.getStreamingBalance(sessionId, session.safeModeEnabled);

    console.log(`🟡 Bet placed: ${bet.id} on ${marketId} (${side}) for ${amount}`);

    return {
      success: true,
      bet,
      availableBalance: newBalance.available,
    };
  }

  /**
   * Resolve a bet with outcome
   */
  resolveBet(sessionId: string, betId: string, won: boolean): void {
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
   * Close a session and finalize allocations
   */
  async closeSession(sessionId: string): Promise<{ success: boolean; pnl: bigint }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    if (!this.signer || !this.serverAddress) {
      throw new Error('Service not initialized');
    }

    session.status = 'closing';

    // Calculate final PnL
    const bets = this.sessionBets.get(sessionId) || [];
    let pnl = BigInt(0);

    for (const bet of bets) {
      if (bet.resolved) {
        if (bet.won) {
          pnl += bet.amount;
        } else {
          pnl -= bet.amount;
        }
      }
    }

    // Calculate final balances
    const finalUserBalance = session.collateral + pnl;
    const finalServerBalance = pnl > 0 ? BigInt(0) : -pnl;

    // Create close session message
    const signedMessage = await createCloseAppSessionMessage(this.signer, {
      app_session_id: session.appSessionId as Hex,
      allocations: [
        {
          participant: session.user,
          asset: 'usdc',
          amount: finalUserBalance.toString(),
        },
        {
          participant: this.serverAddress,
          asset: 'usdc',
          amount: finalServerBalance.toString(),
        },
      ],
    });

    // Send and wait for response
    await this.clearNode.sendAndWait(signedMessage, parseCloseAppSessionResponse);

    session.status = 'closed';
    console.log(`🟡 Session closed: ${sessionId} with PnL: ${pnl}`);

    return { success: true, pnl };
  }

  /**
   * Get streaming balance with yield calculation
   */
  getStreamingBalance(
    sessionId: string,
    safeMode: boolean
  ): { principal: bigint; yield: bigint; openBets: bigint; available: bigint } {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return { principal: BigInt(0), yield: BigInt(0), openBets: BigInt(0), available: BigInt(0) };
    }

    const bets = this.sessionBets.get(sessionId) || [];
    const openBets = bets
      .filter((b) => !b.resolved)
      .reduce((sum, b) => sum + b.amount, BigInt(0));

    // Calculate accrued yield
    const elapsedMs = Date.now() - session.createdAt;
    const elapsedSeconds = elapsedMs / 1000;
    const secondsPerYear = 365 * 24 * 60 * 60;

    // yield = principal * rate * time / (year * 10000)
    const yieldAmount =
      (session.collateral * BigInt(session.rwaRateBps) * BigInt(Math.floor(elapsedSeconds))) /
      BigInt(Math.floor(secondsPerYear * 10000));

    let available: bigint;
    if (safeMode) {
      // Safe Mode: only yield available for betting
      available = yieldAmount > openBets ? yieldAmount - openBets : BigInt(0);
    } else {
      // Full Mode: principal + yield - openBets
      const total = session.collateral + yieldAmount;
      available = total > openBets ? total - openBets : BigInt(0);
    }

    return {
      principal: session.collateral,
      yield: yieldAmount,
      openBets,
      available,
    };
  }
}

export default YellowSessionService;
