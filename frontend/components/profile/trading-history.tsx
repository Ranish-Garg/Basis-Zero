"use client"

import { TrendingUp, TrendingDown, DollarSign, Shield } from "lucide-react"
import { cn } from "@/lib/utils"

interface Trade {
    id: string
    market: string
    position: "YES" | "NO"
    amount: number
    price: number
    usedYield: boolean
    pnl: number
    status: "won" | "lost" | "pending"
    date: string
}

const trades: Trade[] = [
    {
        id: "t-001",
        market: "BTC > $100K by March 2026?",
        position: "YES",
        amount: 25.00,
        price: 0.72,
        usedYield: true,
        pnl: 12.50,
        status: "pending",
        date: "Feb 1, 2026"
    },
    {
        id: "t-002",
        market: "Fed cuts rates before June 2026?",
        position: "YES",
        amount: 15.00,
        price: 0.68,
        usedYield: true,
        pnl: 7.25,
        status: "pending",
        date: "Jan 30, 2026"
    },
    {
        id: "t-003",
        market: "Lakers win NBA Championship 2026?",
        position: "NO",
        amount: 50.00,
        price: 0.55,
        usedYield: false,
        pnl: -50.00,
        status: "lost",
        date: "Jan 28, 2026"
    },
    {
        id: "t-004",
        market: "ETH > $5K by Q1 2026?",
        position: "YES",
        amount: 30.00,
        price: 0.45,
        usedYield: true,
        pnl: 36.67,
        status: "won",
        date: "Jan 25, 2026"
    },
    {
        id: "t-005",
        market: "Record high temperature Jan 2026?",
        position: "YES",
        amount: 10.00,
        price: 0.80,
        usedYield: true,
        pnl: 2.50,
        status: "won",
        date: "Jan 20, 2026"
    },
]

export function TradingHistory() {
    const totalTrades = trades.length
    const wonTrades = trades.filter(t => t.status === "won").length
    const lostTrades = trades.filter(t => t.status === "lost").length
    const pendingTrades = trades.filter(t => t.status === "pending").length
    const winRate = totalTrades > 0 ? (wonTrades / (wonTrades + lostTrades)) * 100 : 0

    const yieldTrades = trades.filter(t => t.usedYield)
    const principalTrades = trades.filter(t => !t.usedYield)

    const totalPnl = trades.reduce((sum, t) => sum + (t.status !== "pending" ? t.pnl : 0), 0)

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            {/* Header */}
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-primary" />
                        <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                            Trading History
                        </h3>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                        {totalTrades} total trades
                    </span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Stats Overview */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="text-center p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                        <p className="font-mono text-lg font-bold text-green-500">{wonTrades}</p>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase">Won</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-red-500/10 border border-red-500/30">
                        <p className="font-mono text-lg font-bold text-red-500">{lostTrades}</p>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase">Lost</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                        <p className="font-mono text-lg font-bold text-yellow-500">{pendingTrades}</p>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase">Pending</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-primary/10 border border-primary/30">
                        <p className="font-mono text-lg font-bold text-primary">{winRate.toFixed(0)}%</p>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase">Win Rate</p>
                    </div>
                </div>

                {/* Yield vs Principal Breakdown */}
                <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">
                        Trade Source Breakdown
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                                <TrendingUp className="h-5 w-5 text-green-500" />
                            </div>
                            <div>
                                <p className="font-mono text-lg font-bold">{yieldTrades.length}</p>
                                <p className="text-xs text-muted-foreground">Yield Trades</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/20">
                                <Shield className="h-5 w-5 text-blue-500" />
                            </div>
                            <div>
                                <p className="font-mono text-lg font-bold">{principalTrades.length}</p>
                                <p className="text-xs text-muted-foreground">Principal Trades</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Total P&L */}
                <div className={cn(
                    "rounded-lg p-4 text-center",
                    totalPnl >= 0 ? "bg-green-500/10 border border-green-500/30" : "bg-red-500/10 border border-red-500/30"
                )}>
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-1">
                        Total P&L
                    </p>
                    <p className={cn(
                        "font-mono text-3xl font-bold",
                        totalPnl >= 0 ? "text-green-500" : "text-red-500"
                    )}>
                        {totalPnl >= 0 ? "+" : ""}{totalPnl.toFixed(2)} USDC
                    </p>
                </div>

                {/* Trade Log */}
                <div>
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">
                        Recent Trades
                    </p>
                    <div className="space-y-2 max-h-[300px] overflow-y-auto">
                        {trades.map((trade) => (
                            <div
                                key={trade.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className={cn(
                                            "px-2 py-0.5 rounded text-[10px] font-mono uppercase",
                                            trade.position === "YES"
                                                ? "bg-green-500/20 text-green-500"
                                                : "bg-red-500/20 text-red-500"
                                        )}>
                                            {trade.position}
                                        </span>
                                        {trade.usedYield ? (
                                            <span className="flex items-center gap-1 text-[10px] text-green-500">
                                                <TrendingUp className="h-3 w-3" />
                                                Yield
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-[10px] text-blue-500">
                                                <Shield className="h-3 w-3" />
                                                Principal
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm font-medium truncate">{trade.market}</p>
                                    <p className="text-xs text-muted-foreground">{trade.date}</p>
                                </div>
                                <div className="text-right ml-4">
                                    <p className="font-mono text-sm">${trade.amount.toFixed(2)} @ {trade.price}</p>
                                    <div className="flex items-center justify-end gap-1 mt-1">
                                        {trade.status === "pending" ? (
                                            <span className="font-mono text-xs text-yellow-500">Pending</span>
                                        ) : trade.pnl >= 0 ? (
                                            <>
                                                <TrendingUp className="h-3 w-3 text-green-500" />
                                                <span className="font-mono text-xs text-green-500">+${trade.pnl.toFixed(2)}</span>
                                            </>
                                        ) : (
                                            <>
                                                <TrendingDown className="h-3 w-3 text-red-500" />
                                                <span className="font-mono text-xs text-red-500">${trade.pnl.toFixed(2)}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    )
}
