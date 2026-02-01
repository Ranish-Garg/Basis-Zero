"use client"

import { useState } from "react"
import { ArrowRight, CheckCircle, Circle, Wallet, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

const chains = [
    { id: "ethereum", name: "Ethereum", icon: "🔷", fee: "~$5.00" },
    { id: "base", name: "Base", icon: "🔵", fee: "~$0.10" },
    { id: "arbitrum", name: "Arbitrum", icon: "🔶", fee: "~$0.30" },
    { id: "polygon", name: "Polygon", icon: "🟣", fee: "~$0.05" },
    { id: "optimism", name: "Optimism", icon: "🔴", fee: "~$0.20" },
]

export function DepositWidget() {
    const [selectedChain, setSelectedChain] = useState(chains[1]) // Default to Base
    const [amount, setAmount] = useState("")
    const [step, setStep] = useState(1)
    const [isDropdownOpen, setIsDropdownOpen] = useState(false)

    const handleDeposit = () => {
        if (step < 3) {
            setStep(step + 1)
        }
    }

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            {/* Header */}
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-primary" />
                        <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                            Cross-Chain Deposit
                        </h3>
                    </div>
                    <span className="font-mono text-[10px] text-muted-foreground">
                        Powered by Circle Arc
                    </span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={cn(
                                "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
                                step >= s ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"
                            )}>
                                {step > s ? (
                                    <CheckCircle className="h-4 w-4" />
                                ) : (
                                    <span className="font-mono text-xs">{s}</span>
                                )}
                            </div>
                            {s < 3 && (
                                <div className={cn(
                                    "h-0.5 w-8",
                                    step > s ? "bg-primary" : "bg-border"
                                )} />
                            )}
                        </div>
                    ))}
                </div>

                {/* Step 1: Select Chain */}
                {step === 1 && (
                    <div className="space-y-4">
                        <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Source Chain
                        </label>
                        <div className="relative">
                            <button
                                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                className="w-full flex items-center justify-between rounded-lg border border-border bg-secondary/50 px-4 py-3 text-left hover:border-primary/50 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-xl">{selectedChain.icon}</span>
                                    <div>
                                        <p className="font-medium">{selectedChain.name}</p>
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
                                            <span className="text-xl">{chain.icon}</span>
                                            <div className="flex-1">
                                                <p className="font-medium">{chain.name}</p>
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
                )}

                {/* Step 2: Enter Amount */}
                {step === 2 && (
                    <div className="space-y-4">
                        <label className="block font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Deposit Amount (USDC)
                        </label>
                        <div className="relative">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-4 pr-20 font-mono text-2xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                <span className="font-mono text-sm text-muted-foreground">USDC</span>
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>Available: 25,000.00 USDC</span>
                            <button
                                onClick={() => setAmount("25000")}
                                className="text-primary hover:underline"
                            >
                                MAX
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 3: Confirm */}
                {step === 3 && (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 space-y-3">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">From</span>
                                <span className="font-medium">{selectedChain.name}</span>
                            </div>
                            <div className="flex items-center justify-center">
                                <ArrowRight className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">To</span>
                                <span className="font-medium">Basis Zero Vault</span>
                            </div>
                            <div className="border-t border-border/50 pt-3 flex items-center justify-between">
                                <span className="text-muted-foreground">Amount</span>
                                <span className="font-mono font-bold text-lg">${Number(amount).toLocaleString()} USDC</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">Est. Fee</span>
                                <span>{selectedChain.fee}</span>
                            </div>
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                            Your USDC will be deposited into the RWA yield vault, earning 5.12% APY
                        </p>
                    </div>
                )}

                {/* Action Button */}
                <button
                    onClick={handleDeposit}
                    disabled={step === 2 && !amount}
                    className={cn(
                        "w-full py-4 rounded-lg font-mono text-sm font-medium transition-all",
                        step === 3
                            ? "bg-green-500 hover:bg-green-600 text-white"
                            : "bg-primary hover:bg-primary/90 text-primary-foreground",
                        step === 2 && !amount && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {step === 1 && "Continue"}
                    {step === 2 && "Review Deposit"}
                    {step === 3 && "Confirm Deposit"}
                </button>

                {step > 1 && (
                    <button
                        onClick={() => setStep(step - 1)}
                        className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
                    >
                        ← Back
                    </button>
                )}
            </div>
        </div>
    )
}
