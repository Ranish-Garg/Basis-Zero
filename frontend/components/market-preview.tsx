"use client"

import Link from "next/link"
import { TrendingUp, Cloud, Bitcoin, Landmark } from "lucide-react"
import { cn } from "@/lib/utils"

const markets = [
    {
        id: 1,
        category: "Crypto",
        icon: Bitcoin,
        title: "BTC > $100K by March 2026?",
        volume: "$234K",
        yesPrice: "0.72",
        noPrice: "0.28",
        color: "from-orange-500 to-amber-500",
        participants: 1247,
    },
    {
        id: 2,
        category: "Sports",
        icon: TrendingUp,
        title: "Lakers win NBA Championship 2026?",
        volume: "$156K",
        yesPrice: "0.45",
        noPrice: "0.55",
        color: "from-purple-500 to-pink-500",
        participants: 892,
    },
    {
        id: 3,
        category: "Macro",
        icon: Landmark,
        title: "Fed cuts rates before June 2026?",
        volume: "$312K",
        yesPrice: "0.68",
        noPrice: "0.32",
        color: "from-blue-500 to-cyan-500",
        participants: 2104,
    },
    {
        id: 4,
        category: "Weather",
        icon: Cloud,
        title: "Record high temperature March 2026?",
        volume: "$89K",
        yesPrice: "0.34",
        noPrice: "0.66",
        color: "from-green-500 to-emerald-500",
        participants: 456,
    },
]

export function MarketPreview() {
    return (
        <section id="markets" className="px-4 sm:px-6 py-20 sm:py-28">
            <div className="mx-auto max-w-7xl">
                <div className="mb-10 sm:mb-14 flex flex-col gap-6 sm:gap-8 sm:flex-row sm:items-end sm:justify-between">
                    <div className="space-y-3 animate-fade-in-up">
                        <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">
                            Markets
                        </p>
                        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                            Trending Predictions
                        </h2>
                        <p className="max-w-xl text-base text-muted-foreground">
                            Trade using only your accrued yield. Principal stays protected in RWAs.
                        </p>
                    </div>

                    <Link
                        href="/trade"
                        className="group inline-flex items-center gap-2 font-mono text-sm text-primary hover:text-foreground transition-colors animate-fade-in-up stagger-2"
                    >
                        <span className="underline-animate">View All Markets</span>
                        <span className="transition-transform group-hover:translate-x-1">→</span>
                    </Link>
                </div>

                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                    {markets.map((market, index) => (
                        <Link
                            key={market.id}
                            href="/trade"
                            className={cn(
                                "group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-6 glass transition-all duration-400 active:scale-[0.99] hover-lift hover:border-primary/40 hover:bg-card/70 animate-fade-in-up",
                            )}
                            style={{ animationDelay: `${index * 100 + 200}ms` }}
                        >
                            {/* Category badge */}
                            <div className="flex items-center justify-between mb-4">
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-full bg-linear-to-r text-white text-xs font-medium",
                                    market.color
                                )}>
                                    <market.icon className="h-3.5 w-3.5" />
                                    {market.category}
                                </div>
                                <span className="font-mono text-xs text-muted-foreground">
                                    {market.participants.toLocaleString()} traders
                                </span>
                            </div>

                            {/* Title */}
                            <h3 className="mb-4 font-semibold tracking-tight text-foreground transition-colors group-hover:text-primary line-clamp-2 min-h-[48px]">
                                {market.title}
                            </h3>

                            {/* Prices */}
                            <div className="flex gap-2 mb-4">
                                <div className="flex-1 rounded-lg bg-green-500/10 border border-green-500/30 p-3 text-center">
                                    <p className="font-mono text-lg font-bold text-green-500">{market.yesPrice}</p>
                                    <p className="font-mono text-xs text-muted-foreground">YES</p>
                                </div>
                                <div className="flex-1 rounded-lg bg-red-500/10 border border-red-500/30 p-3 text-center">
                                    <p className="font-mono text-lg font-bold text-red-500">{market.noPrice}</p>
                                    <p className="font-mono text-xs text-muted-foreground">NO</p>
                                </div>
                            </div>

                            {/* Volume */}
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-muted-foreground">24h Volume</span>
                                <span className="font-mono text-foreground font-medium">{market.volume}</span>
                            </div>

                            {/* Bottom accent */}
                            <div className="absolute bottom-0 left-0 h-1 w-0 bg-linear-to-r from-primary via-primary/80 to-transparent transition-all duration-500 group-hover:w-full" />
                        </Link>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-12 sm:mt-16 text-center animate-fade-in-up stagger-5">
                    <Link
                        href="/trade"
                        className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-lg border border-primary bg-primary/10 px-8 py-4 font-mono text-sm text-primary transition-all duration-500 hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
                    >
                        <span className="relative z-10">Start Trading with Yield</span>
                        <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">→</span>
                        <span className="absolute inset-0 -translate-x-full bg-primary transition-transform duration-500 group-hover:translate-x-0" />
                    </Link>
                </div>
            </div>
        </section>
    )
}
