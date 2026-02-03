/**
 * CCTP Chain Setup
 * 
 * Sets up viem clients for cross-chain CCTP operations.
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
import { sepolia, polygonAmoy } from 'viem/chains';

import { erc20Abi } from './abis';
import {
    USDC_ADDRESSES_TESTNET,
    RPC_URLS_TESTNET,
    DOMAINS,
    CCTP_CONTRACTS,
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
    arcTestnet,
    polygonAmoy,
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
    tokenMessenger: Address;
    messageTransmitter: Address;
    usdc: GetContractReturnType<typeof erc20Abi, { public: PublicClient; wallet: WalletClient }>;
}

export type ChainConfigs = {
    arcTestnet: ChainConfig;
    polygonAmoy: ChainConfig;
    sepolia: ChainConfig;
};

// ═══════════════════════════════════════════════════════════════════════════
// SETUP FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sets up clients and contracts for a given chain
 */
export function setupChain(chainName: keyof typeof CCTP_CONTRACTS, account: PrivateKeyAccount): ChainConfig {
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

    // Get CCTP contracts
    const cctpContracts = CCTP_CONTRACTS[chainName];
    if (!cctpContracts) {
        throw new Error(`No CCTP contracts configured for chain: ${chainName}`);
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
        tokenMessenger: cctpContracts.tokenMessenger,
        messageTransmitter: cctpContracts.messageTransmitter,
        usdc: getContract({
            address: usdcAddress,
            abi: erc20Abi,
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
 * Setup all testnet chains for an account (CCTP-enabled chains only)
 */
export function setupAllChains(account: PrivateKeyAccount): ChainConfigs {
    return {
        arcTestnet: setupChain('arcTestnet', account),
        polygonAmoy: setupChain('polygonAmoy', account),
        sepolia: setupChain('sepolia', account),
    };
}
