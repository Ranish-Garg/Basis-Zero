"use client"

import { useState, useEffect } from "react"
import { Gavel, Clock, CheckCircle, XCircle, Loader2, AlertCircle, Check, X, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAccount } from "wagmi"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Market } from "@/lib/amm-types"

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatDate(date: Date): string {
    return `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`
}

// Fetch markets by resolver address from backend
async function fetchMyMarkets(address: string): Promise<{ markets: Market[] }> {
    const response = await fetch(`/api/amm/markets/resolver/${address}`)
    if (!response.ok) return { markets: [] }
    return response.json()
}

export function MyMarkets() {
    const { address } = useAccount()
    const [resolvingMarket, setResolvingMarket] = useState<Market | null>(null)
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    // Fetch markets created by this wallet (any status)
    const { data: marketsData, isLoading } = useQuery({
        queryKey: ['my-markets', address],
        queryFn: () => fetchMyMarkets(address!),
        enabled: mounted && !!address,
        staleTime: 10 * 1000,
        refetchInterval: 30 * 1000,
    })

    const myMarkets = marketsData?.markets || []
    const activeMarkets = myMarkets.filter(m => m.status === 'ACTIVE')
    const resolvedMarkets = myMarkets.filter(m => m.status === 'RESOLVED')

    if (!mounted || !address) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
                <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                    <div className="flex items-center justify-between">
                        <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                            My Markets
                        </h3>
                    </div>
                </div>
                <div className="p-8 text-center">
                    <Gavel className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm text-muted-foreground">
                        {mounted ? 'Connect wallet to view your markets' : 'Loading...'}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            {/* Header */}
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                        My Markets
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                        {myMarkets.length} market{myMarkets.length !== 1 ? 's' : ''}
                    </span>
                </div>
            </div>

            <div className="divide-y divide-border/50">
                {isLoading ? (
                    <div className="p-8 text-center">
                        <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary mb-2" />
                        <p className="text-xs text-muted-foreground">Loading markets...</p>
                    </div>
                ) : myMarkets.length === 0 ? (
                    <div className="p-8 text-center">
                        <TrendingUp className="h-10 w-10 mx-auto mb-3 text-muted-foreground/50" />
                        <p className="text-sm text-muted-foreground mb-1">
                            No markets created yet
                        </p>
                        <p className="text-xs text-muted-foreground">
                            Create a market from the Trade page to see it here
                        </p>
                    </div>
                ) : (
                    <>
                        {/* Active markets (can be resolved) */}
                        {activeMarkets.map((market) => (
                            <MarketCard
                                key={market.marketId}
                                market={market}
                                onResolve={() => setResolvingMarket(market)}
                            />
                        ))}

                        {/* Resolved markets */}
                        {resolvedMarkets.map((market) => (
                            <MarketCard
                                key={market.marketId}
                                market={market}
                                resolved
                            />
                        ))}
                    </>
                )}
            </div>

            {/* Resolve Dialog */}
            {resolvingMarket && (
                <ResolveDialog
                    market={resolvingMarket}
                    resolverAddress={address}
                    onClose={() => setResolvingMarket(null)}
                />
            )}
        </div>
    )
}

// ─── Market Card ─────────────────────────────────────────────────────────────

