"use client"

import { useState } from "react"
import { ArrowUpRight, ChevronDown, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"

const chains = [
    { id: "ethereum", name: "Ethereum", icon: "🔷", fee: "~$5.00" },
    { id: "base", name: "Base", icon: "🔵", fee: "~$0.10" },
    { id: "arbitrum", name: "Arbitrum", icon: "🔶", fee: "~$0.30" },
    { id: "polygon", name: "Polygon", icon: "🟣", fee: "~$0.05" },
    { id: "optimism", name: "Optimism", icon: "🔴", fee: "~$0.20" },
]

interface WithdrawalWidgetProps {
    availableBalance?: number
}

export function WithdrawalWidget({ availableBalance = 10042.35 }: WithdrawalWidgetProps) {
    const [selectedChain, setSelectedChain] = useState(chains[1])
    const [amount, setAmount] = useState("")
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)
    const [isProcessing, setIsProcessing] = useState(false)

    const handleWithdraw = () => {
        setIsProcessing(true)
        // Simulate processing
        setTimeout(() => setIsProcessing(false), 2000)
    }

    const withdrawAmount = parseFloat(amount) || 0
    const isValidAmount = withdrawAmount > 0 && withdrawAmount <= availableBalance

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            {/* Header */}
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4 text-primary" />
                        <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                            Withdraw
                        </h3>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                        Circle CCTP
                    </span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Available Balance */}
                <div className="rounded-lg bg-secondary/30 p-4">
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Available to Withdraw
                    </p>
                    <p className="font-mono text-2xl font-bold">
                        ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                </div>

                {/* Amount Input */}
                <div className="space-y-2">
                    <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider">
                        Withdrawal Amount
                    </label>
                    <div className="relative">
                        <input
                            type="number"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 pr-20 font-mono text-xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                            <span className="font-mono text-sm text-muted-foreground">USDC</span>
                        </div>
                    </div>
                    <div className="flex items-center justify-end">
                        <button
                            onClick={() => setAmount(availableBalance.toString())}
                            className="text-xs text-primary hover:underline"
                        >
                            Withdraw Max
                        </button>
                    </div>
                </div>

                {/* Destination Chain */}
                <div className="space-y-2">
                    <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider">
                        Destination Chain
                    </label>
                    <div className="relative">
                        <button
                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="w-full flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-4 py-3 text-left hover:border-primary/50 transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-lg">{selectedChain.icon}</span>
                                <div>
                                    <p className="font-medium text-sm">{selectedChain.name}</p>
                                    <p className="text-xs text-muted-foreground">Est. fee: {selectedChain.fee}</p>
                                </div>
                            </div>
                            <ChevronDown className={cn(
                                "h-4 w-4 text-muted-foreground transition-transform",
                                isDropdownOpen && "rotate-180"
                            )} />
                        </button>

                        {isDropdownOpen && (
                            <div className="absolute top-full left-0 right-0 mt-2 rounded-lg border border-border bg-card shadow-lg z-10">
                                {chains.map((chain) => (
                                    <button
                                        key={chain.id}
                                        onClick={() => {
                                            setSelectedChain(chain)
                                            setIsDropdownOpen(false)
                                        }}
                                        className={cn(
                                            "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/50 transition-colors first:rounded-t-lg last:rounded-b-lg",
                                            selectedChain.id === chain.id && "bg-primary/10"
                                        )}
                                    >
                                        <span className="text-lg">{chain.icon}</span>
                                        <div className="flex-1">
                                            <p className="font-medium text-sm">{chain.name}</p>
                                            <p className="text-xs text-muted-foreground">Est. fee: {chain.fee}</p>
                                        </div>
                                        {selectedChain.id === chain.id && (
                                            <CheckCircle className="h-4 w-4 text-primary" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Summary */}
                {withdrawAmount > 0 && (
                    <div className="rounded-lg border border-border/50 bg-secondary/20 p-4 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">You will receive</span>
                            <span className="font-mono font-medium">${withdrawAmount.toLocaleString()} USDC</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Network fee</span>
                            <span className="font-mono">{selectedChain.fee}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Destination</span>
                            <span className="font-mono">{selectedChain.name}</span>
                        </div>
                    </div>
                )}

                {/* Warning for principal withdrawal */}
                {withdrawAmount > 42.35 && (
                    <div className="flex items-start gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
                        <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                        <p className="text-xs text-yellow-200">
                            This withdrawal includes principal. Your future yield earnings will be reduced.
                        </p>
                    </div>
                )}

                {/* Withdraw Button */}
                <button
                    onClick={handleWithdraw}
                    disabled={!isValidAmount || isProcessing}
                    className={cn(
                        "w-full py-4 rounded-lg font-mono text-sm font-medium transition-all",
                        isValidAmount
                            ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                            : "bg-secondary text-muted-foreground cursor-not-allowed"
                    )}
                >
                    {isProcessing ? "Processing..." : "Withdraw to " + selectedChain.name}
                </button>
            </div>
        </div>
    )
}
