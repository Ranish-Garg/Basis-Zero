"use client"

import { useState, useEffect } from "react"
import { ArrowUpRight, ArrowDownLeft, Clock, Search, Filter, TrendingUp, TrendingDown, Award } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAccount } from "wagmi"
import { useQuery } from "@tanstack/react-query"

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatTradeDate(dateStr: string): string {
    const d = new Date(dateStr)
    const month = MONTHS[d.getUTCMonth()]
    const day = d.getUTCDate()
    const hours = d.getUTCHours().toString().padStart(2, '0')
    const minutes = d.getUTCMinutes().toString().padStart(2, '0')
    return `${month} ${day} ${hours}:${minutes}`
}

interface Trade {
    id: string
    sessionId: string
    userAddress: string
    marketId: string
    tradeType: 'BUY' | 'SELL' | 'CLAIM'
    outcome: 'YES' | 'NO'
    shares: string
    price: number
    costBasis: string
    realizedPnl: string
    marketTitle: string | null
    createdAt: string
}

async function fetchTrades(address: string): Promise<{ trades: Trade[] }> {
    const res = await fetch(`/api/amm/trades/${address}`)
    if (!res.ok) throw new Error('Failed to fetch trades')
    return res.json()
}

export function TradingHistory() {
    const { address } = useAccount()
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const { data, isLoading } = useQuery({
        queryKey: ['user-trades', address],
        queryFn: () => fetchTrades(address!),
        enabled: mounted && !!address,
        staleTime: 10 * 1000,
        refetchInterval: 30 * 1000,
    })

    const trades = data?.trades ?? []

    // Calculate overall PnL summary
    const totalRealizedPnl = trades.reduce((sum, t) => {
        return sum + parseFloat(t.realizedPnl || '0')
    }, 0)
    const totalBuys = trades.filter(t => t.tradeType === 'BUY').length
    const totalSells = trades.filter(t => t.tradeType === 'SELL').length
    const totalClaims = trades.filter(t => t.tradeType === 'CLAIM').length

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                        Recent Activity
                    </h3>
                    <div className="flex items-center gap-3">
                        {trades.length > 0 && (
                            <span className={cn(
                                "font-mono text-xs font-medium",
                                totalRealizedPnl >= 0 ? "text-green-500" : "text-red-500"
                            )}>
                                PnL: {totalRealizedPnl >= 0 ? '+' : ''}${(totalRealizedPnl / 1e6).toFixed(2)}
                            </span>
                        )}
                        <span className="font-mono text-[10px] text-muted-foreground">
                            {totalBuys}B / {totalSells}S / {totalClaims}C
                        </span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-border/50 bg-secondary/20">
                            <th className="px-4 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase">Time</th>
                            <th className="px-4 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase">Market</th>
                            <th className="px-4 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase">Type</th>
                            <th className="px-4 py-2 text-left font-mono text-[10px] text-muted-foreground uppercase">Side</th>
                            <th className="px-4 py-2 text-right font-mono text-[10px] text-muted-foreground uppercase">Shares</th>
                            <th className="px-4 py-2 text-right font-mono text-[10px] text-muted-foreground uppercase">Price</th>
                            <th className="px-4 py-2 text-right font-mono text-[10px] text-muted-foreground uppercase">Amount</th>
                            <th className="px-4 py-2 text-right font-mono text-[10px] text-muted-foreground uppercase">PnL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50">
                        {!mounted || !address ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">
                                    {mounted ? 'Connect your wallet to view trading activity.' : 'Loading...'}
                                </td>
                            </tr>
                        ) : isLoading ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">
                                    <Clock className="h-4 w-4 animate-spin inline mr-2" />
                                    Loading trades...
                                </td>
                            </tr>
                        ) : trades.length === 0 ? (
                            <tr>
                                <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground text-xs">
                                    No trading activity yet.
                                </td>
                            </tr>
                        ) : (
                            trades.map((trade) => {
                                const pnl = parseFloat(trade.realizedPnl || '0')
                                const shares = parseFloat(trade.shares || '0')
                                const cost = parseFloat(trade.costBasis || '0')

                                return (
                                    <tr key={trade.id} className="hover:bg-secondary/10 transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground whitespace-nowrap">
                                            {formatTradeDate(trade.createdAt)}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-xs max-w-45 truncate" title={trade.marketTitle || trade.marketId}>
                                            {trade.marketTitle || trade.marketId.slice(0, 12) + '...'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border",
                                                trade.tradeType === 'BUY'
                                                    ? "border-blue-500/20 bg-blue-500/10 text-blue-500"
                                                    : trade.tradeType === 'SELL'
                                                        ? "border-orange-500/20 bg-orange-500/10 text-orange-500"
                                                        : "border-purple-500/20 bg-purple-500/10 text-purple-500"
                                            )}>
                                                {trade.tradeType === 'BUY' ? <ArrowDownLeft className="h-3 w-3" /> :
                                                    trade.tradeType === 'SELL' ? <ArrowUpRight className="h-3 w-3" /> :
                                                        <Award className="h-3 w-3" />}
                                                {trade.tradeType}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={cn(
                                                "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border",
                                                trade.outcome === "YES"
                                                    ? "border-green-500/20 bg-green-500/10 text-green-500"
                                                    : "border-red-500/20 bg-red-500/10 text-red-500"
                                            )}>
                                                {trade.outcome}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs">
                                            {(shares / 1e6).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                                            ${trade.price.toFixed(4)}
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono text-xs">
                                            ${(cost / 1e6).toFixed(2)}
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            {trade.tradeType === 'BUY' ? (
                                                <span className="font-mono text-xs text-muted-foreground">—</span>
                                            ) : (
                                                <span className={cn(
                                                    "font-mono text-xs font-medium inline-flex items-center gap-0.5",
                                                    pnl > 0 ? "text-green-500" : pnl < 0 ? "text-red-500" : "text-muted-foreground"
                                                )}>
                                                    {pnl > 0 ? <TrendingUp className="h-3 w-3" /> : pnl < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                                                    {pnl >= 0 ? '+' : ''}{(pnl / 1e6).toFixed(2)}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
