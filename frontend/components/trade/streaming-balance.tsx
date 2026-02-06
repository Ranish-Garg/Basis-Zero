"use client"

import { useState, useEffect } from "react"
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

    useEffect(() => {
        setMounted(true)
    }, [])

    const { isConnected: isWalletConnected } = useAccount()

    const {
        deposited,
        available,
        locked,
        activeSessionId,
        sessionState,
        fetchStreamingBalance,
    } = useSessionEscrow()
    
    // DEMO MODE: Boosted APY for testing (5200% = 100x normal)
    const apyPercent = "5200"
    const hasActiveSession = sessionState === SessionState.Active

    // Fetch streaming balance (yield) from backend when session is active
    const { data: streamingData } = useQuery({
        queryKey: ['streaming-balance', activeSessionId],
        queryFn: () => fetchStreamingBalance(true), // safeMode = true
        enabled: !!activeSessionId && hasActiveSession,
        refetchInterval: 5000, // Update every 5 seconds to show streaming yield
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
    const availableNum = parseFloat(available) || 0
    const lockedNum = parseFloat(locked) || 0
    const apyNum = parseFloat(apyPercent) || 0
    
    // Streaming yield data
    const yieldAmount = parseFloat(streamingData?.yield || "0")
    const yieldAvailable = parseFloat(streamingData?.available || "0")
    const openBetsAmount = parseFloat(streamingData?.openBets || "0")
    
    // Calculate positions value
    const positionsValueMicro = parseFloat(positionsData?.totalValue || '0')
    const positionsValue = positionsValueMicro / 1_000_000
    
    // Calculate daily yield rate
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
                        <p className="text-xs text-muted-foreground">USDC in Vault</p>
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
                        {depositedNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                            Available
                        </span>
                    </div>
                    <p className="font-mono text-xl font-bold text-foreground">
                        ${availableNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                </div>

                <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <Lock className="h-4 w-4 text-yellow-500" />
                        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Locked
                        </span>
                    </div>
                    <p className="font-mono text-xl font-bold text-yellow-500">
                        ${lockedNum.toFixed(2)}
                    </p>
                </div>
            </div>

            {/* Streaming Yield (only when session is active) */}
            {hasActiveSession && (
                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-green-500" />
                            <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                                Accrued Yield
                            </span>
                        </div>
                        <span className="font-mono text-sm font-bold text-green-500">
                            ${yieldAmount.toFixed(6)}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">In Bets:</span>
                            <span className="font-mono text-yellow-500">${openBetsAmount.toFixed(4)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Available:</span>
                            <span className="font-mono text-green-500">${yieldAvailable.toFixed(4)}</span>
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
