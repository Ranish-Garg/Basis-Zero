/**
 * Circle Gateway Service
 * 
 * High-level service for cross-chain USDC transfers using Circle Gateway.
 * 
 * Flow:
 * 1. User deposits USDC into Gateway wallet on source chain
 * 2. User signs burn intent to transfer to destination
 * 3. Gateway API returns attestation
 * 4. Execute mint on destination chain
 * 
 * @see https://developers.circle.com/gateway
 */

import { Router } from 'express';
import type { Address, Hex } from 'viem';
import type { PrivateKeyAccount } from 'viem/accounts';

import { GatewayClient, type TransferResponse } from './gateway-client';
import { burnIntent, burnIntentTypedData } from './typed-data';
import { getAccount, setupAllChains, type ChainConfig, type ChainConfigs } from './setup';
import { CHAIN_NAMES, GATEWAY_WALLET_ADDRESS } from './config';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface BalanceInfo {
  chain: string;
  domain: number;
  balance: string;
}

export interface DepositResult {
  approvalHash: Hex;
  depositHash: Hex;
}

export interface TransferResult {
  attestation: string;
  mintHash: Hex;
  recipient: Address;
}

// ═══════════════════════════════════════════════════════════════════════════
// GATEWAY SERVICE
// ═══════════════════════════════════════════════════════════════════════════

export class GatewayService {
  public router: Router;
  private account: PrivateKeyAccount;
  private client: GatewayClient;
  private chains: ChainConfigs;

  /**
   * Create a new GatewayService
   * @param account - viem account object
   * @param network - "testnet" or "mainnet"
   */
  constructor(account: PrivateKeyAccount, network: 'testnet' | 'mainnet' = 'testnet') {
    this.account = account;
    this.client = new GatewayClient(network);
    this.chains = setupAllChains(account);
    this.router = Router();
    this.setupRoutes();
  }

