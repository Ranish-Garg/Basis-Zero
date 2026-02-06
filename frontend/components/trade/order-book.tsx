"use client"

import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { Loader2, Check, AlertCircle, TrendingDown } from "lucide-react"
import { useQuote, usePlaceBet, usePosition, useSellPosition } from "@/hooks/use-amm"
import { Outcome, formatUSDC, parseUSDCInput } from "@/lib/amm-types"
import type { Market, Position } from "@/lib/amm-types"

interface OrderBookProps {
    selectedMarket?: Market | null
    userId?: string
    maxAmount?: string // Max betting amount (locked session amount)
    isSafeMode?: boolean
    onToggleSafeMode?: (enabled: boolean) => void
}

export function OrderBook({ 
    selectedMarket, 
    userId = "demo-user", 
    maxAmount,
    isSafeMode = true,
    onToggleSafeMode 
}: OrderBookProps) {
    const [amount, setAmount] = useState("")
    const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null)
    const [sellingOutcome, setSellingOutcome] = useState<Outcome | null>(null)

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
    
    // Sell position mutation
    const sellMutation = useSellPosition()

    // Reset form when market changes
    useEffect(() => {
        setAmount("")
        setSelectedOutcome(null)
    }, [selectedMarket?.marketId])

    // Check if amount exceeds max
    const maxAmountNum = maxAmount ? parseFloat(maxAmount) : Infinity
    const currentAmountNum = parseFloat(amount) || 0
    const exceedsMax = currentAmountNum > maxAmountNum

    const handleBuy = async (outcome: Outcome) => {
        if (!selectedMarket || !amount || parseFloat(amount) <= 0) return
        if (exceedsMax) return // Don't allow if exceeds max

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

    const handleSell = async (outcome: Outcome, sharesAmount: string) => {
        if (!selectedMarket || !sharesAmount) return
        
        setSellingOutcome(outcome)
        
        try {
            await sellMutation.mutateAsync({
                marketId: selectedMarket.marketId,
                userId,
                amount: sharesAmount,
                outcome,
            })
            setSellingOutcome(null)
        } catch (error) {
            console.error("Failed to sell position:", error)
            setSellingOutcome(null)
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
                        {onToggleSafeMode && (
                            <button
                                onClick={() => onToggleSafeMode(!isSafeMode)}
                                className={cn(
                                    "px-2 py-0.5 rounded text-[10px] font-mono border transition-all",
                                    isSafeMode 
                                        ? "bg-green-500/10 border-green-500 text-green-500" 
                                        : "bg-yellow-500/10 border-yellow-500 text-yellow-500"
                                )}
                            >
                                {isSafeMode ? "SAFE MODE" : "FULL MODE"}
                            </button>
                        )}
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
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
                        <div className="flex justify-between items-center">
                            <label className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                                Amount (USDC)
                            </label>
                            {maxAmount && (
                                <span className="font-mono text-xs text-muted-foreground">
                                    Max: <span className="text-primary">${parseFloat(maxAmount).toFixed(2)}</span>
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                max={maxAmountNum}
                                className={cn(
                                    "w-full rounded-lg border bg-background/50 py-3 pl-7 pr-4 font-mono text-lg focus:outline-none focus:ring-1",
                                    exceedsMax 
                                        ? "border-red-500 focus:border-red-500 focus:ring-red-500" 
                                        : "border-border focus:border-primary focus:ring-primary"
                                )}
                            />
                        </div>
                        {/* Warning when exceeds max */}
                        {exceedsMax && (
                            <p className="text-xs text-red-500 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Exceeds session locked amount
                            </p>
                        )}
                        {/* Quick Amount Buttons */}
                        <div className="flex gap-2">
                            {maxAmount && (
                                <button
                                    onClick={() => setAmount(maxAmount)}
                                    className="flex-1 rounded-md border border-primary/50 bg-primary/10 py-1.5 font-mono text-xs text-primary hover:bg-primary/20 transition-colors"
                                >
                                    MAX
                                </button>
                            )}
                            {[10, 50, 100, 500].filter(v => !maxAmount || v <= parseFloat(maxAmount)).map((val) => (
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
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-3">
                            <p className="font-mono text-xs text-primary uppercase tracking-wider">
                                Your Position
                            </p>
                            <div className="space-y-2">
                                {hasYesShares && (
                                    <div className="flex items-center justify-between p-2 rounded bg-green-500/10 border border-green-500/20">
                                        <div>
                                            <p className="font-mono text-sm font-bold text-green-500">
                                                {formatUSDC(position.yesShares)}
                                            </p>
                                            <p className="font-mono text-[10px] text-muted-foreground">YES shares</p>
                                        </div>
                                        <button
                                            onClick={() => handleSell(Outcome.YES, position.yesShares)}
                                            disabled={sellMutation.isPending && sellingOutcome === Outcome.YES}
                                            className="px-3 py-1.5 rounded text-xs font-mono bg-green-500/20 text-green-500 hover:bg-green-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {sellMutation.isPending && sellingOutcome === Outcome.YES ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3" />
                                            )}
                                            Sell All
                                        </button>
                                    </div>
                                )}
                                {hasNoShares && (
                                    <div className="flex items-center justify-between p-2 rounded bg-red-500/10 border border-red-500/20">
                                        <div>
                                            <p className="font-mono text-sm font-bold text-red-500">
                                                {formatUSDC(position.noShares)}
                                            </p>
                                            <p className="font-mono text-[10px] text-muted-foreground">NO shares</p>
                                        </div>
                                        <button
                                            onClick={() => handleSell(Outcome.NO, position.noShares)}
                                            disabled={sellMutation.isPending && sellingOutcome === Outcome.NO}
                                            className="px-3 py-1.5 rounded text-xs font-mono bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors flex items-center gap-1 disabled:opacity-50"
                                        >
                                            {sellMutation.isPending && sellingOutcome === Outcome.NO ? (
                                                <Loader2 className="h-3 w-3 animate-spin" />
                                            ) : (
                                                <TrendingDown className="h-3 w-3" />
                                            )}
                                            Sell All
                                        </button>
                                    </div>
                                )}
                            </div>
                            
                            {/* Sell success/error feedback */}
                            {sellMutation.isSuccess && (
                                <div className="flex items-center gap-2 text-green-500 text-xs justify-center">
                                    <Check className="h-3 w-3" />
                                    <span>Position sold successfully!</span>
                                </div>
                            )}
                            {sellMutation.isError && (
                                <div className="flex items-center gap-2 text-red-500 text-xs justify-center">
                                    <AlertCircle className="h-3 w-3" />
                                    <span>{sellMutation.error?.message || 'Failed to sell'}</span>
                                </div>
                            )}
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
