"use client"

import { useState, useEffect, useRef } from "react"
import { Shield, TrendingUp, Wallet, Loader2, Lock, Sparkles } from "lucide-react"
import { useSessionEscrow, SessionState } from "@/hooks/use-session-escrow"
import { useAccount } from "wagmi"
import { useQuery } from "@tanstack/react-query"

// Fetch user positions
async function fetchUserPositions(userId: string) {
    if (!userId) return { positions: [], totalValue: '0' };
    const response = await fetch(`/api/amm/positions/${userId}`);
    if (!response.ok) return { positions: [], totalValue: '0' };
    return response.json();
}

export function StreamingBalance() {
    const [mounted, setMounted] = useState(false)
    const [animatedYield, setAnimatedYield] = useState(0)

    useEffect(() => {
        setMounted(true)
    }, [])

    const { isConnected: isWalletConnected } = useAccount()

    const {
        deposited, // Principal
        yieldAmount, // Yield
        totalBalance, // Principal + Yield
        available,
        locked,
        activeSessionId,
        sessionState,
        fetchStreamingBalance,
        yieldRateBps
    } = useSessionEscrow()
    
    // Use On-Chain Rate (or fallback for display if 0/loading, though hook defaults to 0)
    // Display as percentage (e.g. 5200 bps = 52%)
    const apyPercent = yieldRateBps ? (yieldRateBps / 100).toString() : "0"
    
    const hasActiveSession = sessionState === SessionState.Active

    // Fetch streaming balance (yield) from backend when session is active
    const { data: streamingData } = useQuery({
        queryKey: ['streaming-balance', activeSessionId],
        queryFn: () => fetchStreamingBalance(true), // safeMode = true
        enabled: !!activeSessionId && hasActiveSession,
        refetchInterval: 5000, // Sync with backend every 5 seconds
    })

    // Fetch user positions to calculate positions value
    const { data: positionsData } = useQuery({
        queryKey: ['user-positions', activeSessionId],
        queryFn: () => fetchUserPositions(activeSessionId || ''),
        enabled: !!activeSessionId,
        refetchInterval: 10000, 
    })

    // Parse values for display
    const depositedNum = parseFloat(deposited) || 0
    const yieldNum = parseFloat(yieldAmount) || 0
    const totalNum = parseFloat(totalBalance) || 0
    const availableNum = parseFloat(available) || 0
    const lockedNum = parseFloat(locked) || 0
    const apyNum = parseFloat(apyPercent) || 0
    
    // Backend data
    const backendYield = parseFloat(streamingData?.yield || "0")
    const yieldAvailable = parseFloat(streamingData?.available || "0")
    const openBetsAmount = parseFloat(streamingData?.openBets || "0")
    
    // Sync animation state with backend fetch
    useEffect(() => {
        if (streamingData?.yield) {
            setAnimatedYield(parseFloat(streamingData.yield))
        } else if (!hasActiveSession) {
            // When no session, show accumulated yield from contract
            setAnimatedYield(yieldNum) 
        }
    }, [streamingData?.yield, yieldNum, hasActiveSession])

    // Real-time Animation Effect
    useEffect(() => {
        if (!yieldRateBps || !lockedNum && !depositedNum) return

        // Calculate yield based on Principal (Deposited) or Locked amount depending on context
        // Contract updateYield uses principalBalance.
        const principal = depositedNum // Yield accrues on ALL principal (locked + unlocked) in this contract logic
        const annualYield = principal * (yieldRateBps / 10000)
        const yieldPerSecond = annualYield / (365 * 24 * 60 * 60)
        
        const intervalMs = 100 // Update 10 times a second
        const yieldPerInterval = yieldPerSecond * (intervalMs / 1000)

        const interval = setInterval(() => {
            setAnimatedYield(prev => prev + yieldPerInterval)
        }, intervalMs)

        return () => clearInterval(interval)
    }, [yieldRateBps, depositedNum, lockedNum]) // Removed hasActiveSession dependency to animate always if principal exists
    
    // Calculate positions value
    const positionsValueMicro = parseFloat(positionsData?.totalValue || '0')
    const positionsValue = positionsValueMicro / 1_000_000
    
    // Calculate daily yield rate for display
    const dailyYield = (depositedNum * (apyNum / 100)) / 365

    if (!mounted) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        )
    }

    if (!isWalletConnected) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                                Vault Balance
                            </h3>
                            <p className="text-xs text-muted-foreground">Connect wallet to view</p>
                        </div>
                    </div>
                </div>
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Connect your wallet to view your vault balance</p>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card/60 glass p-6 sm:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            Total Balance
                        </h3>
                        <p className="text-xs text-muted-foreground">Principal + Yield</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-green-500">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-mono text-xs">LIVE</span>
                </div>
            </div>

            {/* Main Balance Display */}
            <div className="text-center py-4 overflow-hidden">
                <div className="font-mono text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                    <span className="text-foreground">$</span>
                    <span className="text-foreground">
                        {/* Show Total = Principal + Yield (animated) */}
                        {(depositedNum + animatedYield).toLocaleString(undefined, { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                    </span>
                </div>
               {apyNum > 0 && (
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                        Earning ~${dailyYield.toFixed(4)}/day at {apyNum}% APY
                    </p>
                )}
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Principal
                        </span>
                    </div>
                    <p className="font-mono text-xl font-bold text-foreground">
                        ${depositedNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                     <div className="flex items-center gap-2 mb-2">
                         <Sparkles className="h-4 w-4 text-green-500" />
                        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Yield
                        </span>
                    </div>
                    <p className="font-mono text-xl font-bold text-green-500 animate-pulse">
                        +${animatedYield.toFixed(6)}
                    </p>
                </div>
            </div>
            
             {/* Secondary Breakdown */}
             <div className="grid grid-cols-2 gap-4">
                 <div className="rounded-lg border border-secondary/50 bg-secondary/20 p-3">
                     <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Available Principal</p>
                     <p className="font-mono text-lg text-foreground">${availableNum.toFixed(2)}</p>
                 </div>
                 <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                     <p className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Locked in Session</p>
                     <p className="font-mono text-lg text-yellow-500">${lockedNum.toFixed(2)}</p>
                 </div>
             </div>

            {/* Session Stats (only when session is active) */}
            {hasActiveSession && (
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 mt-2">
                    <div className="flex items-center justify-between mb-3">
                         <div className="flex items-center gap-2">
                            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                                Active Session
                            </span>
                        </div>
                    </div>
                    <div className="space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Active Bets:</span>
                            <span className="font-mono text-yellow-500">${openBetsAmount.toFixed(4)}</span>
                        </div>
                         <div className="flex justify-between items-center">
                            <span className="text-muted-foreground font-bold">Trading Power:</span>
                            <span className="font-mono text-green-500 font-bold text-sm">${yieldAvailable.toFixed(4)}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Value In Trades */}
            {positionsValue > 0 && (
                 <div className="border-t border-border/50 pt-6 space-y-4">
                    <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                        <div className="flex items-center justify-between">
                            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                                Active Positions Value
                            </span>
                            <span className="font-mono text-lg font-bold text-primary">
                                ${positionsValue.toFixed(4)}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
