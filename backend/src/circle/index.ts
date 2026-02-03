/**
 * Circle module exports
 * 
 * Includes:
 * - CCTP SDK for cross-chain USDC transfers
 * - RWA Yield Oracle for T-Bill rate tracking
 */

// CCTP SDK
export {
  CctpService,
  setupChain,
  setupAllChains,
  getAccount,
  arcTestnet,
  CCTP_CONTRACTS,
  DOMAINS,
  CHAIN_NAMES,
  USDC_ADDRESSES_TESTNET,
  USDC_ADDRESSES_MAINNET,
  RPC_URLS_TESTNET,
  IRIS_API,
  erc20Abi,
} from './cctp';

export type {
  ChainConfig,
  ChainConfigs,
  ChainName,
  NetworkType,
} from './cctp';

// RWA Yield Oracle
export { RWAYieldOracle, rwaOracle, type RWARate } from './rwa-oracle';
