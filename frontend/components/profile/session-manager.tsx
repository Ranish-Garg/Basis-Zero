"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff, Zap, Clock, RefreshCw, Loader2, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useArcVault, SessionState } from "@/hooks/use-arc-vault"
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi"
import { ARC_VAULT_ADDRESS, ARC_VAULT_ABI } from "@/lib/contracts"

export function SessionManager() {
    const { 
        sessionState, 
        lockedAmount, 
        sessionId, 
        sessionStartedAt,
        timeUntilTimeout,
        isLoading,
        refetch 
    } = useArcVault()
    
    const { address } = useAccount()
    
    // Cancel session tx
    const { writeContract: writeCancelSession, data: cancelHash, isPending: isCancelling } = useWriteContract()
    const { isLoading: isWaitingCancel, isSuccess: isCancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash })

    // Refetch after cancel
    useEffect(() => {
        if (isCancelSuccess) {
            refetch()
        }
    }, [isCancelSuccess])

    const isSessionActive = sessionState === SessionState.Active || sessionState === SessionState.PendingBridge
    const isPendingBridge = sessionState === SessionState.PendingBridge
    const canCancel = isPendingBridge && timeUntilTimeout <= 0
    
    // Format session duration
    const formatDuration = () => {
        if (!sessionStartedAt || sessionStartedAt === 0) return "N/A"
        const now = Math.floor(Date.now() / 1000)
        const duration = now - sessionStartedAt
        const minutes = Math.floor(duration / 60)
        const seconds = duration % 60
        return `${minutes}m ${seconds}s`
    }

    // Get session state label
    const getSessionLabel = () => {
        switch (sessionState) {
            case SessionState.None: return "No Session"
            case SessionState.PendingBridge: return "Pending Bridge"
            case SessionState.Active: return "Active"
            case SessionState.Settled: return "Settled"
            case SessionState.Cancelled: return "Cancelled"
            default: return "Unknown"
        }
    }

    const handleCancelSession = () => {
        if (!address) return
        
        writeCancelSession({
            address: ARC_VAULT_ADDRESS,
            abi: ARC_VAULT_ABI,
            functionName: "cancelTimedOutSession",
            args: [address]
        })
    }

    const isProcessing = isCancelling || isWaitingCancel

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            {/* Header */}
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                            On-Chain Session
                        </h3>
                    </div>
                    <div className={cn(
                        "flex items-center gap-2 px-2 py-1 rounded-full text-xs font-mono",
                        isSessionActive
                            ? "bg-green-500/20 text-green-500"
                            : "bg-muted/20 text-muted-foreground"
                    )}>
                        {isSessionActive ? (
                            <>
                                <Wifi className="h-3 w-3" />
                                {getSessionLabel()}
                            </>
                        ) : (
                            <>
                                <WifiOff className="h-3 w-3" />
                                {getSessionLabel()}
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <>
                        {/* Session Stats */}
                        <div className="grid grid-cols-3 gap-4">
                            <div className="text-center p-3 rounded-lg bg-secondary/30">
                                <p className="font-mono text-xl font-bold text-foreground">
                                    {isSessionActive ? 1 : 0}
                                </p>
                                <p className="font-mono text-[10px] text-muted-foreground uppercase">Active</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-secondary/30">
                                <p className="font-mono text-xl font-bold text-primary">
                                    ${parseFloat(lockedAmount).toFixed(2)}
                                </p>
                                <p className="font-mono text-[10px] text-muted-foreground uppercase">Locked</p>
                            </div>
                            <div className="text-center p-3 rounded-lg bg-secondary/30">
                                <p className="font-mono text-xl font-bold text-foreground">
                                    {isSessionActive ? formatDuration() : "N/A"}
                                </p>
                                <p className="font-mono text-[10px] text-muted-foreground uppercase">Duration</p>
                            </div>
                        </div>

                        {/* Session Details */}
                        {isSessionActive && (
                            <div className="space-y-2">
                                <div className="flex items-center justify-between mb-3">
                                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                                        Session Details
                                    </p>
                                    <button 
                                        onClick={() => refetch()}
                                        className="text-xs text-primary hover:underline flex items-center gap-1"
                                    >
                                        <RefreshCw className="h-3 w-3" />
                                        Refresh
                                    </button>
                                </div>

                                <div className="p-4 rounded-lg border border-border/50 bg-secondary/20 space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Session ID</span>
                                        <span className="font-mono text-xs truncate max-w-[180px]">{sessionId}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">State</span>
                                        <span className={cn(
                                            "font-mono text-xs px-2 py-0.5 rounded",
                                            isPendingBridge ? "bg-yellow-500/20 text-yellow-500" : "bg-green-500/20 text-green-500"
                                        )}>
                                            {getSessionLabel()}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-muted-foreground">Locked Amount</span>
                                        <span className="font-mono">${parseFloat(lockedAmount).toFixed(2)}</span>
                                    </div>
                                    {isPendingBridge && (
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-muted-foreground">Timeout In</span>
                                            <span className="font-mono flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                {timeUntilTimeout > 0 ? `${timeUntilTimeout}s` : "Expired"}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* No Active Session */}
                        {!isSessionActive && (
                            <div className="p-6 text-center border border-dashed border-border/50 rounded-lg">
                                <WifiOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">
                                    No active session. Go to the Trade page to start one.
                                </p>
                            </div>
                        )}

                        {/* Cancel Button (for PendingBridge after timeout) */}
                        {isPendingBridge && (
                            <div className="space-y-2">
                                <button 
                                    onClick={handleCancelSession}
                                    disabled={!canCancel || isProcessing}
                                    className={cn(
                                        "w-full py-3 rounded-lg font-mono text-sm transition-colors flex items-center justify-center gap-2",
                                        canCancel && !isProcessing
                                            ? "border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20"
                                            : "bg-secondary text-muted-foreground cursor-not-allowed"
                                    )}
                                >
                                    {isProcessing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <XCircle className="h-4 w-4" />
                                    )}
                                    {canCancel ? "Cancel Session (Timeout)" : "Wait for Timeout to Cancel"}
                                </button>
                                {!canCancel && (
                                    <p className="text-xs text-muted-foreground text-center">
                                        Session can be cancelled after 1 hour timeout
                                    </p>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    )
}
