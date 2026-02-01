"use client"

import { useEffect, useState, useRef } from "react"
import { Shield, Lock, Unlock, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

interface StreamingBalanceProps {
    principal: number
    apy: number
    safeModeEnabled: boolean
    onSafeModeToggle: (enabled: boolean) => void
}

export function StreamingBalance({
    principal = 10000,
    apy = 5.12,
    safeModeEnabled,
    onSafeModeToggle
}: StreamingBalanceProps) {
    const [currentYield, setCurrentYield] = useState(0)
    const [displayValue, setDisplayValue] = useState("0.000000")
    const startTimeRef = useRef<number>(Date.now())
    const baseYieldRef = useRef<number>(0)

    // Calculate yield per second based on APY
    const yieldPerSecond = (principal * (apy / 100)) / (365 * 24 * 60 * 60)

    useEffect(() => {
        // Simulate pre-existing yield (random amount up to 30 days worth)
        const preExistingYield = Math.random() * yieldPerSecond * 60 * 60 * 24 * 30
        baseYieldRef.current = preExistingYield
        setCurrentYield(preExistingYield)
        startTimeRef.current = Date.now()
    }, [principal, apy, yieldPerSecond])

    useEffect(() => {
        const intervalId = setInterval(() => {
            const elapsedSeconds = (Date.now() - startTimeRef.current) / 1000
            const newYield = baseYieldRef.current + (elapsedSeconds * yieldPerSecond)
            setCurrentYield(newYield)

            // Format with 6 decimal places, showing the real-time increment
            const total = principal + newYield
            setDisplayValue(total.toFixed(6))
        }, 50) // Update every 50ms for smooth animation

        return () => clearInterval(intervalId)
    }, [principal, yieldPerSecond])

    const bettingPower = safeModeEnabled ? currentYield : principal + currentYield

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

            {/* Main Balance Display - The Streaming Counter */}
            <div className="text-center py-4">
                <div className="font-mono text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight">
                    <span className="text-foreground">$</span>
                    <span className={cn(
                        "transition-colors duration-300",
                        safeModeEnabled ? "text-muted-foreground" : "text-foreground"
                    )}>
                        {displayValue.split('.')[0]}
                    </span>
                    <span className="text-primary">.</span>
                    <span className="text-primary text-3xl sm:text-4xl lg:text-5xl">
                        {displayValue.split('.')[1]}
                    </span>
                </div>
                <p className="mt-2 font-mono text-xs text-muted-foreground">
                    Earning ${(yieldPerSecond * 60 * 60 * 24).toFixed(4)}/day at {apy}% APY
                </p>
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
                        ${principal.toLocaleString()}
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
                        ${currentYield.toFixed(4)}
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
