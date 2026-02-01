"use client"

import { TrendingUp, Shield, DollarSign, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"

interface PortfolioViewProps {
    principal?: number
    currentYield?: number
    apy?: number
    depositDate?: string
}

export function PortfolioView({
    principal = 10000,
    currentYield = 42.35,
    apy = 5.12,
    depositDate = "Jan 15, 2026"
}: PortfolioViewProps) {
    const totalValue = principal + currentYield
    const yieldPercentage = (currentYield / principal) * 100

    // Simulated historical yield data
    const yieldHistory = [
        { month: "Jan", yield: 12.5 },
        { month: "Feb", yield: 42.35 },
    ]

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            {/* Header */}
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-primary" />
                        <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                            RWA Portfolio
                        </h3>
                    </div>
                    <span className="flex items-center gap-1.5 font-mono text-xs text-green-500">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        BlackRock BUIDL
                    </span>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Total Value */}
                <div className="text-center">
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-2">
                        Total Portfolio Value
                    </p>
                    <p className="font-mono text-4xl font-bold">
                        ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="mt-1 text-sm text-green-500">
                        +${currentYield.toFixed(2)} ({yieldPercentage.toFixed(2)}%)
                    </p>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-lg border border-border/50 bg-secondary/30 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="h-4 w-4 text-blue-500" />
                            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                                Principal
                            </span>
                        </div>
                        <p className="font-mono text-xl font-bold">${principal.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground mt-1">Protected</p>
                    </div>

                    <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                        <div className="flex items-center gap-2 mb-2">
                            <TrendingUp className="h-4 w-4 text-green-500" />
                            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">
                                Accrued Yield
                            </span>
                        </div>
                        <p className="font-mono text-xl font-bold text-green-500">${currentYield.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground mt-1">Available</p>
                    </div>
                </div>

                {/* APY Display */}
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                                Current APY
                            </p>
                            <p className="font-mono text-2xl font-bold text-primary">{apy}%</p>
                        </div>
                        <div className="text-right">
                            <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                                Daily Earnings
                            </p>
                            <p className="font-mono text-lg font-medium text-foreground">
                                ${((principal * (apy / 100)) / 365).toFixed(2)}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Yield History */}
                <div>
                    <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider mb-3">
                        Yield History
                    </p>
                    <div className="space-y-2">
                        {yieldHistory.map((entry, index) => (
                            <div
                                key={index}
                                className="flex items-center justify-between py-2 border-b border-border/30 last:border-0"
                            >
                                <span className="text-sm text-muted-foreground">{entry.month} 2026</span>
                                <span className="font-mono text-sm text-green-500">+${entry.yield.toFixed(2)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Deposit Date */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>First deposit: {depositDate}</span>
                </div>
            </div>
        </div>
    )
}
