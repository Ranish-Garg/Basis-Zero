/**
 * Circle module exports
 * 
 * Includes:
 * - Circle Gateway SDK for cross-chain USDC transfers
 * - RWA Yield Oracle for T-Bill rate tracking
 */

// Gateway SDK
export {
  GatewayService,
  GatewayClient,
  createGatewayService,
  burnIntent,
  burnIntentTypedData,
  getAccount,
  setupAllChains,
  GATEWAY_WALLET_ADDRESS,
  GATEWAY_MINTER_ADDRESS,
  DOMAINS,
  CHAIN_NAMES,
} from './gateway';

export type {
  BalanceInfo,
  DepositResult,
  TransferResult,
  ChainConfig,
  ChainConfigs,
} from './gateway';

// RWA Yield Oracle
export { RWAYieldOracle, rwaOracle, type RWARate } from './rwa-oracle';
