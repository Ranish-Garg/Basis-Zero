/**
 * Bridge Service for Basis-Zero
 * 
 * Handles CCTP bridging for:
 * 1. Cross-chain deposits → Arc vault
 * 2. Session bridging → Arc to Polygon
 * 3. Settlement returns → Polygon to Arc
 */

import type { Address, Hex, PublicClient, WalletClient } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';
import { createPublicClient, createWalletClient, http, getContract } from 'viem';
import { polygonAmoy } from 'viem/chains';

import { GatewayClient, type TransferResponse } from './gateway-client';
import { GatewayService, type TransferResult } from './gateway-service';
import { CctpService } from './cctp-service';
import { burnIntent, burnIntentTypedData } from './typed-data';
import { setupAllChains, type ChainConfigs } from './setup';
import { DOMAINS, RPC_URLS_TESTNET, USDC_ADDRESSES_TESTNET, GATEWAY_MINTER_ADDRESS, ARC_VAULT_ADDRESS } from './config';
import { erc20Abi } from 'viem';

// ABI for Arc Yield Vault (minimal)
const arcVaultAbi = [
  {
    name: 'deposit',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
] as const;

// ABI for Gateway Minter
const gatewayMinterAbi = [
  {
    name: 'gatewayMint',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'attestation', type: 'bytes' },
      { name: 'signature', type: 'bytes' },
    ],
    outputs: [],
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BridgeResult {
  sourceTxHash?: Hex;
  attestation: string;
  destinationTxHash: Hex;
}

export interface DepositToArcResult {
  approvalHash: Hex;
  depositHash: Hex;
  bridgeResult?: BridgeResult;
}

export interface SessionBridgeResult {
  bridgeResult: BridgeResult;
  escrowFundHash: Hex;
}

export interface SettlementBridgeResult {
  bridgeResult: BridgeResult;
  amount: bigint;
  pnl: bigint;
}

// ═══════════════════════════════════════════════════════════════════════════
// BRIDGE SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class BridgeService {
  private account: PrivateKeyAccount;
  private gatewayClient: GatewayClient;
  private gatewayService: GatewayService;
  private cctpService: CctpService;
  private chains: ChainConfigs;
  
  // Polygon Amoy clients (for session escrow operations)
  private polygonPublic: PublicClient;
  private polygonWallet: WalletClient;
  private polygonUsdc: ReturnType<typeof getContract>;
  private polygonMinter: ReturnType<typeof getContract>;

  constructor(account: PrivateKeyAccount, network: 'testnet' | 'mainnet' = 'testnet') {
    this.account = account;
    this.gatewayClient = new GatewayClient(network);
    this.gatewayService = new GatewayService(account, network);
    this.cctpService = new CctpService(account);
    this.chains = setupAllChains(account);

    // Setup Polygon Amoy clients
    this.polygonPublic = createPublicClient({
      chain: polygonAmoy,
      transport: http(RPC_URLS_TESTNET.polygonAmoy),
    });
    
    this.polygonWallet = createWalletClient({
      account,
      chain: polygonAmoy,
      transport: http(RPC_URLS_TESTNET.polygonAmoy),
    });

    this.polygonUsdc = getContract({
      address: USDC_ADDRESSES_TESTNET.polygonAmoy as Address,
      abi: erc20Abi,
      client: { public: this.polygonPublic, wallet: this.polygonWallet },
    });

    this.polygonMinter = getContract({
      address: GATEWAY_MINTER_ADDRESS,
      abi: gatewayMinterAbi,
      client: { public: this.polygonPublic, wallet: this.polygonWallet },
    });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOW 1: Cross-chain Deposit to Arc
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Deposit USDC from any supported chain to Arc vault
   * @param sourceChain - Source chain name (sepolia, baseSepolia, etc.)
   * @param amount - Amount in USDC (human-readable, e.g., 10 for 10 USDC)
   */
  async depositToArc(
    sourceChain: keyof ChainConfigs,
    amount: number
  ): Promise<DepositToArcResult> {
    console.log(`[Bridge] Depositing ${amount} USDC from ${sourceChain} to Arc...`);
    const amountBigInt = BigInt(amount * 1e6);

    // If source is already Arc, just deposit directly
    if (sourceChain === 'arc' || sourceChain === 'arcTestnet') {
      console.log(`[Bridge] Source is Arc, executing direct deposit...`);
      const depositHash = await this.autoDepositToVault(amountBigInt);
      return {
        approvalHash: '0x', // integrated
        depositHash: depositHash,
      };
    }

    // Step 1: Bridge from source to Arc via Direct CCTP
    // We bridge to our own address first
    const cctpResult = await this.cctpService.bridgeUSDC(
      sourceChain as any, // Type assertion for now
      'arcTestnet',
      amountBigInt,
      this.account.address
    );
    console.log(`[Bridge] Bridged to Arc: ${cctpResult.mintTx}`);

    // Step 2: Auto-deposit into Vault
    console.log(`[Bridge] Auto-depositing to Arc Vault...`);
    const vaultDepositHash = await this.autoDepositToVault(amountBigInt);
    console.log(`[Bridge] Vault deposit execution: ${vaultDepositHash}`);

    return {
      approvalHash: cctpResult.burnTx, // reusing field for source tx
      depositHash: vaultDepositHash,
      bridgeResult: {
        sourceTxHash: cctpResult.burnTx,
        attestation: cctpResult.attestation,
        destinationTxHash: cctpResult.mintTx,
      },
    };
  }

  /**
   * Auto-deposit USDC into Arc Yield Vault
   */
  private async autoDepositToVault(amount: bigint): Promise<Hex> {
    const arcChain = this.chains['arcTestnet'];
    if (!arcChain) throw new Error('Arc chain config missing');

    const vault = getContract({
      address: ARC_VAULT_ADDRESS,
      abi: arcVaultAbi,
      client: { public: arcChain.publicClient, wallet: arcChain.walletClient }
    });

    // Approve Vault
    const usdc = getContract({
      address: arcChain.usdcAddress,
      abi: erc20Abi,
      client: { public: arcChain.publicClient, wallet: arcChain.walletClient }
    });

    console.log(`[AutoDeposit] Approving Vault...`);
    const approveTx = await usdc.write.approve(
      [ARC_VAULT_ADDRESS, amount],
      { account: this.account, chain: arcChain.chain }
    );
    await arcChain.publicClient.waitForTransactionReceipt({ hash: approveTx });

    // Deposit
    console.log(`[AutoDeposit] Depositing to Vault...`);
    const depositTx = await vault.write.deposit(
      [amount],
      { account: this.account, chain: arcChain.chain }
    );
    await arcChain.publicClient.waitForTransactionReceipt({ hash: depositTx });

    return depositTx;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOW 2: Session Bridge (Arc → Polygon)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Bridge yield from Arc to Polygon SessionEscrow
   * @param amount - Amount in atomic units (6 decimals)
   * @param sessionId - Session identifier
   * @param sessionEscrowAddress - SessionEscrow contract on Polygon
   */
  async bridgeToSession(
    amount: bigint,
    sessionId: Hex,
    user: Address,
    sessionEscrowAddress: Address
  ): Promise<SessionBridgeResult> {
    const amountHuman = Number(amount) / 1e6;
    console.log(`[Bridge] Bridging ${amountHuman} USDC from Arc to Polygon via CCTP for session ${sessionId}...`);

    // Step 1: Transfer from Arc to Polygon via direct CCTP
    // We transfer to our own address first, then fund escrow
    const cctpResult = await this.cctpService.bridgeUSDC(
      'arcTestnet',
      'polygonAmoy',
      amount,
      this.account.address
    );
    console.log(`[Bridge] Bridged to Polygon: ${cctpResult.mintTx}`);

    // Step 2: Fund escrow with bridged USDC
    const escrowFundHash = await this.fundSessionEscrow(
      amount,
      sessionId,
      user,
      sessionEscrowAddress
    );
    console.log(`[Bridge] Funded escrow: ${escrowFundHash}`);

    return {
      bridgeResult: {
        sourceTxHash: cctpResult.burnTx,
        attestation: cctpResult.attestation,
        destinationTxHash: cctpResult.mintTx,
      },
      escrowFundHash,
    };
  }

  /**
   * Fund SessionEscrow contract on Polygon
   */
  private async fundSessionEscrow(
    amount: bigint,
    sessionId: Hex,
    user: Address,
    sessionEscrowAddress: Address
  ): Promise<Hex> {
    // Approve USDC for escrow
    const approveTx = await (this.polygonUsdc as any).write.approve(
      [sessionEscrowAddress, amount],
      { account: this.account, chain: polygonAmoy }
    ) as Hex;
    await this.polygonPublic.waitForTransactionReceipt({ hash: approveTx });
    console.log(`[Bridge] Approved USDC for escrow`);

    // Call receiveEscrow on SessionEscrow
    // We need to use walletClient directly since we don't have the escrow contract instance
    const fundTx = await this.polygonWallet.writeContract({
      address: sessionEscrowAddress,
      abi: [{
        name: 'receiveEscrow',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [
          { name: 'user', type: 'address' },
          { name: 'sessionId', type: 'bytes32' },
          { name: 'amount', type: 'uint256' },
        ],
        outputs: [],
      }],
      functionName: 'receiveEscrow',
      args: [user, sessionId, amount],
      account: this.account,
      chain: polygonAmoy,
    }) as Hex;
    await this.polygonPublic.waitForTransactionReceipt({ hash: fundTx });

    return fundTx;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FLOW 3: Settlement Bridge (Polygon → Arc)
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Bridge settlement funds from Polygon back to Arc
   * @param amount - Amount to bridge (after PnL applied)
   * @param pnl - Profit/loss from session
   */
  async bridgeSettlement(
    amount: bigint,
    pnl: bigint
  ): Promise<SettlementBridgeResult> {
    const amountHuman = Number(amount) / 1e6;
    console.log(`[Bridge] Bridging ${amountHuman} USDC settlement from Polygon to Arc via CCTP...`);
    console.log(`[Bridge] PnL: ${Number(pnl) / 1e6} USDC`);

    // Direct CCTP transfer from Polygon to Arc
    const cctpResult = await this.cctpService.bridgeUSDC(
      'polygonAmoy',
      'arcTestnet',
      amount,
      this.account.address
    );
    
    console.log(`[Bridge] Bridged to Arc: ${cctpResult.mintTx}`);

    return {
      bridgeResult: {
        sourceTxHash: cctpResult.burnTx,
        attestation: cctpResult.attestation,
        destinationTxHash: cctpResult.mintTx
      },
      amount,
      pnl,
    };
  }



  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITY
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get unified balance across chains
   */
  async getBalances() {
    return this.gatewayService.getBalance();
  }
}

// Factory function
export function createBridgeService(privateKey: Hex): BridgeService {
  const { privateKeyToAccount } = require('viem/accounts');
  const account = privateKeyToAccount(privateKey);
  return new BridgeService(account, 'testnet');
}
