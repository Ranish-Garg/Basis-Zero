"use client"

import { useState, useEffect } from "react"
import { ArrowRight, CheckCircle, Loader2, Wallet, AlertCircle, Zap } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAccount, useSwitchChain, useChainId } from "wagmi"
import { polygonAmoy } from "viem/chains"
import { Confetti } from "@/components/ui/confetti"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useSessionEscrow } from "@/hooks/use-session-escrow"

export function DepositWidget() {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const { isConnected } = useAccount()
    const chainId = useChainId()
    const { switchChain } = useSwitchChain()

    const {
        deposit,
        approve,
        isApproving,
        isDepositing,
        isApproveSuccess,
        isDepositSuccess,
        allowance,
        usdcBalance,
        refetch
    } = useSessionEscrow()

    const [amount, setAmount] = useState("")
    const [step, setStep] = useState<"idle" | "approving" | "depositing" | "success" | "error">("idle")
    const [error, setError] = useState<string | null>(null)

    // After approval succeeds, trigger deposit
    useEffect(() => {
        if (isApproveSuccess && step === "approving") {
            setStep("depositing")
            deposit(amount)
        }
    }, [isApproveSuccess, step, amount, deposit])

    // Reset step on deposit success
    useEffect(() => {
        if (isDepositSuccess) {
            setStep("success")
            setAmount("")
            refetch()
        }
    }, [isDepositSuccess, refetch])

    const handleAction = () => {
        if (!amount) return
        setError(null)

        if (chainId !== polygonAmoy.id) {
            switchChain({ chainId: polygonAmoy.id })
            return
        }

        const amountNum = parseFloat(amount)
        const allowanceNum = parseFloat(allowance)

        if (allowanceNum < amountNum) {
            setStep("approving")
            approve(amount)
        } else {
            setStep("depositing")
            deposit(amount)
        }
    }

    const needsApproval = (() => {
        const amountNum = parseFloat(amount) || 0
        const allowanceNum = parseFloat(allowance) || 0
        return allowanceNum < amountNum && amountNum > 0
    })()

    const isWrongChain = chainId !== polygonAmoy.id

    if (!mounted) return (
        <div className="rounded-xl border border-border bg-card/60 glass p-8 text-center h-[400px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )

    if (!isConnected) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass p-8 text-center space-y-4 flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <Wallet className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Connect Wallet</h3>
                <p className="text-muted-foreground max-w-xs">
                    Connect to deposit USDC into the Yield Vault.
                </p>
                <div className="mt-4">
                    <ConnectButton />
                </div>
            </div>
        )
    }

    if (step === "success") {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass p-8 text-center space-y-6">
                <Confetti className="absolute inset-0 pointer-events-none" />
                <div className="flex flex-col items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4 text-green-500">
                        <CheckCircle className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold">Deposit Successful!</h3>
                    <p className="text-muted-foreground mt-2">
                        Your funds are now in the vault earning yield.
                    </p>
                </div>
                <button
                    onClick={() => setStep("idle")}
                    className="w-full py-3 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
                >
                    Make Another Deposit
                </button>
            </div>
        )
    }

    const isProcessing = isApproving || isDepositing
    const buttonText = isWrongChain ? "Switch to Polygon Amoy" :
                       isApproving ? "Approving..." : 
                       isDepositing ? "Depositing..." : 
                       needsApproval ? "Approve USDC" : "Deposit"

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden relative p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <VaultIcon className="h-5 w-5 text-primary" />
                    Vault Deposit
                </h3>
                <div className="px-2 py-1 rounded bg-secondary/50 text-xs font-mono">
                    DEMO APY: ~5200%
                </div>
            </div>

            {/* Chain Badge */}
            <div className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                isWrongChain 
                    ? "border-orange-500/20 bg-orange-500/10" 
                    : "border-purple-500/20 bg-purple-500/10"
            )}>
                <div className="flex items-center gap-2">
                    <Zap className={cn("h-4 w-4", isWrongChain ? "text-orange-500" : "text-purple-500")} />
                    <span className="text-sm font-medium">
                        {isWrongChain ? "Switch to Polygon Amoy" : "Polygon Amoy"}
                    </span>
                </div>
                <div className="text-xs text-muted-foreground">
                    Direct Deposit
                </div>
            </div>

            {/* Input */}
            <div className="space-y-4">
                <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider">
                    <label>Amount (USDC)</label>
                    <span>Wallet: {parseFloat(usdcBalance).toFixed(2)}</span>
                </div>

                <div className="relative">
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 pr-20 font-mono text-xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="font-mono text-sm text-primary font-bold">USDC</span>
                        <button
                            onClick={() => setAmount(usdcBalance)}
                            disabled={isProcessing}
                            className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded disabled:opacity-50"
                        >
                            MAX
                        </button>
                    </div>
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Action Button */}
            <button
                onClick={handleAction}
                disabled={(!amount || parseFloat(amount) <= 0) && !isWrongChain || isProcessing}
                className={cn(
                    "w-full py-4 rounded-xl font-bold text-lg transition-all relative overflow-hidden flex items-center justify-center gap-2",
                    (!amount || parseFloat(amount) <= 0) && !isWrongChain
                        ? "bg-secondary text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
            >
                {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
                {buttonText}
                {!isProcessing && !isWrongChain && <ArrowRight className="h-5 w-5" />}
            </button>

            {/* Footer */}
            <div className="text-center">
                <p className="text-xs text-muted-foreground">
                    Principal Protected • Yield Generating
                </p>
            </div>
        </div>
    )
}

function VaultIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
            <path d="m7.9 7.9 2.7 2.7" />
            <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
            <path d="m13.4 10.6 2.7-2.7" />
            <circle cx="7.5" cy="16.5" r=".5" fill="currentColor" />
            <path d="m7.9 16.1 2.7-2.7" />
            <circle cx="16.5" cy="16.5" r=".5" fill="currentColor" />
            <path d="m13.4 13.4 2.7 2.7" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    )
}
