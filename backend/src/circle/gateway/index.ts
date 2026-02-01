/**
 * Circle Gateway Module
 * 
 * Complete TypeScript SDK for Circle Gateway cross-chain USDC transfers.
 */

export {
  GatewayService,
  GatewayClient,
  createGatewayService,
  burnIntent,
  burnIntentTypedData,
  burnIntentSetTypedData,
  getAccount,
  setupChain,
  setupAllChains,
  arcTestnet,
  type BalanceInfo,
  type DepositResult,
  type TransferResult,
} from './gateway-service';

export type { ChainConfig, ChainConfigs } from './setup';

export type {
  GatewayBalance,
  GatewayBalancesResponse,
  GatewayInfoResponse,
  SignedBurnIntent,
  TransferResponse,
} from './gateway-client';

export type { BurnIntent, BurnIntentOptions, TransferSpec } from './typed-data';

export {
  GATEWAY_WALLET_ADDRESS,
  GATEWAY_MINTER_ADDRESS,
  GATEWAY_API,
  DOMAINS,
  CHAIN_NAMES,
  EVM_DOMAINS,
  USDC_ADDRESSES_TESTNET,
  USDC_ADDRESSES_MAINNET,
  RPC_URLS_TESTNET,
  getConfig,
  type NetworkType,
  type ChainName,
  type GatewayConfig,
} from './config';

export { erc20Abi, gatewayWalletAbi, gatewayMinterAbi } from './abis';
