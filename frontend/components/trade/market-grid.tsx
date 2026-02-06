"use client"

import { useState, useEffect } from "react"
import { TrendingUp, Cloud, Bitcoin, Landmark, Users, Clock, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMarkets } from "@/hooks/use-amm"
import { formatUSDC } from "@/lib/amm-types"
import type { Market } from "@/lib/amm-types"
import { useAccount } from "wagmi"
import { ResolveMarketDialog } from "@/components/trade/resolve-market-dialog"

const categories = [
    { id: "all", label: "All Markets", icon: TrendingUp },
    { id: "crypto", label: "Crypto", icon: Bitcoin },
    { id: "sports", label: "Sports", icon: Users },
    { id: "macro", label: "Macro", icon: Landmark },
    { id: "weather", label: "Weather", icon: Cloud },
]

// Fallback mock data for when backend is not available
const mockMarkets: Market[] = [
    {
        marketId: "btc-100k-march-2026",
        title: "BTC > $100K by March 2026?",
        description: "Will Bitcoin exceed $100,000 USD before March 31, 2026?",
        category: "crypto",
        expiresAt: "2026-03-31T00:00:00Z",
        status: "ACTIVE",
        resolutionValue: null,
        yesReserves: "500000000000",
        noReserves: "500000000000",
        totalCollateral: "1000000000000",
        kInvariant: "250000000000000000000000",
        prices: { yesPrice: 0.72, noPrice: 0.28, yesProbability: 72, noProbability: 28 },
        volume: "$234,567",
        participants: 1247,
        trending: true,
    },
    {
        marketId: "eth-flip-btc-2026",
        title: "ETH Flip BTC Market Cap 2026?",
        description: "Will Ethereum's market cap exceed Bitcoin's in 2026?",
        category: "crypto",
        expiresAt: "2026-12-31T00:00:00Z",
        status: "ACTIVE",
        resolutionValue: null,
        yesReserves: "500000000000",
        noReserves: "500000000000",
        totalCollateral: "1000000000000",
        kInvariant: "250000000000000000000000",
        prices: { yesPrice: 0.18, noPrice: 0.82, yesProbability: 18, noProbability: 82 },
        volume: "$89,234",
        participants: 567,
        trending: false,
    },
    {
        marketId: "fed-rate-cut-june-2026",
        title: "Fed cuts rates before June 2026?",
        description: "Will the Federal Reserve cut interest rates before June 1, 2026?",
        category: "macro",
        expiresAt: "2026-06-01T00:00:00Z",
        status: "ACTIVE",
        resolutionValue: null,
        yesReserves: "500000000000",
        noReserves: "500000000000",
        totalCollateral: "1000000000000",
        kInvariant: "250000000000000000000000",
        prices: { yesPrice: 0.68, noPrice: 0.32, yesProbability: 68, noProbability: 32 },
        volume: "$312,456",
        participants: 2104,
        trending: true,
    },
]

interface MarketGridProps {
    activeCategory?: string
    onCategoryChange?: (category: string) => void
    onMarketSelect?: (marketId: string) => void
}

