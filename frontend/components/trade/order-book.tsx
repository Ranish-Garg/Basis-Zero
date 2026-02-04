"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Loader2, Check, AlertCircle } from "lucide-react"
import { useQuote, usePlaceBet, usePosition } from "@/hooks/use-amm"
import { Outcome, parseUSDCInput, formatUSDC } from "@/lib/amm/types"
import type { Market } from "@/lib/amm/types"

interface OrderBookProps {
    selectedMarket?: Market | null
    userId?: string
}

export function OrderBook({ selectedMarket, userId = "demo-user" }: OrderBookProps) {
    const [amount, setAmount] = useState("")
    const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null)

    // Get quote for the selected amount and outcome
    const usdcAmount = parseUSDCInput(amount)
    const { data: quoteData, isLoading: quoteLoading } = useQuote(
        selectedMarket?.marketId || null,
        usdcAmount,
        selectedOutcome,
        !!selectedMarket && !!amount && parseFloat(amount) > 0
    )

    // Get user's current position
    const { data: positionData } = usePosition(
        selectedMarket?.marketId || null,
        userId
    )

    // Place bet mutation
    const placeBetMutation = usePlaceBet()

    // Reset form when market changes
    useEffect(() => {
        setAmount("")
        setSelectedOutcome(null)
    }, [selectedMarket?.marketId])

    const handleBuy = async (outcome: Outcome) => {
        if (!selectedMarket || !amount || parseFloat(amount) <= 0) return

        setSelectedOutcome(outcome)

        try {
            await placeBetMutation.mutateAsync({
                marketId: selectedMarket.marketId,
                userId,
                amount: usdcAmount,
                outcome,
            })
            setAmount("")
            setSelectedOutcome(null)
        } catch (error) {
            console.error("Failed to place bet:", error)
        }
    }

    const position = positionData?.position
    const hasYesShares = position && Number(position.yesShares) > 0
    const hasNoShares = position && Number(position.noShares) > 0

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden min-w-0">
            {/* Header */}
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                        Trade Panel
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-mono text-xs text-muted-foreground">
                            AMM Pool
                        </span>
                    </div>
                </div>
                {selectedMarket && (
                    <p className="mt-1 text-xs text-muted-foreground truncate max-w-full">
                        {selectedMarket.title}
                    </p>
                )}
            </div>

            {/* Price Display */}
            {selectedMarket ? (
                <div className="p-4 space-y-4">
                    {/* Current Prices */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-center">
                            <p className="font-mono text-2xl font-bold text-green-500">
                                {selectedMarket.prices.yesPrice.toFixed(2)}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                                YES ({selectedMarket.prices.yesProbability.toFixed(0)}%)
                            </p>
                        </div>
                        <div className="rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-center">
                            <p className="font-mono text-2xl font-bold text-red-500">
                                {selectedMarket.prices.noPrice.toFixed(2)}
                            </p>
                            <p className="font-mono text-xs text-muted-foreground">
                                NO ({selectedMarket.prices.noProbability.toFixed(0)}%)
                            </p>
                        </div>
                    </div>

                    {/* Amount Input */}
                    <div className="space-y-2">
                        <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Amount (USDC)
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-lg border border-border bg-background/50 py-3 pl-7 pr-4 font-mono text-lg focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                        </div>
                        {/* Quick Amount Buttons */}
                        <div className="flex gap-2">
                            {[10, 50, 100, 500].map((val) => (
                                <button
                                    key={val}
                                    onClick={() => setAmount(val.toString())}
                                    className="flex-1 rounded-md border border-border bg-secondary/50 py-1.5 font-mono text-xs hover:border-primary/50 hover:bg-secondary transition-colors"
                                >
                                    ${val}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Quote Display */}
                    {quoteLoading && amount && (
                        <div className="flex items-center justify-center py-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            <span className="text-xs">Getting quote...</span>
                        </div>
                    )}
                    {quoteData && !quoteLoading && (
                        <div className="rounded-lg bg-secondary/30 border border-border/50 p-3 space-y-1">
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Est. Shares:</span>
                                <span className="font-mono font-medium">
                                    {(Number(quoteData.expectedShares) / 1_000_000).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Avg. Price:</span>
                                <span className="font-mono font-medium">
                                    ${quoteData.effectivePrice.toFixed(4)}
                                </span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground">Price Impact:</span>
                                <span className={cn(
                                    "font-mono font-medium",
                                    quoteData.priceImpact > 5 ? "text-orange-500" : "text-green-500"
                                )}>
                                    {quoteData.priceImpact.toFixed(2)}%
                                </span>
                            </div>
                        </div>
                    )}

                    {/* User Position */}
                    {position && (hasYesShares || hasNoShares) && (
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                            <p className="font-mono text-xs text-primary uppercase tracking-wider mb-2">
                                Your Position
                            </p>
                            <div className="flex gap-3">
                                {hasYesShares && (
                                    <div className="flex-1 text-center">
                                        <p className="font-mono text-sm font-bold text-green-500">
                                            {formatUSDC(position.yesShares)}
                                        </p>
                                        <p className="font-mono text-[10px] text-muted-foreground">YES shares</p>
                                    </div>
                                )}
                                {hasNoShares && (
                                    <div className="flex-1 text-center">
                                        <p className="font-mono text-sm font-bold text-red-500">
                                            {formatUSDC(position.noShares)}
                                        </p>
                                        <p className="font-mono text-[10px] text-muted-foreground">NO shares</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            ) : (
                <div className="p-8 text-center">
                    <p className="text-sm text-muted-foreground">
                        Select a market to start trading
                    </p>
                </div>
            )}

            {/* Trade Buttons */}
            {selectedMarket && (
                <div className="border-t border-border/50 bg-secondary/30 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => handleBuy(Outcome.YES)}
                            disabled={!amount || parseFloat(amount) <= 0 || placeBetMutation.isPending}
                            className={cn(
                                "py-3 rounded-lg font-mono text-sm font-medium transition-all",
                                "bg-green-500 hover:bg-green-600 text-white",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "flex items-center justify-center gap-2"
                            )}
                        >
                            {placeBetMutation.isPending && selectedOutcome === Outcome.YES ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Buy YES
                        </button>
                        <button
                            onClick={() => handleBuy(Outcome.NO)}
                            disabled={!amount || parseFloat(amount) <= 0 || placeBetMutation.isPending}
                            className={cn(
                                "py-3 rounded-lg font-mono text-sm font-medium transition-all",
                                "bg-red-500 hover:bg-red-600 text-white",
                                "disabled:opacity-50 disabled:cursor-not-allowed",
                                "flex items-center justify-center gap-2"
                            )}
                        >
                            {placeBetMutation.isPending && selectedOutcome === Outcome.NO ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : null}
                            Buy NO
                        </button>
                    </div>

                    {/* Success/Error Messages */}
                    {placeBetMutation.isSuccess && (
                        <div className="flex items-center gap-2 text-green-500 text-xs justify-center">
                            <Check className="h-4 w-4" />
                            <span>Trade executed successfully!</span>
                        </div>
                    )}
                    {placeBetMutation.isError && (
                        <div className="flex items-center gap-2 text-red-500 text-xs justify-center">
                            <AlertCircle className="h-4 w-4" />
                            <span>{placeBetMutation.error?.message || 'Trade failed'}</span>
                        </div>
                    )}

                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                        <span className="font-mono">Instant execution via AMM Pool</span>
                    </div>
                </div>
            )}
        </div>
    )
}
