"use client"

import { useState } from "react"
import { StreamingBalance } from "@/components/trade/streaming-balance"
import { MarketGrid } from "@/components/trade/market-grid"
import { OrderBook } from "@/components/trade/order-book"

export default function TradePage() {
    const [safeModeEnabled, setSafeModeEnabled] = useState(true)
    const [activeCategory, setActiveCategory] = useState("all")
    const [selectedMarket, setSelectedMarket] = useState<number | null>(null)

    const mockMarket = selectedMarket ? {
        id: selectedMarket,
        title: "BTC > $100K by March 2026?",
        yesPrice: "0.72",
        noPrice: "0.28",
    } : undefined

    return (
        <div className="min-h-screen pt-24 pb-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                {/* Page Header */}
                <div className="mb-8 space-y-2">
                    <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">
                        Trading Dashboard
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        Prediction Markets
                    </h1>
                    <p className="max-w-2xl text-base text-muted-foreground">
                        Trade using your accrued yield. Your principal stays protected in RWA vaults earning 5.12% APY.
                    </p>
                </div>

                {/* Main Grid Layout */}
                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Left Column - Balance & Order Book */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Streaming Balance Widget */}
                        <StreamingBalance
                            principal={10000}
                            apy={5.12}
                            safeModeEnabled={safeModeEnabled}
                            onSafeModeToggle={setSafeModeEnabled}
                        />

                        {/* Order Book */}
                        <OrderBook selectedMarket={mockMarket} />
                    </div>

                    {/* Right Column - Market Grid */}
                    <div className="lg:col-span-8">
                        <div className="rounded-xl border border-border bg-card/60 glass p-6">
                            <div className="mb-6">
                                <h2 className="font-mono text-xs uppercase tracking-wider text-primary mb-2">
                                    Available Markets
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Select a market to view details and place trades
                                </p>
                            </div>

                            <MarketGrid
                                activeCategory={activeCategory}
                                onCategoryChange={setActiveCategory}
                                onMarketSelect={setSelectedMarket}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
