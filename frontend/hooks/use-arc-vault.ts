"use client"

import { useAccount, useReadContract, useReadContracts, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi"
import { ARC_VAULT_ADDRESS, ARC_VAULT_ABI, ARC_USDC_ADDRESS, ERC20_ABI } from "@/lib/contracts"
import { arcTestnet } from "@/lib/wagmi"
import { formatUnits, parseUnits, zeroAddress } from "viem"
import { useState, useEffect, useMemo } from "react"

// Session states from contract
export enum SessionState {
    None = 0,
    PendingBridge = 1,
    Active = 2,
    Settled = 3,
    Cancelled = 4
}

export interface ArcVaultData {
    // From getUserDeposit
    principal: string
    depositTimestamp: number
    accruedYield: string
    availableYield: string
    totalBalance: string
    
    // From getSession
    sessionState: SessionState
    lockedAmount: string
    sessionStartedAt: number
    sessionId: string
    timeUntilTimeout: number
    
    // From rwaRateBps
    apyBps: number
    apyPercent: string
    
    // Computed
    isLoading: boolean
    error: Error | null
}

export function useArcVault() {
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const { switchChain } = useSwitchChain()
    const [mounted, setMounted] = useState(false)
    
    useEffect(() => setMounted(true), [])

    // Read user deposit data
    const { data: depositData, isLoading: isLoadingDeposit, error: depositError, refetch: refetchDeposit } = useReadContract({
        address: ARC_VAULT_ADDRESS,
        abi: ARC_VAULT_ABI,
        functionName: "getUserDeposit",
        args: [address || zeroAddress],
        chainId: arcTestnet.id,
        query: { enabled: !!address && mounted }
    })

    // Read session data
    const { data: sessionData, isLoading: isLoadingSession, refetch: refetchSession } = useReadContract({
        address: ARC_VAULT_ADDRESS,
        abi: ARC_VAULT_ABI,
        functionName: "getSession",
        args: [address || zeroAddress],
        chainId: arcTestnet.id,
        query: { enabled: !!address && mounted }
    })

    // Read APY rate
    const { data: rwaRateBps, isLoading: isLoadingRate } = useReadContract({
        address: ARC_VAULT_ADDRESS,
        abi: ARC_VAULT_ABI,
        functionName: "rwaRateBps",
        chainId: arcTestnet.id,
        query: { enabled: mounted }
    })

    // Parse deposit data (returns [principal, depositTimestamp, accruedYield, availableYield, totalBalance])
    const parsedDeposit = useMemo(() => {
        if (!depositData) return null
        const [principal, depositTimestamp, accruedYield, availableYield, totalBalance] = depositData as [bigint, bigint, bigint, bigint, bigint]
        return {
            principal: formatUnits(principal, 6), // USDC uses 6 decimals
            depositTimestamp: Number(depositTimestamp),
            accruedYield: formatUnits(accruedYield, 6),
            availableYield: formatUnits(availableYield, 6),
            totalBalance: formatUnits(totalBalance, 6)
        }
    }, [depositData])

    // Parse session data (returns [state, lockedAmount, startedAt, sessionId, timeUntilTimeout])
    const parsedSession = useMemo(() => {
        if (!sessionData) return null
        const [state, lockedAmount, startedAt, sessionId, timeUntilTimeout] = sessionData as [number, bigint, bigint, string, bigint]
        return {
            sessionState: state as SessionState,
            lockedAmount: formatUnits(lockedAmount, 6),
            sessionStartedAt: Number(startedAt),
            sessionId: sessionId,
            timeUntilTimeout: Number(timeUntilTimeout)
        }
    }, [sessionData])

    // Parse APY
    const apyData = useMemo(() => {
        if (!rwaRateBps) return { apyBps: 0, apyPercent: "0.00" }
        const bps = Number(rwaRateBps)
        return {
            apyBps: bps,
            apyPercent: (bps / 100).toFixed(2) // 520 bps = 5.20%
        }
    }, [rwaRateBps])

    // --- Withdrawal functionality ---
    const { writeContract: writeWithdraw, data: withdrawHash, isPending: isWithdrawing, error: withdrawError } = useWriteContract()
    const { isLoading: isWaitingWithdraw, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash })

    const withdraw = (amount: string) => {
        if (!isConnected || !address) return
        
        // Ensure on correct chain
        if (chainId !== arcTestnet.id) {
            switchChain({ chainId: arcTestnet.id })
            return
        }

        const amountBig = parseUnits(amount, 6) // USDC uses 6 decimals
        writeWithdraw({
            address: ARC_VAULT_ADDRESS,
            abi: ARC_VAULT_ABI,
            functionName: "withdraw",
            args: [amountBig]
        })
    }

    // --- Start Session functionality ---
    const { writeContract: writeStartSession, data: sessionHash, isPending: isStartingSession, error: startSessionError } = useWriteContract()
    const { isLoading: isWaitingSession, isSuccess: isSessionStartSuccess } = useWaitForTransactionReceipt({ hash: sessionHash })

    const startSession = async (amount: string, safeMode: boolean = true) => {
        if (!isConnected || !address) return null

        // Ensure on correct chain
        if (chainId !== arcTestnet.id) {
            switchChain({ chainId: arcTestnet.id })
            return null
        }

        // Generate unique sessionId: keccak256(user + timestamp + random)
        const timestamp = Date.now()
        const random = Math.floor(Math.random() * 1000000)
        const sessionIdData = `${address}${timestamp}${random}`
        const encoder = new TextEncoder()
        const data = encoder.encode(sessionIdData)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        const sessionId = ('0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')) as `0x${string}`

        const amountBig = parseUnits(amount, 6) // USDC uses 6 decimals

        // Call lockSessionAllowance on contract
        writeStartSession({
            address: ARC_VAULT_ADDRESS,
            abi: ARC_VAULT_ABI,
            functionName: "lockSessionAllowance",
            args: [amountBig, sessionId]
        })

        // Return sessionId so caller can notify backend after tx confirms
        return { sessionId, amount, safeMode }
    }

    // Notify backend when session starts (call after isSessionStartSuccess)
    const notifyBackendSessionStart = async (sessionId: string, collateral: string, safeMode: boolean) => {
        if (!address) return null
        
        try {
            const rwaRate = apyData.apyBps
            const response = await fetch("http://localhost:3001/api/session/open", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user: address,
                    collateral,
                    safeModeEnabled: safeMode,
                    rwaRateBps: rwaRate
                })
            })
            
            if (!response.ok) {
                throw new Error("Failed to open backend session")
            }
            
            const result = await response.json()
            return result
        } catch (error) {
            console.error("Backend session notification failed:", error)
            return null
        }
    }

    const refetch = () => {
        refetchDeposit()
        refetchSession()
    }

    const isLoading = isLoadingDeposit || isLoadingSession || isLoadingRate

    return {
        // Deposit data
        principal: parsedDeposit?.principal || "0.00",
        depositTimestamp: parsedDeposit?.depositTimestamp || 0,
        accruedYield: parsedDeposit?.accruedYield || "0.00",
        availableYield: parsedDeposit?.availableYield || "0.00",
        totalBalance: parsedDeposit?.totalBalance || "0.00",
        
        // Session data
        sessionState: parsedSession?.sessionState || SessionState.None,
        lockedAmount: parsedSession?.lockedAmount || "0.00",
        sessionStartedAt: parsedSession?.sessionStartedAt || 0,
        sessionId: parsedSession?.sessionId || "",
        timeUntilTimeout: parsedSession?.timeUntilTimeout || 0,
        
        // APY data
        apyBps: apyData.apyBps,
        apyPercent: apyData.apyPercent,
        
        // Status
        isLoading,
        isConnected,
        error: depositError,
        
        // Withdrawal
        withdraw,
        isWithdrawing: isWithdrawing || isWaitingWithdraw,
        isWithdrawSuccess,
        withdrawError,
        
        // Session actions
        startSession,
        notifyBackendSessionStart,
        isStartingSession: isStartingSession || isWaitingSession,
        isSessionStartSuccess,
        startSessionError,
        
        // Refetch
        refetch
    }
}
