import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { defineChain } from 'viem';
import { polygonAmoy, sepolia, baseSepolia } from 'wagmi/chains';
import { createStorage } from 'wagmi';

export const arcTestnet = defineChain({
  id: 5042002, // From backend .env
  name: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: {
    default: { http: ['https://arc-testnet.g.alchemy.com/v2/z_DE8LsUHA5hYcxxNShYo'] }, 
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: 'https://explorer.arc.circle.com' }, // Placeholder
  },
});

const safeStorage = {
    getItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) return window.localStorage.getItem(key);
        return null;
    },
    setItem: (key: string, value: string) => {
        if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem(key, value);
    },
    removeItem: (key: string) => {
        if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(key);
    },
}

export const config = getDefaultConfig({
  appName: 'Basis Zero',
  projectId: 'YOUR_PROJECT_ID', // TODO: Get from Reown/WalletConnect or use env
  chains: [arcTestnet, polygonAmoy, sepolia, baseSepolia], // All supported chains
  ssr: false,
});

