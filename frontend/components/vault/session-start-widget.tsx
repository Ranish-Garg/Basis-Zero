"use client"

import { useState, useEffect, useRef } from "react"
import { Zap, Clock, ArrowRight, Loader2, CheckCircle, AlertCircle, Shield, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { useSessionEscrow, SessionState } from "@/hooks/use-session-escrow"
import { useChainId, useSwitchChain } from "wagmi"
import { polygonAmoy } from "viem/chains"
import { parseUnits, type Hex } from "viem"

type SessionStep = "idle" | "locking" | "notifying" | "success" | "error"

export function SessionStartWidget() {
    const {
        available,
        sessionState,
        startSession,
        isSessionOpenSuccess,
        isOpeningSession,
        notifyBackendSessionStart,
        sessionHash,
        pendingSessionId,
        refetch
    } = useSessionEscrow()

    const chainId = useChainId()
    const { switchChain } = useSwitchChain()

    const [amount, setAmount] = useState("")
    const [safeMode, setSafeMode] = useState(true) // Yield-only mode by default
    const [step, setStep] = useState<SessionStep>("idle")
    const [error, setError] = useState<string | null>(null)
    const [lockedAmount, setLockedAmount] = useState<string | null>(null)
    
    // Store sessionId from startSession call
    const sessionIdRef = useRef<Hex | null>(null)

    const availableNum = parseFloat(available) || 0
    const amountNum = parseFloat(amount) || 0
    const isValidAmount = amountNum > 0 && amountNum <= availableNum
    const hasActiveSession = sessionState === SessionState.Active
    
    const isConnected = !!available

    const handleStartSession = async () => {
        if (!amount || !isValidAmount) return
        setError(null)

        if (chainId !== polygonAmoy.id) {
            switchChain({ chainId: polygonAmoy.id })
            return
        }

        setStep("locking")
        setLockedAmount(amount)
        
        const result = await startSession(amount, safeMode)
        if (result) {
            sessionIdRef.current = result.sessionId
        }
    }

    // After contract call succeeds, notify backend
    useEffect(() => {
        if (isSessionOpenSuccess && step === "locking" && sessionIdRef.current && lockedAmount) {
            setStep("notifying")
            
            const notify = async () => {
                try {
                    await notifyBackendSessionStart(
                        sessionIdRef.current!,
                        lockedAmount,
                        safeMode
                    )
                    setStep("success")
                    refetch()
                } catch (err) {
                    console.error("Backend notification failed:", err)
                    // Session is open on contract, but backend didn't register
                    // User can still trade, just backend tracking might be off
                    setStep("success")
                    refetch()
                }
            }
            notify()
        }
    }, [isSessionOpenSuccess, step, lockedAmount, safeMode, notifyBackendSessionStart, refetch])

    const handleReset = () => {
        setStep("idle")
        setAmount("")
        setLockedAmount(null)
        setError(null)
        sessionIdRef.current = null
    }

    if (!isConnected) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden p-6 text-center">
                <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Connect wallet to start trading</p>
            </div>
        )
    }

    if (hasActiveSession) {
        return (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-green-500/20">
                        <CheckCircle className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-green-400">Session Active</h3>
                        <p className="text-sm text-muted-foreground">
                            Ready to trade on Yellow Network
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    if (step === "success") {
        return (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="font-semibold text-lg text-green-400">Session Started!</h3>
                <p className="text-muted-foreground mt-2">
                    Locked {lockedAmount} USDC for trading
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                    {safeMode ? "Yield-Only Mode: Trade with accrued yield" : "Full Mode: Trade with full balance"}
                </p>
                <button 
                    onClick={handleReset}
                    className="w-full mt-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                    Continue to Trade
                </button>
            </div>
        )
    }

    const isProcessing = step === "locking" || step === "notifying"

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            {/* Header */}
            <div className="p-6 border-b border-border">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                        <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                        <h3 className="font-semibold">Start Trading Session</h3>
                        <p className="text-sm text-muted-foreground">Lock funds to begin trading</p>
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-4">
                {/* Available Balance */}
                <div className="p-4 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">Available Balance</span>
                        <span className="font-mono text-lg font-bold text-primary">
                            ${availableNum.toFixed(2)}
                        </span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                        DEMO: Earning ~5200% APY
                    </div>
                </div>

                {/* Trading Mode Toggle */}
                <div className="p-4 rounded-lg border border-border bg-secondary/20">
                    <p className="text-sm font-medium mb-3">Trading Mode</p>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setSafeMode(true)}
                            disabled={isProcessing}
                            className={cn(
                                "p-3 rounded-lg border text-left transition-all",
                                safeMode 
                                    ? "border-primary bg-primary/10" 
                                    : "border-border hover:border-primary/50"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Shield className="h-4 w-4 text-green-500" />
                                <span className="font-medium text-sm">Yield Only</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Trade with accrued yield, protect principal
                            </p>
                        </button>
                        <button
                            onClick={() => setSafeMode(false)}
                            disabled={isProcessing}
                            className={cn(
                                "p-3 rounded-lg border text-left transition-all",
                                !safeMode 
                                    ? "border-primary bg-primary/10" 
                                    : "border-border hover:border-primary/50"
                            )}
                        >
                            <div className="flex items-center gap-2 mb-1">
                                <Sparkles className="h-4 w-4 text-yellow-500" />
                                <span className="font-medium text-sm">Full Mode</span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Trade with entire locked balance
                            </p>
                        </button>
                    </div>
                </div>

                {/* Amount Input */}
                <div>
                    <div className="flex justify-between text-sm text-muted-foreground mb-2">
                        <label>Amount to Lock</label>
                        <span>Max: ${availableNum.toFixed(2)}</span>
                    </div>
                    <div className="relative">
                        <input
                            type="number"
                            placeholder="0.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            disabled={isProcessing}
                            className="w-full px-4 py-4 pr-24 bg-secondary/50 border border-border rounded-xl text-xl font-mono focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                            <span className="font-mono text-sm text-primary font-bold">USDC</span>
                            <button 
                                onClick={() => setAmount(available)}
                                disabled={isProcessing}
                                className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded disabled:opacity-50"
                            >
                                MAX
                            </button>
                        </div>
                    </div>
                </div>

                {/* Processing State */}
                {isProcessing && (
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                        <div className="flex items-center gap-3">
                            <Loader2 className="h-5 w-5 animate-spin text-primary" />
                            <div className="text-sm">
                                {step === "locking" && "Confirm transaction in wallet..."}
                                {step === "notifying" && "Connecting to Yellow Network..."}
                            </div>
                        </div>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-3 text-red-500">
                            <AlertCircle className="h-5 w-5" />
                            <span className="text-sm">{error}</span>
                        </div>
                    </div>
                )}

                {/* Submit Button */}
                <button
                    onClick={handleStartSession}
                    disabled={!isValidAmount || isProcessing || availableNum === 0}
                    className={cn(
                        "w-full py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2",
                        isValidAmount && !isProcessing
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                            : "bg-secondary text-muted-foreground cursor-not-allowed"
                    )}
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Processing...</span>
                        </>
                    ) : (
                        <>
                            <span>{availableNum === 0 ? "No Balance Available" : "Start Trading Session"}</span>
                            <ArrowRight className="h-5 w-5" />
                        </>
                    )}
                </button>

                {/* Info */}
                <div className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                    <Clock className="h-3 w-3" />
                    Session timeout: 24 hours
                </div>
            </div>
        </div>
    )
}
