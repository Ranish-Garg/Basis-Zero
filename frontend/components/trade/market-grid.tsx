"use client"

import Link from "next/link"
import { TrendingUp, Cloud, Bitcoin, Landmark, Users, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

const categories = [
    { id: "all", label: "All Markets", icon: TrendingUp },
    { id: "crypto", label: "Crypto", icon: Bitcoin },
    { id: "sports", label: "Sports", icon: Users },
    { id: "macro", label: "Macro", icon: Landmark },
    { id: "weather", label: "Weather", icon: Cloud },
]

const markets = [
    {
        id: 1,
        category: "crypto",
        title: "BTC > $100K by March 2026?",
        description: "Will Bitcoin exceed $100,000 USD before March 31, 2026?",
        volume: "$234,567",
        yesPrice: "0.72",
        noPrice: "0.28",
        endDate: "Mar 31, 2026",
        participants: 1247,
        trending: true,
    },
    {
        id: 2,
        category: "crypto",
        title: "ETH Flip BTC Market Cap 2026?",
        description: "Will Ethereum's market cap exceed Bitcoin's in 2026?",
        volume: "$89,234",
        yesPrice: "0.18",
        noPrice: "0.82",
        endDate: "Dec 31, 2026",
        participants: 567,
        trending: false,
    },
    {
        id: 3,
        category: "sports",
        title: "Lakers win NBA Championship 2026?",
        description: "Will the Los Angeles Lakers win the 2025-2026 NBA Championship?",
        volume: "$156,789",
        yesPrice: "0.45",
        noPrice: "0.55",
        endDate: "Jun 30, 2026",
        participants: 892,
        trending: true,
    },
    {
        id: 4,
        category: "macro",
        title: "Fed cuts rates before June 2026?",
        description: "Will the Federal Reserve cut interest rates before June 1, 2026?",
        volume: "$312,456",
        yesPrice: "0.68",
        noPrice: "0.32",
        endDate: "Jun 1, 2026",
        participants: 2104,
        trending: true,
    },
    {
        id: 5,
        category: "macro",
        title: "US GDP Growth > 3% Q1 2026?",
        description: "Will US GDP growth exceed 3% in Q1 2026?",
        volume: "$78,123",
        yesPrice: "0.42",
        noPrice: "0.58",
        endDate: "Apr 30, 2026",
        participants: 456,
        trending: false,
    },
    {
        id: 6,
        category: "weather",
        title: "Record high temperature March 2026?",
        description: "Will global average temperature set a new record in March 2026?",
        volume: "$89,012",
        yesPrice: "0.34",
        noPrice: "0.66",
        endDate: "Apr 1, 2026",
        participants: 678,
        trending: false,
    },
]

interface MarketGridProps {
    activeCategory?: string
    onCategoryChange?: (category: string) => void
    onMarketSelect?: (marketId: number) => void
}

export function MarketGrid({
    activeCategory = "all",
    onCategoryChange,
    onMarketSelect
}: MarketGridProps) {
    const filteredMarkets = activeCategory === "all"
        ? markets
        : markets.filter(m => m.category === activeCategory)

    return (
        <div className="space-y-6">
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

            {/* Market Cards Grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredMarkets.map((market, index) => (
                    <button
                        key={market.id}
                        onClick={() => onMarketSelect?.(market.id)}
                        className={cn(
                            "group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-5 glass transition-all duration-400 text-left active:scale-[0.99] hover-lift hover:border-primary/40 hover:bg-card/70 animate-fade-in-up",
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
                                {market.category}
                            </span>
                            <span className="text-border">•</span>
                            <span className="flex items-center gap-1 font-mono text-xs text-muted-foreground">
                                <Users className="h-3 w-3" />
                                {market.participants}
                            </span>
                        </div>

                        {/* Title */}
                        <h4 className="font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                            {market.title}
                        </h4>

                        {/* Description */}
                        <p className="text-xs text-muted-foreground line-clamp-2 mb-4">
                            {market.description}
                        </p>

                        {/* Prices */}
                        <div className="flex gap-2 mb-3">
                            <div className="flex-1 rounded-lg bg-green-500/10 border border-green-500/30 py-2 px-3 text-center">
                                <p className="font-mono text-lg font-bold text-green-500">{market.yesPrice}</p>
                                <p className="font-mono text-[10px] text-muted-foreground">YES</p>
                            </div>
                            <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/30 py-2 px-3 text-center">
                                <p className="font-mono text-lg font-bold text-red-500">{market.noPrice}</p>
                                <p className="font-mono text-[10px] text-muted-foreground">NO</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex items-center justify-between text-xs border-t border-border/50 pt-3">
                            <span className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                {market.endDate}
                            </span>
                            <span className="font-mono text-foreground font-medium">{market.volume}</span>
                        </div>

                        {/* Bottom accent */}
                        <div className="absolute bottom-0 left-0 h-1 w-0 bg-linear-to-r from-primary via-primary/80 to-transparent transition-all duration-500 group-hover:w-full" />
                    </button>
                ))}
            </div>
        </div>
    )
}
