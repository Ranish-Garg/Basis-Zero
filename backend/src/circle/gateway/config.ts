/**
 * Circle Gateway Configuration
 * 
 * Contract addresses and chain configuration for cross-chain USDC transfers.
 * @see https://developers.circle.com/gateway
 */

import type { Address } from 'viem';

// ═══════════════════════════════════════════════════════════════════════════
// CONTRACT ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════

// Gateway contract addresses (same on all chains)
export const GATEWAY_WALLET_ADDRESS: Address = '0x0077777d7EBA4688BDeF3E311b846F25870A19B9';
export const GATEWAY_MINTER_ADDRESS: Address = '0x0022222ABE238Cc2C7Bb1f21003F0a260052475B';

// ═══════════════════════════════════════════════════════════════════════════
// API ENDPOINTS
// ═══════════════════════════════════════════════════════════════════════════

export const GATEWAY_API = {
  testnet: 'https://gateway-api-testnet.circle.com/v1',
  mainnet: 'https://gateway-api.circle.com/v1',
} as const;

export type NetworkType = keyof typeof GATEWAY_API;

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN IDS
// ═══════════════════════════════════════════════════════════════════════════

// Domain IDs for CCTP/Gateway
export const DOMAINS = {
  ethereum: 0,
  mainnet: 0,
  sepolia: 0,
  avalanche: 1,
  avalancheFuji: 1,
  optimism: 2,
  arbitrum: 3,
  noble: 4,
  solana: 5,
  base: 6,
  baseSepolia: 6,
  polygon: 7,
  arc: 26,
  arcTestnet: 26,
} as const;

export type ChainName = keyof typeof DOMAINS;

// Human-readable names for domains
export const CHAIN_NAMES: Record<number, string> = {
  0: 'Ethereum',
  1: 'Avalanche',
  2: 'Optimism',
  3: 'Arbitrum',
  4: 'Noble',
  5: 'Solana',
  6: 'Base',
  7: 'Polygon',
  26: 'Arc',
};

// EVM-compatible domains only (exclude Solana=5, Noble=4)
export const EVM_DOMAINS = [0, 1, 6, 26] as const;

// ═══════════════════════════════════════════════════════════════════════════
// USDC ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════

// USDC contract addresses by chain (Testnet)
export const USDC_ADDRESSES_TESTNET: Record<string, Address> = {
  sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  baseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  avalancheFuji: '0x5425890298aed601595a70ab815c96711a31bc65',
  arcTestnet: '0x3600000000000000000000000000000000000000',
};

// USDC contract addresses by chain (Mainnet)
export const USDC_ADDRESSES_MAINNET: Record<string, Address> = {
  ethereum: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  base: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
  polygon: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  arbitrum: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  optimism: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
};

// ═══════════════════════════════════════════════════════════════════════════
// RPC URLS
// ═══════════════════════════════════════════════════════════════════════════

export const RPC_URLS_TESTNET: Record<string, string> = {
  sepolia: 'https://ethereum-sepolia-rpc.publicnode.com',
  baseSepolia: 'https://sepolia-preconf.base.org',
  avalancheFuji: 'https://api.avax-test.network/ext/bc/C/rpc',
  arcTestnet: 'https://arc-testnet.drpc.org',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface GatewayConfig {
  apiUrl: string;
  usdcAddresses: Record<string, Address>;
  rpcUrls: Record<string, string>;
}

export function getConfig(network: NetworkType = 'testnet'): GatewayConfig {
  return {
    apiUrl: GATEWAY_API[network],
    usdcAddresses: network === 'mainnet' ? USDC_ADDRESSES_MAINNET : USDC_ADDRESSES_TESTNET,
    rpcUrls: RPC_URLS_TESTNET,
  };
}