function MarketCard({
    market,
    resolved,
    onResolve
}: {
    market: Market
    resolved?: boolean
    onResolve?: () => void
}) {
    const expiryDate = new Date(market.expiresAt)
    const isExpired = expiryDate < new Date()
    const canResolve = !resolved && market.status === 'ACTIVE'

    return (
        <div className="p-4 hover:bg-secondary/10 transition-colors">
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{market.title}</p>
                    <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(expiryDate)}
                        </span>
                        {market.category && (
                            <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                                {market.category}
                            </span>
                        )}
                    </div>

                    {/* Prices row */}
                    <div className="flex items-center gap-3 mt-2">
                        <span className="font-mono text-xs text-green-500">
                            YES {market.prices.yesProbability}%
                        </span>
                        <span className="font-mono text-xs text-red-500">
                            NO {market.prices.noProbability}%
                        </span>
                    </div>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                    {resolved ? (
                        <span className={cn(
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-mono font-medium border",
                            market.resolutionValue === 'YES'
                                ? "border-green-500/20 bg-green-500/10 text-green-500"
                                : "border-red-500/20 bg-red-500/10 text-red-500"
                        )}>
                            {market.resolutionValue === 'YES'
                                ? <CheckCircle className="h-3 w-3" />
                                : <XCircle className="h-3 w-3" />
                            }
                            {market.resolutionValue}
                        </span>
                    ) : canResolve ? (
                        <button
                            onClick={onResolve}
                            className={cn(
                                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                                isExpired
                                    ? "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
                                    : "bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 hover:bg-yellow-500/20"
                            )}
                        >
                            <Gavel className="h-3 w-3" />
                            Resolve
                        </button>
                    ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono text-yellow-500">
                            <Clock className="h-3 w-3" />
                            ACTIVE
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}

// ─── Resolve Dialog ──────────────────────────────────────────────────────────

function ResolveDialog({
    market,
    resolverAddress,
    onClose,
}: {
    market: Market
    resolverAddress: string
    onClose: () => void
}) {
    const [outcome, setOutcome] = useState<'YES' | 'NO' | null>(null)
    const [confirming, setConfirming] = useState(false)
    const queryClient = useQueryClient()

    const resolveMutation = useMutation({
        mutationFn: async (vars: { marketId: string; outcome: number; resolvedBy: string }) => {
            const response = await fetch('/api/amm/markets/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vars),
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to resolve market')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['amm', 'markets'] })
            queryClient.invalidateQueries({ queryKey: ['my-markets'] })
            // Invalidate trades so PnL updates in Recent Activity
            queryClient.invalidateQueries({ queryKey: ['user-trades'] })
            // Invalidate streaming balance since resolved positions are no longer locked
            queryClient.invalidateQueries({ queryKey: ['streaming-balance-for-trade'] })
            onClose()
        },
    })

    const handleResolve = async () => {
        if (!outcome) return
        setConfirming(true)

        try {
            await resolveMutation.mutateAsync({
                marketId: market.marketId,
                outcome: outcome === 'YES' ? 0 : 1,
                resolvedBy: resolverAddress,
            })
        } catch (err) {
            console.error(err)
            setConfirming(false)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative w-full max-w-sm mx-4 rounded-xl border border-border bg-card p-6 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                        <Gavel className="h-6 w-6" />
                    </div>
                    <h2 className="text-xl font-semibold">Resolve Market</h2>
                    <p className="text-sm text-muted-foreground mt-1 px-4">
                        {market.title}
                    </p>
                </div>

                {!confirming ? (
                    <div className="space-y-4">
                        <p className="text-sm font-medium text-center text-muted-foreground/80">
                            Select the correct outcome:
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setOutcome('YES')}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                                    outcome === 'YES'
                                        ? "border-green-500 bg-green-500/10 text-green-500"
                                        : "border-border hover:border-primary/50 hover:bg-accent"
                                )}
                            >
                                <Check className="h-6 w-6 mb-2" />
                                <span className="font-bold">YES</span>
                            </button>

                            <button
                                onClick={() => setOutcome('NO')}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                                    outcome === 'NO'
                                        ? "border-red-500 bg-red-500/10 text-red-500"
                                        : "border-border hover:border-primary/50 hover:bg-accent"
                                )}
                            >
                                <X className="h-6 w-6 mb-2" />
                                <span className="font-bold">NO</span>
                            </button>
                        </div>

                        {outcome && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-3 mt-4">
                                <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-500/90 text-left">
                                    This action is irreversible. Funds will be distributed immediately to {outcome} holders.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolve}
                                disabled={!outcome}
                                className={cn(
                                    "flex-1 py-2.5 rounded-lg font-medium transition-all shadow-lg",
                                    outcome === 'YES' ? "bg-green-500 text-white shadow-green-500/20" :
                                        outcome === 'NO' ? "bg-red-500 text-white shadow-red-500/20" :
                                            "bg-muted text-muted-foreground cursor-not-allowed"
                                )}
                            >
                                Confirm Resolve
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-8 flex flex-col items-center">
                        {resolveMutation.isError ? (
                            <>
                                <AlertCircle className="h-10 w-10 text-red-500 mb-4" />
                                <p className="text-lg font-medium text-red-500">Resolution Failed</p>
                                <p className="text-sm text-muted-foreground mt-2 text-center">
                                    {resolveMutation.error?.message || 'Something went wrong'}
                                </p>
                                <button
                                    onClick={() => { setConfirming(false) }}
                                    className="mt-4 px-4 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm font-medium transition-colors"
                                >
                                    Try Again
                                </button>
                            </>
                        ) : (
                            <>
                                <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                                <p className="text-lg font-medium">Resolving Market...</p>
                                <p className="text-sm text-muted-foreground mt-2">
                                    Distributing payouts to winners
                                </p>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