export function MarketGrid({
    activeCategory = "all",
    onCategoryChange,
    onMarketSelect
}: MarketGridProps) {
    const { data, isLoading, error } = useMarkets()
    const [useFallback, setUseFallback] = useState(false)
    const { address } = useAccount()
    const [resolvingMarket, setResolvingMarket] = useState<Market | null>(null)

    const canResolve = (market: Market) => {
        if (market.status !== 'ACTIVE') return false
        if (!address) return false

        // Manual resolution
        if (market.resolutionType === 'manual' && market.resolverAddress) {
            return market.resolverAddress.toLowerCase() === address.toLowerCase()
        }

        return false
    }

    // Use fallback data if API fails
    useEffect(() => {
        if (error) {
            setUseFallback(true)
        }
    }, [error])

    const markets = useFallback ? mockMarkets : (data?.markets || mockMarkets)

    const filteredMarkets = activeCategory === "all"
        ? markets
        : markets.filter(m => m.category === activeCategory)

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            })
        } catch {
            return dateString
        }
    }

    return (
        <div className="space-y-6 overflow-hidden">
            {/* Category Filters */}
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap scrollbar-hide">
                {categories.map((cat) => (
                    <button
                        key={cat.id}
                        onClick={() => onCategoryChange?.(cat.id)}
                        className={cn(
                            "shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2.5 font-mono text-xs uppercase tracking-wider transition-all duration-300 active:scale-[0.98]",
                            activeCategory === cat.id
                                ? "border-primary bg-primary/15 text-primary shadow-sm shadow-primary/20"
                                : "border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground hover:bg-secondary/50",
                        )}
                    >
                        <cat.icon className="h-3.5 w-3.5" />
                        {cat.label}
                    </button>
                ))}
            </div>

            {/* Loading State */}
            {isLoading && !useFallback && (
                <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-3 text-muted-foreground">Loading markets...</span>
                </div>
            )}

            {/* Error State with Fallback Notice */}
            {useFallback && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-600 dark:text-yellow-400 text-xs">
                    <AlertCircle className="h-4 w-4" />
                    <span>Using demo data. Start the backend to see live markets.</span>
                </div>
            )}

            {/* Market Cards Grid */}
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                {filteredMarkets.map((market, index) => (
                    <div
                        key={market.marketId}
                        role="button"
                        tabIndex={0}
                        onClick={() => onMarketSelect?.(market.marketId)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onMarketSelect?.(market.marketId); } }}
                        className={cn(
                            "group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-5 glass transition-all duration-400 text-left active:scale-[0.99] hover-lift hover:border-primary/40 hover:bg-card/70 animate-fade-in-up cursor-pointer",
                        )}
                        style={{ animationDelay: `${index * 50}ms` }}
                    >
                        {/* Trending Badge */}
                        {market.trending && (
                            <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded-full bg-orange-500/20 border border-orange-500/30">
                                <TrendingUp className="h-3 w-3 text-orange-500" />
                                <span className="font-mono text-[10px] text-orange-500 uppercase">Hot</span>
                            </div>
                        )}

                        {/* Category */}
                        <div className="flex items-center gap-2 mb-3">
                            <span className="font-mono text-xs text-primary uppercase tracking-wider">
                                {market.category || 'general'}
                            </span>
                            {market.participants && (
                                <>
                                    <span className="text-border">•</span>
                                    <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                                        <Users className="h-3 w-3" />
                                        {market.participants}
                                    </span>
                                </>
                            )}
                        </div>

                        {/* Title */}
                        <h4 className="font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2 warp-break-word">
                            {market.title}
                        </h4>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                            {market.description}
                        </p>

                        {/* Prices */}
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1 rounded-lg bg-green-500/10 border border-green-500/30 py-2 px-3 text-center">
                                <p className="font-mono text-lg font-bold text-green-500">
                                    {market.prices.yesPrice.toFixed(2)}
                                </p>
                                <p className="font-mono text-[10px] text-muted-foreground">YES</p>
                            </div>
                            <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/30 py-2 px-3 text-center">
                                <p className="font-mono text-lg font-bold text-red-500">
                                    {market.prices.noPrice.toFixed(2)}
                                </p>
                                <p className="font-mono text-[10px] text-muted-foreground">NO</p>
                            </div>
                        </div>

                        {/* Footer */}
                        {/* Footer */}
                        <div className="flex items-center justify-between text-xs border-t border-border/50 pt-3 h-10">
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {formatDate(market.expiresAt)}
                            </span>

                            {canResolve(market) ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation()
                                        setResolvingMarket(market)
                                    }}
                                    className="z-10 px-3 py-1 rounded-md bg-yellow-500/90 text-black font-bold text-[10px] uppercase hover:bg-yellow-400 transition-all shadow-sm hover:shadow-md hover:scale-105"
                                >
                                    Resolve
                                </button>
                            ) : (
                                <span className="font-mono text-foreground font-medium truncate">
                                    {market.volume || formatUSDC(market.totalCollateral)}
                                </span>
                            )}
                        </div>

                        {/* Bottom accent */}
                        <div className="absolute bottom-0 left-0 h-1 w-0 bg-linear-to-r from-primary via-primary/80 to-transparent transition-all duration-500 group-hover:w-full" />
                    </div>
                ))}
            </div>

            {/* Empty State */}
            {filteredMarkets.length === 0 && !isLoading && (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                    <TrendingUp className="h-12 w-12 text-muted-foreground/50 mb-4" />
                    <p className="text-muted-foreground">No markets found in this category.</p>
                </div>
            )}

            {/* Resolve Dialog */}
            {resolvingMarket && (
                <ResolveMarketDialog
                    isOpen={!!resolvingMarket}
                    onClose={() => setResolvingMarket(null)}
                    market={resolvingMarket}
                />
            )}
        </div>
    )
}
