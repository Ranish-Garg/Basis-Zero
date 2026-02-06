"use client"

import { useState, useEffect } from "react"
import dynamic from 'next/dynamic'
import { StreamingBalance } from "@/components/trade/streaming-balance"
import { MarketGrid } from "@/components/trade/market-grid"
import { OrderBook } from "@/components/trade/order-book"
import { CreateMarketDialog, CreateMarketButton } from "@/components/trade/create-market-dialog"
import { useMarkets } from "@/hooks/use-amm"
import { useSessionEscrow, SessionState } from "@/hooks/use-session-escrow"
import { useQuery } from "@tanstack/react-query"
import { useAccount } from "wagmi"
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
    // Betting Mode Toggle (Default to Safe Mode)
    const [isSafeMode, setIsSafeMode] = useState(true)

    useEffect(() => setMounted(true), [])

    // Fetch markets to get the selected market details
    const { data: marketsData } = useMarkets()
    
    // Check session state from session escrow
    const { 
        sessionState, 
        activeSessionId, 
        locked, 
        fetchStreamingBalance,
        yieldAmount
    } = useSessionEscrow()
    
    const { address, isConnected } = useAccount()
    const hasActiveSession = sessionState === SessionState.Active

    // Fetch streaming balance. 
    // We request safeMode=false to get full potential balance info, but we apply limits locally based on UI toggle.
    const { data: streamingData } = useQuery({
        queryKey: ['streaming-balance-for-trade', activeSessionId],
        queryFn: () => fetchStreamingBalance(false), 
        enabled: !!activeSessionId && hasActiveSession,
        refetchInterval: 5000,
    })

    // Find the selected market from the markets list
    const selectedMarket: Market | null = selectedMarketId
        ? marketsData?.markets?.find(m => m.marketId === selectedMarketId) || null
        : null

    // Calculate max betting amount based on Safe Mode
    // Safe Mode: Max = Accrued Yield (from backend streaming)
    // Full Mode: Max = Available (which includes principal + yield from backend)
    
    const streamYield = parseFloat(streamingData?.yield || "0")
    const streamAvailable = parseFloat(streamingData?.available || "0")
    
    // Fallback to hook data if no streaming data yet
    const fallbackYield = parseFloat(yieldAmount || "0")
    
    const maxBettingAmount = hasActiveSession
        ? (isSafeMode 
            ? (streamYield > 0 ? streamYield.toString() : fallbackYield.toString())
            : (streamAvailable > 0 ? streamAvailable.toString() : locked))
        : "0"

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
                            {hasActiveSession 
                                ? (isSafeMode ? "Safe Mode: Trading with yield only." : "Full Mode: Principal is at risk.")
                                : "Start a session to trade. Your principal earns yield while locked."}
                        </p>
                    </div>

                    {/* Create Market Button */}
                    <CreateMarketButton onClick={() => setShowCreateDialog(true)} />
                </div>

                {/* Main Grid Layout */}
                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Left Column - Balance & Order Book */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Streaming Balance Widget */}
                        <StreamingBalance />

                        {/* Session Start Widget - Shows when no active session */}
                        {mounted && isConnected && !hasActiveSession && (
                            <SessionStartWidget />
                        )}

                        {/* Order Book / Trade Panel */}
                        <OrderBook
                            selectedMarket={selectedMarket}
                            userId={activeSessionId || address || "guest"}
                            maxAmount={maxBettingAmount}
                            isSafeMode={isSafeMode}
                            onToggleSafeMode={setIsSafeMode}
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
