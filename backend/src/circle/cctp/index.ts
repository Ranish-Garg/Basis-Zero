/**
 * CCTP Module
 * 
 * Cross-Chain Transfer Protocol SDK for bridging USDC between chains.
 */

// Main CCTP Service
export { CctpService } from './cctp-service';
export { createCctpRouter } from './routes';


// Chain Setup
export {
    setupChain,
    setupAllChains,
    getAccount,
    arcTestnet,
    type ChainConfig,
    type ChainConfigs,
} from './setup';

// Configuration
export {
    CCTP_CONTRACTS,
    DOMAINS,
    CHAIN_NAMES,
    USDC_ADDRESSES_TESTNET,
    USDC_ADDRESSES_MAINNET,
    RPC_URLS_TESTNET,
    IRIS_API,
    type ChainName,
    type NetworkType,
} from './config';

// ABIs
export { erc20Abi } from './abis';
