"use client"

import { useState, useEffect } from "react"
import { Shield, Lock, Unlock, TrendingUp, Wallet, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { useArcVault } from "@/hooks/use-arc-vault"

interface StreamingBalanceProps {
    safeModeEnabled: boolean
    onSafeModeToggle: (enabled: boolean) => void
}

export function StreamingBalance({
    safeModeEnabled,
    onSafeModeToggle
}: StreamingBalanceProps) {
    // Handle hydration mismatch
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Fetch real data from vault contract
    const {
        principal,
        accruedYield,
        totalBalance,
        apyPercent,
        isLoading,
        isConnected
    } = useArcVault()

    // Parse values for display
    const principalNum = parseFloat(principal) || 0
    const accruedYieldNum = parseFloat(accruedYield) || 0
    const totalBalanceNum = parseFloat(totalBalance) || 0
    const apyNum = parseFloat(apyPercent) || 0

    // Calculate daily yield rate
    const dailyYield = (principalNum * (apyNum / 100)) / 365

    const bettingPower = safeModeEnabled ? accruedYieldNum : totalBalanceNum

    // Show loading skeleton during hydration to prevent mismatch
    if (!mounted) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        )
    }

    // Show connect wallet prompt if not connected
    if (!isConnected) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                            <Wallet className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                                Vault Balance
                            </h3>
                            <p className="text-xs text-muted-foreground">Connect wallet to view</p>
                        </div>
                    </div>
                </div>
                <div className="text-center py-8">
                    <p className="text-muted-foreground">Connect your wallet to view your vault balance</p>
                </div>
            </div>
        )
    }

    // Show loading state
    if (isLoading) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass p-6 sm:p-8 space-y-6">
                <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card/60 glass p-6 sm:p-8 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
                        <TrendingUp className="h-5 w-5" />
                    </div>
                    <div>
                        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            Total Balance
                        </h3>
                        <p className="text-xs text-muted-foreground">USDC in Vault</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-green-500">
                    <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-mono text-xs">LIVE</span>
                </div>
            </div>

            {/* Main Balance Display */}
            <div className="text-center py-4 overflow-hidden">
                <div className="font-mono text-2xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                    <span className="text-foreground">$</span>
                    <span className={cn(
                        "transition-colors duration-300",
                        safeModeEnabled ? "text-muted-foreground" : "text-foreground"
                    )}>
                        {totalBalanceNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                </div>
                {apyNum > 0 && (
                    <p className="mt-2 font-mono text-xs text-muted-foreground">
                        Earning ${dailyYield.toFixed(4)}/day at {apyNum}% APY
                    </p>
                )}
            </div>

            {/* Principal vs Yield Breakdown */}
            <div className="grid grid-cols-2 gap-4">
                <div className={cn(
                    "rounded-lg border p-4 transition-all duration-300",
                    safeModeEnabled
                        ? "border-border/50 bg-secondary/30 opacity-50"
                        : "border-blue-500/30 bg-blue-500/10"
                )}>
                    <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-4 w-4 text-blue-500" />
                        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Principal
                        </span>
                    </div>
                    <p className={cn(
                        "font-mono text-xl font-bold",
                        safeModeEnabled ? "text-muted-foreground line-through" : "text-foreground"
                    )}>
                        ${principalNum.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground mt-1">Protected</p>
                </div>

                <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4">
                    <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-4 w-4 text-green-500" />
                        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Accrued Yield
                        </span>
                    </div>
                    <p className="font-mono text-xl font-bold text-green-500">
                        ${accruedYieldNum.toFixed(4)}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground mt-1">Available</p>
                </div>
            </div>

            {/* Safe Mode Toggle */}
            <div className="border-t border-border/50 pt-6">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {safeModeEnabled ? (
                            <Lock className="h-5 w-5 text-primary" />
                        ) : (
                            <Unlock className="h-5 w-5 text-muted-foreground" />
                        )}
                        <div>
                            <p className="font-medium text-foreground">Safe Mode</p>
                            <p className="text-xs text-muted-foreground">
                                {safeModeEnabled
                                    ? "Only yield is available for trading"
                                    : "Full balance available for trading"
                                }
                            </p>
                        </div>
                    </div>

                    {/* Toggle Switch */}
                    <button
                        onClick={() => onSafeModeToggle(!safeModeEnabled)}
                        className={cn(
                            "relative h-7 w-14 rounded-full transition-colors duration-300",
                            safeModeEnabled
                                ? "bg-primary"
                                : "bg-secondary"
                        )}
                    >
                        <span
                            className={cn(
                                "absolute top-1 h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300",
                                safeModeEnabled ? "left-8" : "left-1"
                            )}
                        />
                    </button>
                </div>

                {/* Betting Power Display */}
                <div className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-4">
                    <div className="flex items-center justify-between">
                        <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                            Betting Power
                        </span>
                        <span className="font-mono text-lg font-bold text-primary">
                            ${bettingPower.toFixed(2)}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}
