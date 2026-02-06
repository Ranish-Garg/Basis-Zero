"use client"

import { useState, useEffect } from "react"
import { Wifi, WifiOff, Zap, Clock, RefreshCw, Loader2, XCircle, AlertTriangle, ExternalLink, CheckCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSessionEscrow, SessionState } from "@/hooks/use-session-escrow"
import { useWriteContract, useWaitForTransactionReceipt, useAccount } from "wagmi"
import { SESSION_ESCROW_ADDRESS, SESSION_ESCROW_ABI } from "@/lib/contracts"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"

// Fetch user positions
async function fetchUserPositions(userId: string) {
    if (!userId) return { positions: [], totalValue: '0' };
    const response = await fetch(`/api/amm/positions/${userId}`);
    if (!response.ok) return { positions: [], totalValue: '0' };
    return response.json();
}

export function SessionManager() {
    const { 
        sessionState, 
        locked, 
        activeSessionId: sessionId, 
        closeSession,
        recoverSession,
        refetch 
    } = useSessionEscrow()
    
    const { address } = useAccount()
    
    // UI State
    const [showCloseModal, setShowCloseModal] = useState(false)
    
    // Fetch positions to check if user can close directly
    const { data: positionsData, refetch: refetchPositions } = useQuery({
        queryKey: ['user-positions', sessionId],
        queryFn: () => fetchUserPositions(sessionId || ''),
        enabled: !!sessionId,
    })
    
    const totalPositionsValue = parseFloat(positionsData?.totalValue || '0') / 1_000_000
    const hasPositions = totalPositionsValue > 0
    
    const lockedAmountNum = parseFloat(locked) || 0
    
    // Contract: settleSession
    const { writeContract: writeSettle, data: settleHash, isPending: isSettling } = useWriteContract()
    const { isLoading: isWaitingSettle, isSuccess: isSettleSuccess } = useWaitForTransactionReceipt({ hash: settleHash })
    
    // Contract: timeoutRelease
    const { writeContract: writeCancelSession, data: cancelHash, isPending: isCancelling } = useWriteContract()
    const { isLoading: isWaitingCancel, isSuccess: isCancelSuccess } = useWaitForTransactionReceipt({ hash: cancelHash })

    // State for backend close session API
    const [isClosingViaBackend, setIsClosingViaBackend] = useState(false)
    const [closeError, setCloseError] = useState<string | null>(null)
    const [closeSuccess, setCloseSuccess] = useState(false)
    const [settlementData, setSettlementData] = useState<{ pnl: string; signature: string } | null>(null)

    // Refetch after settlement or cancel
    useEffect(() => {
        if (isCancelSuccess || isSettleSuccess) {
            refetch()
            refetchPositions()
            setShowCloseModal(false)
            setCloseSuccess(true)
        }
    }, [isCancelSuccess, isSettleSuccess, refetch, refetchPositions])

    const isSessionActive = sessionState === SessionState.Active
    
    const getSessionLabel = () => {
        switch (sessionState) {
            case SessionState.None: return "No Session"
            case SessionState.Active: return "Active"
            case SessionState.Settled: return "Settled"
            default: return "Unknown"
        }
    }

    // Step 1: Get signature from backend
    const handleCloseSession = async () => {
        if (!sessionId) return
        
        setIsClosingViaBackend(true)
        setCloseError(null)
        setCloseSuccess(false)
        
        try {
            // Call backend to calculate PnL and get signature
            const result = await closeSession()
            
            if (result?.signature && result?.pnl !== undefined) {
                setSettlementData({
                    pnl: result.pnl,
                    signature: result.signature
                })
                
                // Step 2: Submit to contract
                const pnlBigInt = BigInt(result.pnl)
                
                writeSettle({
                    address: SESSION_ESCROW_ADDRESS,
                    abi: SESSION_ESCROW_ABI,
                    functionName: "settleSession",
                    args: [sessionId, pnlBigInt, [result.signature]]
                })
            } else {
                throw new Error("Failed to get settlement signature")
            }
        } catch (error) {
            console.error('Close session error:', error)
            setCloseError(error instanceof Error ? error.message : 'Failed to close session')
            setIsClosingViaBackend(false)
        }
    }

    const handleTimeoutRelease = () => {
        if (!sessionId) return
        
        writeCancelSession({
            address: SESSION_ESCROW_ADDRESS,
            abi: SESSION_ESCROW_ABI,
            functionName: "timeoutRelease",
            args: [sessionId]
        })
    }

    // Recover session logic
    const handleRecoverSession = async () => {
        if (!sessionId) return
        
        setIsClosingViaBackend(true) // Reuse loading state
        setCloseError(null)
        setCloseSuccess(false)
        
        try {
            const result = await recoverSession?.() // Optional call
            if (result && result.recovered) {
                setCloseSuccess(true) // Show success message (customized below)
                // Just close modal after short delay or let user see success
                setTimeout(() => {
                    setShowCloseModal(false)
                    setCloseSuccess(false)
                    refetch()
                }, 2000)
            }
        } catch (error) {
            console.error('Recover session error:', error)
            setCloseError(error instanceof Error ? error.message : 'Failed to recover session')
        } finally {
            setIsClosingViaBackend(false)
        }
    }

    const isProcessing = isCancelling || isWaitingCancel || isClosingViaBackend || isSettling || isWaitingSettle

    // Format PnL for display
    const formatPnL = (pnlStr: string) => {
        const pnl = Number(pnlStr) / 1_000_000
        const sign = pnl >= 0 ? '+' : ''
        return `${sign}$${pnl.toFixed(2)}`
    }

    return (
        <>
            <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
                {/* Header */}
                <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Zap className="h-4 w-4 text-primary" />
                            <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                                Trading Session
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
                    {/* Session Stats */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 rounded-lg bg-secondary/30">
                            <p className="font-mono text-xl font-bold text-foreground">
                                {isSessionActive ? 1 : 0}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground uppercase">Active</p>
                        </div>
                        <div className="text-center p-3 rounded-lg bg-secondary/30">
                            <p className="font-mono text-xl font-bold text-primary">
                                ${lockedAmountNum.toFixed(2)}
                            </p>
                            <p className="font-mono text-[10px] text-muted-foreground uppercase">Locked</p>
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
                                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-500">
                                        {getSessionLabel()}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-sm">
                                    <span className="text-muted-foreground">Locked Amount</span>
                                    <span className="font-mono">${lockedAmountNum.toFixed(2)}</span>
                                </div>
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

                    {/* Close Session Button */}
                    {isSessionActive && (
                        <div className="space-y-2">
                            <button 
                                onClick={() => setShowCloseModal(true)}
                                className="w-full py-3 rounded-lg font-mono text-sm border border-orange-500/20 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 transition-colors flex items-center justify-center gap-2"
                            >
                                <XCircle className="h-4 w-4" />
                                Close Session
                            </button>
                            
                            <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                                <Clock className="h-3 w-3" />
                                Session auto-closes in 24h
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Close Session Modal */}
            {showCloseModal && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                    <div className="bg-card border border-border rounded-xl max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="h-6 w-6 text-orange-500" />
                            <h3 className="text-lg font-bold">Close Trading Session</h3>
                        </div>
                        
                        <div className="space-y-4 text-sm">
                            {closeSuccess ? (
                                <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                                    <p className="text-green-500 font-medium">Session Settled!</p>
                                    {settlementData && (
                                        <p className="text-sm mt-1">
                                            PnL: <span className={cn(
                                                "font-mono font-bold",
                                                Number(settlementData.pnl) >= 0 ? "text-green-500" : "text-red-500"
                                            )}>
                                                {formatPnL(settlementData.pnl)}
                                            </span>
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground mt-2">Your funds have been unlocked.</p>
                                </div>
                            ) : !hasPositions ? (
                                // No positions - can close directly
                                <>
                                    <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle className="h-5 w-5 text-green-500" />
                                            <p className="font-medium text-green-500">Ready to Close</p>
                                        </div>
                                        <p className="text-sm text-muted-foreground">
                                            You have no open positions. Close now to settle and unlock your funds.
                                        </p>
                                    </div>
                                    
                                    <button 
                                        onClick={handleCloseSession}
                                        disabled={isProcessing}
                                        className="w-full py-3 rounded-lg font-mono text-sm bg-green-600 text-white hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                    >
                                        {isProcessing ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                {isSettling || isWaitingSettle ? "Settling..." : "Getting signature..."}
                                            </>
                                        ) : (
                                            <>
                                                <CheckCircle className="h-4 w-4" />
                                                Close & Settle Session
                                            </>
                                        )}
                                    </button>
                                    
                                    {closeError && (
                                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                                            <p className="text-sm text-red-500">{closeError}</p>
                                        </div>
                                    )}
                                </>
                            ) : (
                                // Has positions - show sell first instructions
                                <>
                                    <p className="text-muted-foreground">
                                        Your session is <span className="text-green-500 font-medium">Active</span> with 
                                        <span className="text-orange-500 font-medium"> ${totalPositionsValue.toFixed(2)}</span> in open positions.
                                    </p>
                                    
                                    <div className="p-4 rounded-lg bg-secondary/30 space-y-3">
                                        <div className="flex items-start gap-3">
                                            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">1</span>
                                            <div>
                                                <p className="font-medium">Sell your positions</p>
                                                <p className="text-xs text-muted-foreground">Go to Trade page and sell all open positions</p>
                                            </div>
                                        </div>
                                        <div className="flex items-start gap-3">
                                            <span className="flex-shrink-0 h-5 w-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-bold">2</span>
                                            <div>
                                                <p className="font-medium">Close session</p>
                                                <p className="text-xs text-muted-foreground">Return here to settle and unlock funds</p>
                                            </div>
                                        </div>
                                    </div>

                                    <Link 
                                        href="/trade"
                                        className="w-full py-3 rounded-lg font-mono text-sm bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                        Go to Trade Page
                                    </Link>
                                </>
                            )}
                            
                            {/* Emergency Release */}
                            {!closeSuccess && (
                                <div className="border-t border-border/50 pt-4 mt-4 space-y-2">
                                    <p className="text-xs text-muted-foreground mb-2">Emergency Options:</p>
                                    
                                    <button 
                                        onClick={handleRecoverSession}
                                        disabled={isProcessing}
                                        className="w-full py-2 rounded-lg font-mono text-xs border border-blue-500/20 text-blue-500 hover:bg-blue-500/10 transition-colors"
                                    >
                                        Recover Session (If Backend Sync Issues)
                                    </button>

                                    <button 
                                        onClick={handleTimeoutRelease}
                                        disabled={isProcessing}
                                        className="w-full py-2 rounded-lg font-mono text-xs border border-red-500/20 text-red-500 hover:bg-red-500/10 transition-colors"
                                    >
                                        Force Timeout Release (After 24h)
                                    </button>
                                </div>
                            )}
                        </div>



                        <button 
                            onClick={() => {
                                setShowCloseModal(false)
                                setCloseError(null)
                                setCloseSuccess(false)
                                setSettlementData(null)
                            }}
                            className="w-full py-2 rounded-lg font-mono text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            Close Modal
                        </button>
                    </div>
                </div>
            )}
        </>
    )
}
