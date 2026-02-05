"use client"

import { useState, useEffect } from "react"
import { Zap, Clock, ArrowRight, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useArcVault, SessionState } from "@/hooks/use-arc-vault"
import { useChainId, useSwitchChain } from "wagmi"
import { arcTestnet } from "@/lib/wagmi"

type SessionStep = "idle" | "locking" | "success" | "error"

export function SessionStartWidget() {
    const {
        totalBalance,
        sessionState,
        isConnected,
        apyPercent,
        startSession,
        isSessionStartSuccess,
        startSessionError,
        refetch
    } = useArcVault()

    const chainId = useChainId()
    const { switchChain } = useSwitchChain()

    const [amount, setAmount] = useState("")
    const [step, setStep] = useState<SessionStep>("idle")
    const [error, setError] = useState<string | null>(null)
    const [lockedAmount, setLockedAmount] = useState<string | null>(null)

    const availableNum = parseFloat(totalBalance) || 0
    const amountNum = parseFloat(amount) || 0
    const isValidAmount = amountNum > 0 && amountNum <= availableNum
    const hasActiveSession = sessionState !== SessionState.None

    // Handle chain switch if needed
    const handleStartSession = async () => {
        if (!isConnected || !amount || !isValidAmount) return
        setError(null)

        if (chainId !== arcTestnet.id) {
            switchChain({ chainId: arcTestnet.id })
            return
        }

        setStep("locking")
        setLockedAmount(amount)
        await startSession(amount, true)
    }

    // After contract call succeeds
    useEffect(() => {
        if (isSessionStartSuccess && step === "locking") {
            setStep("success")
            refetch()
        }
    }, [isSessionStartSuccess, step])

    // Handle contract errors
    useEffect(() => {
        if (startSessionError) {
            setError(startSessionError.message || "Transaction failed")
            setStep("error")
        }
    }, [startSessionError])

    // Reset after success
    const handleReset = () => {
        setStep("idle")
        setAmount("")
        setLockedAmount(null)
        setError(null)
    }

    // Not connected state
    if (!isConnected) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden p-6 text-center">
                <Zap className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                <p className="text-muted-foreground">Connect wallet to start trading</p>
            </div>
        )
    }

    // Already has session
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
                            {sessionState === SessionState.PendingBridge ? "Waiting for confirmation..." : "Ready to trade"}
                        </p>
                    </div>
                </div>
            </div>
        )
    }

    // Success state
    if (step === "success") {
        return (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-6 text-center">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <h3 className="font-semibold text-lg text-green-400">Session Started!</h3>
                <p className="text-muted-foreground mt-2">
                    Locked {lockedAmount} USDC for trading
                </p>
                <button 
                    onClick={handleReset}
                    className="w-full mt-4 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium transition-colors"
                >
                    Continue
                </button>
            </div>
        )
    }

    // Error state
    if (step === "error") {
        return (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 text-center">
                <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                <h3 className="font-semibold text-lg text-red-400">Error</h3>
                <p className="text-muted-foreground mt-2 text-sm">{error}</p>
                <button 
                    onClick={handleReset}
                    className="w-full mt-4 py-3 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
                >
                    Try Again
                </button>
            </div>
        )
    }

    const isProcessing = step === "locking"

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
                        Earning {apyPercent}% APY
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
                                onClick={() => setAmount(totalBalance)}
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
                            <div className="text-sm">Confirm transaction in wallet...</div>
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
                    Session timeout: 1 hour
                </div>
            </div>
        </div>
    )
}