  private setupRoutes() {
    // Get unified balance
    this.router.get('/balance', async (_req, res) => {
      try {
        const balances = await this.getBalance();
        res.json({ success: true, balances });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Deposit USDC
    this.router.post('/deposit', async (req, res) => {
      try {
        const { chain, amount } = req.body;
        const result = await this.deposit(chain, Number(amount));
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Transfer USDC cross-chain
    this.router.post('/transfer', async (req, res) => {
      try {
        const { fromChain, toChain, amount, recipient } = req.body;
        const result = await this.transfer(fromChain, toChain, Number(amount), recipient);
        res.json({ success: true, ...result });
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });

    // Get Gateway info
    this.router.get('/info', async (_req, res) => {
      try {
        const info = await this.client.info();
        res.json(info);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    });
  }

  /**
   * Get the user's unified balance across all chains
   */
  async getBalance(): Promise<BalanceInfo[]> {
    const { balances } = await this.client.balances('USDC', this.account.address);
    return balances.map((b) => ({
      chain: CHAIN_NAMES[b.domain] || `Domain ${b.domain}`,
      domain: b.domain,
      balance: b.balance,
    }));
  }

  /**
   * Deposit USDC into Gateway on a specific chain
   * @param chainName - Chain to deposit on (e.g., "ethereum", "base", "avalanche")
   * @param amount - Amount in USDC (human-readable)
   */
  async deposit(chainName: keyof ChainConfigs, amount: number): Promise<DepositResult> {
    const chain = this.chains[chainName];
    if (!chain) {
      throw new Error(`Unknown chain: ${chainName}. Use "ethereum", "base", "avalanche", or "arc"`);
    }

    const amountAtomic = BigInt(Math.floor(amount * 1e6));

    // Check balance
    const balance = await chain.usdc.read.balanceOf([this.account.address]);
    if (balance < amountAtomic) {
      throw new Error(
        `Insufficient USDC balance on ${chain.name}. ` +
          `Have: ${Number(balance) / 1e6} USDC, Need: ${amount} USDC`
      );
    }

    // Approve
    console.log(`Approving ${amount} USDC for GatewayWallet on ${chain.name}...`);
    const approvalHash = await chain.usdc.write.approve(
      [GATEWAY_WALLET_ADDRESS, amountAtomic],
      { account: this.account, chain: null }
    ) as Hex;
    await chain.publicClient.waitForTransactionReceipt({ hash: approvalHash });
    console.log(`Approval confirmed: ${approvalHash}`);

    // Deposit
    console.log(`Depositing ${amount} USDC into GatewayWallet on ${chain.name}...`);
    const depositHash = await chain.gatewayWallet.write.deposit(
      [chain.usdcAddress, amountAtomic],
      { account: this.account, chain: null }
    ) as Hex;
    await chain.publicClient.waitForTransactionReceipt({ hash: depositHash });
    console.log(`Deposit confirmed: ${depositHash}`);

    return { approvalHash, depositHash };
  }

  /**
   * Transfer USDC from unified balance to destination chain
   * @param fromChainName - Source chain name
   * @param toChainName - Destination chain name
   * @param amount - Amount in USDC (human-readable)
   * @param recipient - Recipient address (default: sender's address)
   */
  async transfer(
    fromChainName: keyof ChainConfigs,
    toChainName: keyof ChainConfigs,
    amount: number,
    recipient?: Address
  ): Promise<TransferResult> {
    const from = this.chains[fromChainName];
    const to = this.chains[toChainName];

    if (!from || !to) {
      throw new Error("Unknown chain. Use 'ethereum', 'base', 'avalanche', or 'arc'");
    }

    // Create burn intent
    console.log(`Creating burn intent: ${amount} USDC from ${from.name} to ${to.name}...`);
    const intent = burnIntent({
      account: this.account,
      from,
      to,
      amount,
      recipient: recipient || this.account.address,
    });

    // Sign the burn intent
    console.log('Signing burn intent...');
    const typedData = burnIntentTypedData(intent);
    const signature = await this.account.signTypedData(typedData);

    // Request attestation from Gateway API
    console.log('Requesting attestation from Gateway API...');
    const request = [{ burnIntent: typedData.message as any, signature }];
    const response = await this.client.transfer(request);

    if (response.error) {
      throw new Error(`Gateway API error: ${response.error}`);
    }

    // Mint on destination chain
    console.log(`Minting USDC on ${to.name}...`);
    const { attestation, signature: attestationSignature } = response;
    const mintHash = await to.gatewayMinter.write.gatewayMint(
      [attestation as Hex, attestationSignature as Hex],
      { account: this.account, chain: null }
    ) as Hex;
    await to.publicClient.waitForTransactionReceipt({ hash: mintHash });
    console.log(`Mint confirmed: ${mintHash}`);

    return {
      attestation,
      mintHash,
      recipient: recipient || this.account.address,
    };
  }

  /**
   * Transfer USDC to a contract address on another chain
   * NOTE: Gateway does NOT trigger any callback function on the contract.
   */
  async transferToContract(
    fromChainName: keyof ChainConfigs,
    toChainName: keyof ChainConfigs,
    amount: number,
    contractAddress: Address
  ): Promise<TransferResult> {
    console.log(`Transferring ${amount} USDC to contract ${contractAddress}...`);
    console.log('NOTE: USDC will appear in the contract balance. No callback is triggered.');
    return this.transfer(fromChainName, toChainName, amount, contractAddress);
  }
}

// Export factory function
export function createGatewayService(network: 'testnet' | 'mainnet' = 'testnet'): GatewayService {
  const account = getAccount();
  return new GatewayService(account, network);
}

// Re-export everything
export { GatewayClient } from './gateway-client';
export { burnIntent, burnIntentTypedData, burnIntentSetTypedData } from './typed-data';
export { getAccount, setupChain, setupAllChains, arcTestnet } from './setup';
export * from './config';
export * from './abis';
