"use client"

import { useAccount, useReadContract, useChainId } from "wagmi"
import { formatUnits, zeroAddress, type Address } from "viem"
import { useState, useEffect, useMemo } from "react"

// USDC addresses and decimals per chain
export const USDC_CONFIG: Record<number, { address: Address; decimals: number; name: string }> = {
    // Arc Testnet - USDC uses 6 decimals (verified on-chain)
    5042002: {
        address: "0x3600000000000000000000000000000000000000",
        decimals: 6,
        name: "Arc Testnet"
    },
    // Polygon Amoy
    80002: {
        address: "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582",
        decimals: 6,
        name: "Polygon Amoy"
    },
    // Sepolia
    11155111: {
        address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
        decimals: 6,
        name: "Sepolia"
    },
    // Base Sepolia
    84532: {
        address: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
        decimals: 6,
        name: "Base Sepolia"
    }
}

// Arc Testnet chain ID
export const ARC_CHAIN_ID = 5042002

const ERC20_BALANCE_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const

export function useMultiChainUSDC() {
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    // Get USDC config for current chain
    const usdcConfig = useMemo(() => {
        return USDC_CONFIG[chainId] || null
    }, [chainId])

    // Read USDC balance on current chain
    const { data: balanceData, isLoading, refetch } = useReadContract({
        address: usdcConfig?.address,
        abi: ERC20_BALANCE_ABI,
        functionName: "balanceOf",
        args: [address || zeroAddress],
        chainId: chainId, // Query the current chain
        query: { 
            enabled: !!address && !!usdcConfig && mounted
        }
    })

    const balance = useMemo(() => {
        if (!balanceData || !usdcConfig) return "0.00"
        return formatUnits(balanceData, usdcConfig.decimals)
    }, [balanceData, usdcConfig])

    const balanceRaw = balanceData || BigInt(0)

    // Check if on Arc (direct deposit) or needs bridging
    const isOnArc = chainId === ARC_CHAIN_ID
    const needsBridge = !isOnArc && isConnected
    const isSupported = !!usdcConfig

    return {
        balance,
        balanceRaw,
        decimals: usdcConfig?.decimals || 6,
        chainId,
        chainName: usdcConfig?.name || "Unknown",
        usdcAddress: usdcConfig?.address,
        isOnArc,
        needsBridge,
        isSupported,
        isLoading,
        isConnected,
        refetch
    }
}
