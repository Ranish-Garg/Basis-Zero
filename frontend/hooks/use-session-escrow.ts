"use client"

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from "wagmi"
import { SESSION_ESCROW_ADDRESS, SESSION_ESCROW_ABI, POLYGON_USDC_ADDRESS, ERC20_ABI } from "@/lib/contracts"
import { formatUnits, parseUnits, type Address, type Hex } from "viem"
import { useMemo, useState, useCallback } from "react"
import { polygonAmoy } from "viem/chains"

export enum SessionState {
    None = 0,
    Active = 1,
    Settled = 2
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"

export function useSessionEscrow() {
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const { switchChain } = useSwitchChain()
    
    // Local state for generated sessionId
    const [pendingSessionId, setPendingSessionId] = useState<Hex | null>(null)

    const ensureChain = () => {
        if (chainId !== polygonAmoy.id) {
            switchChain({ chainId: polygonAmoy.id })
            return false
        }
        return true
    }

    // Read USDC Balance
    const { data: usdcBalanceData, refetch: refetchUsdcBalance } = useReadContract({
        address: POLYGON_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address as Address],
        chainId: polygonAmoy.id,
        query: { enabled: !!address }
    })

    // Read Allowance
    const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
        address: POLYGON_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address as Address, SESSION_ESCROW_ADDRESS],
        chainId: polygonAmoy.id,
        query: { enabled: !!address }
    })

    // Read Account Info from SessionEscrow
    const { data: accountInfo, refetch: refetchAccount } = useReadContract({
        address: SESSION_ESCROW_ADDRESS,
        abi: SESSION_ESCROW_ABI,
        functionName: "getAccountInfo",
        args: [address as Address],
        chainId: polygonAmoy.id,
        query: { enabled: !!address }
    })

    // Read Yield Rate
    const { data: yieldRateData } = useReadContract({
        address: SESSION_ESCROW_ADDRESS,
        abi: SESSION_ESCROW_ABI,
        functionName: "yieldRateBps",
        chainId: polygonAmoy.id
    })

    // Process Yield Rate
    const yieldRateBps = yieldRateData ? Number(yieldRateData) : 0

    const parsedAccount = useMemo(() => {
        if (!accountInfo) return null
        // Contract returns: [principal, yield, locked, activeSessionId, state]
        const [principal, accruedYield, locked, activeSessionId, state] = accountInfo as [bigint, bigint, bigint, Hex, number]
        
        // Calculate available principal to withdraw/lock
        const availablePrincipal = principal - locked
        
        // Total Value = Principal + Yield
        const totalBalance = principal + accruedYield
        
        // Withdrawable = Available Principal + Yield (assuming you can withdraw both)
        const withdrawable = availablePrincipal + accruedYield

        return {
            deposited: formatUnits(principal, 6), // Total Principal
            yield: formatUnits(accruedYield, 6),
            available: formatUnits(availablePrincipal, 6), // Available Principal
            locked: formatUnits(locked, 6),
            totalBalance: formatUnits(totalBalance, 6),
            withdrawable: formatUnits(withdrawable, 6),
            activeSessionId,
            state: state as SessionState
        }
    }, [accountInfo])

    const usdcBalance = useMemo(() => {
        if (!usdcBalanceData) return "0"
        return formatUnits(usdcBalanceData as bigint, 6)
    }, [usdcBalanceData])

    const allowance = useMemo(() => {
        if (!allowanceData) return "0"
        return formatUnits(allowanceData as bigint, 6)
    }, [allowanceData])

    // Write: Approve
    const { writeContract: writeApprove, data: approveHash, isPending: isApproving } = useWriteContract()
    const { isLoading: isWaitingApprove, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

    // Write: Deposit
    const { writeContract: writeDeposit, data: depositHash, isPending: isDepositing, error: depositError } = useWriteContract()
    const { isLoading: isWaitingDeposit, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash })

    // Write: Withdraw
    const { writeContract: writeWithdraw, data: withdrawHash, isPending: isWithdrawing } = useWriteContract()
    const { isLoading: isWaitingWithdraw, isSuccess: isWithdrawSuccess } = useWaitForTransactionReceipt({ hash: withdrawHash })

    // Write: Open Session
    const { writeContract: writeOpenSession, data: sessionHash, isPending: isOpeningSession } = useWriteContract()
    const { isLoading: isWaitingSession, isSuccess: isSessionOpenSuccess } = useWaitForTransactionReceipt({ hash: sessionHash })


    // Actions
    const approve = (amount: string) => {
        if (!ensureChain()) return
        const amountBig = parseUnits(amount, 6)
        writeApprove({
            address: POLYGON_USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: "approve",
            args: [SESSION_ESCROW_ADDRESS, amountBig]
        })
    }

    const deposit = (amount: string) => {
        if (!ensureChain()) return
        const amountBig = parseUnits(amount, 6)
        writeDeposit({
            address: SESSION_ESCROW_ADDRESS,
            abi: SESSION_ESCROW_ABI,
            functionName: "deposit",
            args: [amountBig]
        })
    }

    const withdraw = (amount: string) => {
        if (!ensureChain()) return
        const amountBig = parseUnits(amount, 6)
        writeWithdraw({
            address: SESSION_ESCROW_ADDRESS,
            abi: SESSION_ESCROW_ABI,
            functionName: "withdraw",
            args: [amountBig]
        })
    }

    // Generate a bytes32 sessionId
    const generateSessionId = async (): Promise<Hex> => {
        const timestamp = Date.now()
        const random = Math.floor(Math.random() * 1000000)
        const sessionIdData = `${address}${timestamp}${random}`
        const encoder = new TextEncoder()
        const data = encoder.encode(sessionIdData)
        const hashBuffer = await crypto.subtle.digest('SHA-256', data)
        const hashArray = Array.from(new Uint8Array(hashBuffer))
        return ('0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('')) as Hex
    }

    const startSession = async (amount: string, safeMode: boolean = true) => {
        if (!ensureChain()) return null
        
        // Generate sessionId
        const sessionId = await generateSessionId()
        setPendingSessionId(sessionId)
        
        const amountBig = parseUnits(amount, 6)

        writeOpenSession({
            address: SESSION_ESCROW_ADDRESS,
            abi: SESSION_ESCROW_ABI,
            functionName: "openSession",
            args: [amountBig, sessionId]
        })

        return { sessionId, amount, safeMode }
    }

    // Backend Notification - call after contract tx confirms
    const notifyBackendSessionStart = useCallback(async (
        sessionId: Hex, 
        collateral: string, 
        safeMode: boolean
    ) => {
        if (!address) return null
        
        try {
            const collateralBig = parseUnits(collateral, 6).toString()
            
            const response = await fetch(`${BACKEND_URL}/api/session/open`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userAddress: address,
                    sessionId: sessionId,
                    collateral: collateralBig,
                    safeModeEnabled: safeMode,
                    rwaRateBps: yieldRateBps || 5200 // Use fetched rate or default
                })
            })
            
            if (!response.ok) {
                const error = await response.json()
                console.error("Backend session open failed:", error)
                return null
            }
            return await response.json()
        } catch (error) {
            console.error("Backend session notification failed:", error)
            return null
        }
    }, [address, yieldRateBps])

    // Close session via backend (gets signature for contract settlement)
    const closeSession = useCallback(async () => {
        const sessionId = parsedAccount?.activeSessionId
        if (!sessionId || sessionId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            throw new Error("No active session")
        }
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/session/close`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId })
            })
            
            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || "Failed to close session")
            }
            
            const data = await response.json()
            // Returns: { success, pnl, signature, sessionId }
            return data
        } catch (error) {
            console.error("Close session error:", error)
            throw error
        }
    }, [parsedAccount?.activeSessionId])

    // Recover session with backend (for when backend restarts but session is active on-chain)
    const recoverSession = useCallback(async () => {
        const sessionId = parsedAccount?.activeSessionId
        const locked = parsedAccount?.locked
        
        if (!sessionId || !address || !locked) return null
        
        try {
            const collateralBig = parseUnits(locked, 6).toString()
            
            const response = await fetch(`${BACKEND_URL}/api/session/recover`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userAddress: address,
                    sessionId: sessionId,
                    collateral: collateralBig,
                    safeModeEnabled: true // Default to safe mode for recovery
                })
            })

            
            if (!response.ok) {
                // Try to parse JSON, fallback to text if HTML returned (404/500)
                try {
                    const error = await response.json()
                    throw new Error(error.error || "Failed to recover session")
                } catch (e) {
                    const text = await response.text()
                    console.error("Backend error response (non-JSON):", text.slice(0, 200)) // Log first 200 chars
                    throw new Error(`Backend error (${response.status}): ${response.statusText}`)
                }
            }
            return await response.json()
        } catch (error) {
            console.error("Recover session error:", error)
            throw error
        }
    }, [parsedAccount?.activeSessionId, parsedAccount?.locked, address])


    // Get streaming balance from backend
    const fetchStreamingBalance = useCallback(async (safeMode: boolean = true) => {
        const sessionId = parsedAccount?.activeSessionId
        if (!sessionId || sessionId === '0x0000000000000000000000000000000000000000000000000000000000000000') {
            return { principal: "0", yield: "0", openBets: "0", available: "0" }
        }
        
        try {
            const response = await fetch(`${BACKEND_URL}/api/session/${sessionId}/balance?safeMode=${safeMode}`)
            if (!response.ok) {
                return { principal: "0", yield: "0", openBets: "0", available: "0" }
            }
            const data = await response.json()
            return {
                principal: formatUnits(BigInt(data.principal), 6),
                yield: formatUnits(BigInt(data.yield), 6),
                openBets: formatUnits(BigInt(data.openBets), 6),
                available: formatUnits(BigInt(data.available), 6)
            }
        } catch {
            return { principal: "0", yield: "0", openBets: "0", available: "0" }
        }
    }, [parsedAccount?.activeSessionId])

    const refetch = () => {
        refetchAccount()
        refetchAllowance()
        refetchUsdcBalance()
    }

    return {
        // Data
        yieldRateBps,
        deposited: parsedAccount?.deposited || "0", // Total Principal
        yieldAmount: parsedAccount?.yield || "0",   // Accrued Yield
        available: parsedAccount?.available || "0", // Available Principal
        locked: parsedAccount?.locked || "0",
        totalBalance: parsedAccount?.totalBalance || "0", // Principal + Yield
        withdrawable: parsedAccount?.withdrawable || "0", // Available Principal + Yield
        sessionState: parsedAccount?.state ?? SessionState.None,
        activeSessionId: parsedAccount?.activeSessionId,
        usdcBalance,
        allowance,
        pendingSessionId,

        // Actions
        approve,
        deposit,
        withdraw,
        startSession,
        notifyBackendSessionStart,
        closeSession,
        recoverSession,
        fetchStreamingBalance,

        // States
        isApproving: isApproving || isWaitingApprove,
        isDepositing: isDepositing || isWaitingDeposit,
        isWithdrawing: isWithdrawing || isWaitingWithdraw,
        isOpeningSession: isOpeningSession || isWaitingSession,
        
        // Success
        isApproveSuccess,
        isDepositSuccess,
        isWithdrawSuccess,
        isSessionOpenSuccess,
        
        // Hashes
        depositHash,
        sessionHash,
        
        refetch
    }
}
