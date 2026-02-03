/**
 * Session Orchestrator
 * 
 * Manages the full lifecycle of Yellow betting sessions across Arc and Polygon.
 * 
 * Flow:
 * 1. startSession() - Lock yield on ArcYieldVault
 * 2. bridgeSessionAllowance() - Bridge USDC from Arc → Polygon via Gateway
 * 3. fundEscrow() - Deposit into SessionEscrow on Polygon
 * 4. confirmBridge() - Update Arc state to Active
 * 5. [Yellow Nitrolite session runs off-chain]
 * 6. reconcile() - Relay settlement proof back to Arc
 * 
 * The orchestrator is NOT a trusted authority - it's just a relay.
 * All critical actions require cryptographic proofs verified on-chain.
 */

import { Router } from 'express';
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
  type GetContractReturnType,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';

import { CctpService, arcTestnet } from '../circle/cctp';

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT ABIs (minimal for orchestration)
// ═══════════════════════════════════════════════════════════════════════════

const arcYieldVaultAbi = [
  {
    name: 'lockSessionAllowance',
    type: 'function',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'sessionId', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'confirmBridge',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'reconcileSession',
    type: 'function',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'pnl', type: 'int256' },
      { name: 'settlementProof', type: 'bytes' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'cancelTimedOutSession',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getSession',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [
      { name: 'state', type: 'uint8' },
      { name: 'lockedAmount', type: 'uint256' },
      { name: 'startedAt', type: 'uint256' },
      { name: 'sessionId', type: 'bytes32' },
      { name: 'timeUntilTimeout', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
  {
    name: 'getAvailableYieldForSession',
    type: 'function',
    inputs: [{ name: 'user', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
] as const;

const sessionEscrowAbi = [
  {
    name: 'receiveEscrow',
    type: 'function',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'sessionId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'activateSession',
    type: 'function',
    inputs: [{ name: 'sessionId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    name: 'settleSession',
    type: 'function',
    inputs: [
      { name: 'sessionId', type: 'bytes32' },
      { name: 'pnl', type: 'int256' },
      { name: 'signatures', type: 'bytes[]' },
    ],
    outputs: [{ name: 'settlementProof', type: 'bytes' }],
    stateMutability: 'nonpayable',
  },
  {
    name: 'getEscrow',
    type: 'function',
    inputs: [{ name: 'sessionId', type: 'bytes32' }],
    outputs: [
      { name: 'state', type: 'uint8' },
      { name: 'amount', type: 'uint256' },
      { name: 'user', type: 'address' },
      { name: 'fundedAt', type: 'uint256' },
      { name: 'timeUntilTimeout', type: 'uint256' },
    ],
    stateMutability: 'view',
  },
] as const;

const erc20Abi = [
  {
    name: 'approve',
    type: 'function',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export enum SessionPhase {
  None = 0,
  PendingBridge = 1,
  Active = 2,
  Settled = 3,
  Cancelled = 4,
}

export interface SessionInfo {
  sessionId: Hex;
  user: Address;
  phase: SessionPhase;
  lockedAmount: bigint;
  startedAt: number;
  timeUntilTimeout: number;
}

export interface SessionConfig {
  arcVaultAddress: Address;
  sessionEscrowAddress: Address;
  polygonUsdcAddress: Address;
  arcRpcUrl: string;
  polygonRpcUrl: string;
}

type ArcVaultContract = GetContractReturnType<typeof arcYieldVaultAbi, { public: PublicClient; wallet: WalletClient }>;
type SessionEscrowContract = GetContractReturnType<typeof sessionEscrowAbi, { public: PublicClient; wallet: WalletClient }>;
type Erc20Contract = GetContractReturnType<typeof erc20Abi, { public: PublicClient; wallet: WalletClient }>;

// ═══════════════════════════════════════════════════════════════════════════
// SESSION ORCHESTRATOR
// ═══════════════════════════════════════════════════════════════════════════

export class SessionOrchestrator {
  public router: Router;

  private account: PrivateKeyAccount;
  private config: SessionConfig;
  private cctpService: CctpService;

  // Arc clients
  private arcPublic: PublicClient;
  private arcWallet: WalletClient;
  private arcVault: ArcVaultContract;

  // Polygon clients
  private polygonPublic: PublicClient;
  private polygonWallet: WalletClient;
  private sessionEscrow: SessionEscrowContract;
  private polygonUsdc: Erc20Contract;

  constructor(
    account: PrivateKeyAccount,
    config: SessionConfig
  ) {
    this.account = account;
    this.config = config;
    this.cctpService = new CctpService(account);
    this.router = Router();

    // Setup Arc clients
    this.arcPublic = createPublicClient({
      chain: arcTestnet,
      transport: http(config.arcRpcUrl),
    });

    this.arcWallet = createWalletClient({
      account,
      chain: arcTestnet,
      transport: http(config.arcRpcUrl),
    });

    this.arcVault = getContract({
      address: config.arcVaultAddress,
      abi: arcYieldVaultAbi,
      client: { public: this.arcPublic, wallet: this.arcWallet },
    });

    // Setup Polygon clients
    this.polygonPublic = createPublicClient({
      chain: polygonAmoy,
      transport: http(config.polygonRpcUrl),
    });

    this.polygonWallet = createWalletClient({
      account,
      chain: polygonAmoy,
      transport: http(config.polygonRpcUrl),
    });

    this.sessionEscrow = getContract({
      address: config.sessionEscrowAddress,
      abi: sessionEscrowAbi,
      client: { public: this.polygonPublic, wallet: this.polygonWallet },
    });

    this.polygonUsdc = getContract({
      address: config.polygonUsdcAddress,
      abi: erc20Abi,
      client: { public: this.polygonPublic, wallet: this.polygonWallet },
    });

    this.setupRoutes();
  }


  private setupRoutes() {
    // Get session info
    this.router.get('/session/:user', async (req, res) => {
      try {
        const session = await this.getSession(req.params.user as Address);
        res.json({ success: true, session });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Start a new session
    this.router.post('/session/start', async (req, res) => {
      try {
        const { user, amount } = req.body;
        const result = await this.startSession(user, BigInt(amount));
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Execute full session flow (for demo)
    this.router.post('/session/full-flow', async (req, res) => {
      try {
        const { user, amount } = req.body;
        const result = await this.executeFullSessionFlow(user, BigInt(amount));
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Cancel timed-out session
    this.router.post('/session/cancel', async (req, res) => {
      try {
        const { user } = req.body;
        const txHash = await this.cancelTimedOutSession(user);
        res.json({ success: true, txHash });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION LIFECYCLE
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get current session info for a user
   */
  async getSession(user: Address): Promise<SessionInfo> {
    const [state, lockedAmount, startedAt, sessionId, timeUntilTimeout] =
      await this.arcVault.read.getSession([user]) as [number, bigint, bigint, Hex, bigint];

    return {
      sessionId,
      user,
      phase: state as SessionPhase,
      lockedAmount: lockedAmount.toString() as unknown as bigint, // Convert for JSON
      startedAt: Number(startedAt),
      timeUntilTimeout: Number(timeUntilTimeout),
    };
  }

  /**
   * Get available yield for session
   */
  async getAvailableYield(user: Address): Promise<bigint> {
    return await this.arcVault.read.getAvailableYieldForSession([user]) as bigint;
  }

  /**
   * Step 1: Lock yield on Arc and generate session ID
   */
  async startSession(
    user: Address,
    amount: bigint
  ): Promise<{ sessionId: Hex; lockTxHash: Hex }> {
    console.log(`[Session] Starting session for ${user}, amount: ${amount}`);

    // Generate unique session ID
    const sessionId = this.generateSessionId(user);

    // Lock yield on Arc
    // Note: In production, user would call this directly with their wallet
    // For demo, relayer has permission
    const lockTxHash = await this.arcVault.write.lockSessionAllowance(
      [amount, sessionId],
      { account: this.account, chain: null }
    ) as Hex;

    await this.arcPublic.waitForTransactionReceipt({ hash: lockTxHash });
    console.log(`[Session] Yield locked: ${lockTxHash}`);

    return { sessionId, lockTxHash };
  }

  /**
   * Step 2: Bridge session allowance from Arc to Polygon via CCTP
   */
  async bridgeSessionAllowance(
    amount: bigint,
    sessionId: Hex,
    user: Address
  ): Promise<{ bridgeTxHash: Hex; escrowFundHash: Hex }> {
    console.log(`[Session] Bridging ${amount} USDC from Arc to Polygon via CCTP...`);

    // Use CCTP service for actual transfer
    const result = await this.cctpService.bridgeUSDC(
      'arcTestnet',
      'polygonAmoy',
      amount,
      this.config.sessionEscrowAddress
    );

    console.log(`[Session] Bridge complete: ${result.mintTx}`);

    // Fund escrow with bridged funds
    const { fundTxHash } = await this.fundEscrow(user, sessionId, amount);

    return {
      bridgeTxHash: result.mintTx,
      escrowFundHash: fundTxHash
    };
  }

  /**
   * Step 3: Fund escrow on Polygon
   */
  async fundEscrow(
    user: Address,
    sessionId: Hex,
    amount: bigint
  ): Promise<{ approveTxHash: Hex; fundTxHash: Hex }> {
    console.log(`[Session] Funding escrow for session ${sessionId}...`);

    // Approve USDC for escrow contract
    const approveTxHash = await this.polygonUsdc.write.approve(
      [this.config.sessionEscrowAddress, amount],
      { account: this.account, chain: null }
    ) as Hex;
    await this.polygonPublic.waitForTransactionReceipt({ hash: approveTxHash });

    // Fund escrow
    const fundTxHash = await this.sessionEscrow.write.receiveEscrow(
      [user, sessionId, amount],
      { account: this.account, chain: null }
    ) as Hex;
    await this.polygonPublic.waitForTransactionReceipt({ hash: fundTxHash });

    console.log(`[Session] Escrow funded: ${fundTxHash}`);
    return { approveTxHash, fundTxHash };
  }

  /**
   * Step 4: Confirm bridge on Arc (transition to Active)
   */
  async confirmBridge(user: Address): Promise<{ confirmTxHash: Hex }> {
    console.log(`[Session] Confirming bridge for ${user}...`);

    const confirmTxHash = await this.arcVault.write.confirmBridge(
      [user],
      { account: this.account, chain: null }
    ) as Hex;
    await this.arcPublic.waitForTransactionReceipt({ hash: confirmTxHash });

    console.log(`[Session] Bridge confirmed: ${confirmTxHash}`);
    return { confirmTxHash };
  }

  /**
   * Step 5: Activate session on Polygon (Yellow can now run)
   */
  async activateSession(sessionId: Hex): Promise<{ activateTxHash: Hex }> {
    console.log(`[Session] Activating session ${sessionId}...`);

    const activateTxHash = await this.sessionEscrow.write.activateSession(
      [sessionId],
      { account: this.account, chain: null }
    ) as Hex;
    await this.polygonPublic.waitForTransactionReceipt({ hash: activateTxHash });

    console.log(`[Session] Session activated: ${activateTxHash}`);
    return { activateTxHash };
  }

  /**
   * Step 6: Settle session on Polygon (after Yellow session ends)
   */
  async settleOnPolygon(
    sessionId: Hex,
    pnl: bigint,
    signatures: Hex[]
  ): Promise<{ settleTxHash: Hex; settlementProof: Hex }> {
    console.log(`[Session] Settling session ${sessionId}, PnL: ${pnl}...`);

    // For demo: we'd get signatures from Yellow Nitrolite
    // Here we simulate with the relayer's signature
    const settleTxHash = await this.sessionEscrow.write.settleSession(
      [sessionId, pnl, signatures],
      { account: this.account, chain: null }
    ) as Hex;

    const receipt = await this.polygonPublic.waitForTransactionReceipt({
      hash: settleTxHash
    });

    // Extract settlement proof from event logs (simplified)
    // In production, parse the SessionSettled event
    const settlementProof = '0x' as Hex; // Placeholder

    console.log(`[Session] Settled on Polygon: ${settleTxHash}`);
    return { settleTxHash, settlementProof };
  }

  /**
   * Step 7: Reconcile on Arc (relay settlement proof)
   */
  async reconcileOnArc(
    user: Address,
    pnl: bigint,
    settlementProof: Hex
  ): Promise<{ reconcileTxHash: Hex }> {
    console.log(`[Session] Reconciling on Arc for ${user}, PnL: ${pnl}...`);

    const reconcileTxHash = await this.arcVault.write.reconcileSession(
      [user, pnl, settlementProof],
      { account: this.account, chain: null }
    ) as Hex;
    await this.arcPublic.waitForTransactionReceipt({ hash: reconcileTxHash });

    console.log(`[Session] Reconciled on Arc: ${reconcileTxHash}`);
    return { reconcileTxHash };
  }

  /**
   * Cancel a timed-out session
   */
  async cancelTimedOutSession(user: Address): Promise<Hex> {
    console.log(`[Session] Cancelling timed-out session for ${user}...`);

    const cancelTxHash = await this.arcVault.write.cancelTimedOutSession(
      [user],
      { account: this.account, chain: null }
    ) as Hex;
    await this.arcPublic.waitForTransactionReceipt({ hash: cancelTxHash });

    console.log(`[Session] Session cancelled: ${cancelTxHash}`);
    return cancelTxHash;
  }

  /**
   * Execute full session flow with CCTP bridging (for demo purposes)
   * In production, these would be triggered by user actions + Yellow events
   */
  async executeFullSessionFlow(
    user: Address,
    amount: bigint
  ): Promise<{
    sessionId: Hex;
    lockTxHash: Hex;
    bridgeTxHash: Hex;
    escrowFundHash: Hex;
    confirmTxHash: Hex;
    activateTxHash: Hex;
  }> {
    // Step 1: Start session (lock yield)
    const { sessionId, lockTxHash } = await this.startSession(user, amount);
    console.log(`[FullFlow] Step 1 complete: Session started`);

    // Step 2-3: Bridge via CCTP and fund escrow (now using actual CCTP!)
    const { bridgeTxHash, escrowFundHash } = await this.bridgeSessionAllowance(
      amount,
      sessionId,
      user
    );
    console.log(`[FullFlow] Step 2-3 complete: Bridged via CCTP and funded escrow`);

    // Step 4: Confirm bridge on Arc
    const { confirmTxHash } = await this.confirmBridge(user);
    console.log(`[FullFlow] Step 4 complete: Bridge confirmed on Arc`);

    // Step 5: Activate session on Polygon
    const { activateTxHash } = await this.activateSession(sessionId);
    console.log(`[FullFlow] Step 5 complete: Session activated on Polygon`);

    // At this point, Yellow Nitrolite takes over for off-chain betting
    // Settlement happens later via settleOnPolygon() + reconcileOnArc()

    return {
      sessionId,
      lockTxHash,
      bridgeTxHash,
      escrowFundHash,
      confirmTxHash,
      activateTxHash,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  private generateSessionId(user: Address): Hex {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const data = `${user}-${timestamp}-${random}`;

    // Simple hash (in production, use proper keccak256)
    let hash = 0n;
    for (let i = 0; i < data.length; i++) {
      hash = (hash * 31n + BigInt(data.charCodeAt(i))) % (2n ** 256n);
    }

    return ('0x' + hash.toString(16).padStart(64, '0')) as Hex;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════

export function createSessionOrchestrator(
  config?: Partial<SessionConfig>
): SessionOrchestrator {
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  const account = privateKeyToAccount(
    (privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`) as `0x${string}`
  );

  const fullConfig: SessionConfig = {
    arcVaultAddress: (process.env.ARC_VAULT_ADDRESS || '0x') as Address,
    sessionEscrowAddress: (process.env.SESSION_ESCROW_ADDRESS || '0x') as Address,
    polygonUsdcAddress: (process.env.POLYGON_USDC_ADDRESS || '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359') as Address,
    arcRpcUrl: process.env.ARC_RPC_URL || 'https://arc-testnet.drpc.org',
    polygonRpcUrl: process.env.POLYGON_AMOY_RPC_URL || 'https://rpc-amoy.polygon.technology',
    ...config,
  };

  return new SessionOrchestrator(account, fullConfig);
}
