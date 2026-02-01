/**
 * Circle Gateway Chain Setup
 * 
 * Sets up viem clients and contracts for cross-chain operations.
 */

import 'dotenv/config';
import {
  createPublicClient,
  createWalletClient,
  getContract,
  http,
  defineChain,
  type Address,
  type PublicClient,
  type WalletClient,
  type Chain,
  type GetContractReturnType,
} from 'viem';
import { privateKeyToAccount, type PrivateKeyAccount } from 'viem/accounts';
import { sepolia, baseSepolia, avalancheFuji } from 'viem/chains';

import { GatewayClient } from './gateway-client';
import { erc20Abi, gatewayWalletAbi, gatewayMinterAbi } from './abis';
import {
  GATEWAY_WALLET_ADDRESS,
  GATEWAY_MINTER_ADDRESS,
  USDC_ADDRESSES_TESTNET,
  RPC_URLS_TESTNET,
  DOMAINS,
} from './config';

// ═══════════════════════════════════════════════════════════════════════════
// CUSTOM CHAINS
// ═══════════════════════════════════════════════════════════════════════════

// Define Arc Testnet chain (not built into viem)
// Arc uses USDC as native gas token!
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: {
      http: ['https://arc-testnet.drpc.org'],
    },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://testnet.arcscan.io',
    },
  },
  testnet: true,
});

// Map chain names to chain objects
const chainMap: Record<string, Chain> = {
  sepolia,
  baseSepolia,
  avalancheFuji,
  arcTestnet,
};

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ChainConfig {
  chainName: string;
  chain: Chain;
  name: string;
  domain: number;
  currency: string;
  publicClient: PublicClient;
  walletClient: WalletClient;
  usdcAddress: Address;
  gatewayWalletAddress: Address;
  gatewayMinterAddress: Address;
  usdc: GetContractReturnType<typeof erc20Abi, { public: PublicClient; wallet: WalletClient }>;
  gatewayWallet: GetContractReturnType<typeof gatewayWalletAbi, { public: PublicClient; wallet: WalletClient }>;
  gatewayMinter: GetContractReturnType<typeof gatewayMinterAbi, { public: PublicClient; wallet: WalletClient }>;
}

export type ChainConfigs = {
  ethereum: ChainConfig;
  base: ChainConfig;
  avalanche: ChainConfig;
  arc: ChainConfig;
};

// ═══════════════════════════════════════════════════════════════════════════
// SETUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sets up clients and contracts for a given chain
 */
export function setupChain(chainName: string, account: PrivateKeyAccount): ChainConfig {
  const chain = chainMap[chainName];
  if (!chain) {
    throw new Error(`Unknown chain: ${chainName}. Available: ${Object.keys(chainMap).join(', ')}`);
  }

  const rpcUrl = RPC_URLS_TESTNET[chainName];
  const transport = http(rpcUrl);

  // Public client for reading
  const publicClient = createPublicClient({
    chain,
    transport,
  });

  // Wallet client for writing
  const walletClient = createWalletClient({
    account,
    chain,
    transport,
  });

  const usdcAddress = USDC_ADDRESSES_TESTNET[chainName];
  if (!usdcAddress) {
    throw new Error(`No USDC address configured for chain: ${chainName}`);
  }

  // Get domain ID from DOMAINS
  const domainId = DOMAINS[chainName as keyof typeof DOMAINS];
  if (domainId === undefined) {
    throw new Error(`No domain ID configured for chain: ${chainName}`);
  }

  return {
    chainName,
    chain,
    name: chain.name,
    domain: domainId,
    currency: chain.nativeCurrency.symbol,
    publicClient,
    walletClient,
    usdcAddress,
    gatewayWalletAddress: GATEWAY_WALLET_ADDRESS,
    gatewayMinterAddress: GATEWAY_MINTER_ADDRESS,
    usdc: getContract({
      address: usdcAddress,
      abi: erc20Abi,
      client: { public: publicClient, wallet: walletClient },
    }),
    gatewayWallet: getContract({
      address: GATEWAY_WALLET_ADDRESS,
      abi: gatewayWalletAbi,
      client: { public: publicClient, wallet: walletClient },
    }),
    gatewayMinter: getContract({
      address: GATEWAY_MINTER_ADDRESS,
      abi: gatewayMinterAbi,
      client: { public: publicClient, wallet: walletClient },
    }),
  };
}

/**
 * Get the account from environment variable
 */
export function getAccount(): PrivateKeyAccount {
  let privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is not set');
  }

  // Add 0x prefix if not present
  if (!privateKey.startsWith('0x')) {
    privateKey = `0x${privateKey}`;
  }

  return privateKeyToAccount(privateKey as `0x${string}`);
}

/**
 * Setup all testnet chains for an account
 */
export function setupAllChains(account: PrivateKeyAccount): ChainConfigs {
  return {
    ethereum: setupChain('sepolia', account),
    base: setupChain('baseSepolia', account),
    avalanche: setupChain('avalancheFuji', account),
    arc: setupChain('arcTestnet', account),
  };
}
