"use client"

import { useState, useEffect } from "react"
import dynamic from 'next/dynamic'
import { StreamingBalance } from "@/components/trade/streaming-balance"
import { MarketGrid } from "@/components/trade/market-grid"
import { OrderBook } from "@/components/trade/order-book"
import { CreateMarketDialog, CreateMarketButton } from "@/components/trade/create-market-dialog"
import { useMarkets } from "@/hooks/use-amm"
import { useArcVault, SessionState } from "@/hooks/use-arc-vault"
import type { Market } from "@/lib/amm-types"

const SessionStartWidget = dynamic(
    () => import('@/components/vault/session-start-widget').then(mod => mod.SessionStartWidget),
    { ssr: false }
)

export default function TradePage() {
    const [activeCategory, setActiveCategory] = useState("all")
    const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    // Fetch markets to get the selected market details
    const { data: marketsData } = useMarkets()
    
    // Check session state from vault
    const { sessionState, isConnected } = useArcVault()
    const hasActiveSession = sessionState === SessionState.Active || sessionState === SessionState.PendingBridge

    // Find the selected market from the markets list
    const selectedMarket: Market | null = selectedMarketId
        ? marketsData?.markets?.find(m => m.marketId === selectedMarketId) || null
        : null

    return (
        <div className="min-h-screen pt-24 pb-12 overflow-x-hidden">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 overflow-hidden">
                {/* Page Header */}
                <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="space-y-2">
                        <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">
                            Trading Dashboard
                        </p>
                        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                            Prediction Markets
                        </h1>
                        <p className="max-w-2xl text-base text-muted-foreground">
                            Trade using your vault balance. Your principal earns yield in RWA vaults.
                        </p>
                    </div>

                    {/* Create Market Button */}
                    <CreateMarketButton onClick={() => setShowCreateDialog(true)} />
                </div>

                {/* Main Grid Layout */}
                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Left Column - Balance & Order Book */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Streaming Balance Widget - Fetches real vault data */}
                        <StreamingBalance />

                        {/* Session Start Widget - Shows when no active session */}
                        {mounted && isConnected && !hasActiveSession && (
                            <SessionStartWidget />
                        )}

                        {/* Order Book / Trade Panel */}
                        <OrderBook
                            selectedMarket={selectedMarket}
                            userId="demo-user"
                        />
                    </div>

                    {/* Right Column - Market Grid */}
                    <div className="lg:col-span-8">
                        <div className="rounded-xl border border-border bg-card/60 glass p-6">
                            <div className="mb-6 flex items-center justify-between">
                                <div>
                                    <h2 className="font-mono text-xs uppercase tracking-wider text-primary mb-2">
                                        Available Markets
                                    </h2>
                                    <p className="text-sm text-muted-foreground">
                                        Select a market to view details and place trades
                                    </p>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    {marketsData?.markets?.length || 0} markets
                                </div>
                            </div>

                            <MarketGrid
                                activeCategory={activeCategory}
                                onCategoryChange={setActiveCategory}
                                onMarketSelect={setSelectedMarketId}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Create Market Dialog */}
            <CreateMarketDialog
                isOpen={showCreateDialog}
                onClose={() => setShowCreateDialog(false)}
            />
        </div>
    )
}
