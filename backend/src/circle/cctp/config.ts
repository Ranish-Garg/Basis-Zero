/**
 * CCTP Configuration
 * 
 * Contract addresses and chain configuration for CCTP cross-chain USDC transfers.
 */

import type { Address } from 'viem';

// ═══════════════════════════════════════════════════════════════════════════
// CCTP CONTRACT ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════

// CCTP Contract Addresses (TokenMessenger & MessageTransmitter)
// NOTE: Arc uses CCTP V2, so we need V2 contracts for all chains bridging to/from Arc
export const CCTP_CONTRACTS = {
  arcTestnet: {
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as Address,  // V2
    messageTransmitter: '0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275' as Address,  // V2
  },
  polygonAmoy: {
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as Address,  // V2 - required for Arc
    messageTransmitter: '0x7b5C8aB9E6B055A63e5df6248b1357dD10aa0791' as Address,  // V2
  },
  sepolia: {
    tokenMessenger: '0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA' as Address,  // V2 - required for Arc
    messageTransmitter: '0xbaC0179bB358A8936169a63408C8481D582390C4' as Address,  // V2
  },
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// DOMAIN IDS
// ═══════════════════════════════════════════════════════════════════════════

// Domain IDs for CCTP
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
  polygonAmoy: 7, // Alias for Amoy testnet
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

// ═══════════════════════════════════════════════════════════════════════════
// USDC ADDRESSES
// ═══════════════════════════════════════════════════════════════════════════

// USDC contract addresses by chain (Testnet)
export const USDC_ADDRESSES_TESTNET: Record<string, Address> = {
  sepolia: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
  baseSepolia: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  avalancheFuji: '0x5425890298aed601595a70ab815c96711a31bc65',
  arcTestnet: '0x3600000000000000000000000000000000000000',
  polygonAmoy: '0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582',
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
  polygonAmoy: 'https://rpc-amoy.polygon.technology',
};

// ═══════════════════════════════════════════════════════════════════════════
// IRIS API (Circle Attestation Service)
// ═══════════════════════════════════════════════════════════════════════════

export const IRIS_API = {
  testnet: 'https://iris-api-sandbox.circle.com',
  mainnet: 'https://iris-api.circle.com',
} as const;

export type NetworkType = keyof typeof IRIS_API;

// ═══════════════════════════════════════════════════════════════════════════
// ARC YIELD VAULT
// ═══════════════════════════════════════════════════════════════════════════

export const ARC_VAULT_ADDRESS = '0x49E4177eA6F21Cc5673bDc0b09507C5648fd53a3' as Address;
