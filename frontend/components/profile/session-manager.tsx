"use client"

import { Wifi, WifiOff, Zap, Clock, RefreshCw } from "lucide-react"
import { cn } from "@/lib/utils"

interface Channel {
    id: string
    counterparty: string
    balance: number
    status: "active" | "pending" | "closed"
    lastActivity: string
}

const channels: Channel[] = [
    { id: "ch-001", counterparty: "Yellow Network Hub", balance: 500.00, status: "active", lastActivity: "2 min ago" },
    { id: "ch-002", counterparty: "Market Maker Alpha", balance: 1250.00, status: "active", lastActivity: "5 min ago" },
    { id: "ch-003", counterparty: "Liquidity Pool B", balance: 0, status: "pending", lastActivity: "1 hour ago" },
]

export function SessionManager() {
    const isSessionActive = true
    const sessionDuration = "2h 34m"
    const totalChannelBalance = channels.reduce((sum, ch) => sum + ch.balance, 0)
    const activeChannels = channels.filter(ch => ch.status === "active").length

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            {/* Header */}
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                            Yellow Session
                        </h3>
                    </div>
                    <div className={cn(
                        "flex items-center gap-2 px-2 py-1 rounded-full text-xs font-mono",
                        isSessionActive
                            ? "bg-green-500/20 text-green-500"
                            : "bg-red-500/20 text-red-500"
                    )}>
                        {isSessionActive ? (
                            <>
                                <Wifi className="h-3 w-3" />
                                Session Active
                            </>
                        ) : (
                            <>
                                <WifiOff className="h-3 w-3" />
                                Disconnected
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Session Stats */}
                <div className="grid grid-cols-3 gap-4">
                    <div className="text-center p-3 rounded-lg bg-secondary/30">
                        <p className="font-mono text-xl font-bold text-foreground">{activeChannels}</p>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase">Active Channels</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-secondary/30">
                        <p className="font-mono text-xl font-bold text-primary">${totalChannelBalance.toLocaleString()}</p>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase">Channel Balance</p>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-secondary/30">
                        <p className="font-mono text-xl font-bold text-foreground">{sessionDuration}</p>
                        <p className="font-mono text-[10px] text-muted-foreground uppercase">Session Time</p>
                    </div>
                </div>

                {/* Channels List */}
                <div>
                    <div className="flex items-center justify-between mb-3">
                        <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            Open Channels
                        </p>
                        <button className="text-xs text-primary hover:underline flex items-center gap-1">
                            <RefreshCw className="h-3 w-3" />
                            Refresh
                        </button>
                    </div>

                    <div className="space-y-2">
                        {channels.map((channel) => (
                            <div
                                key={channel.id}
                                className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-secondary/20 hover:bg-secondary/40 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "h-2 w-2 rounded-full",
                                        channel.status === "active" && "bg-green-500",
                                        channel.status === "pending" && "bg-yellow-500 animate-pulse",
                                        channel.status === "closed" && "bg-muted-foreground"
                                    )} />
                                    <div>
                                        <p className="text-sm font-medium">{channel.counterparty}</p>
                                        <p className="font-mono text-xs text-muted-foreground">{channel.id}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="font-mono text-sm font-medium">${channel.balance.toFixed(2)}</p>
                                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                        <Clock className="h-3 w-3" />
                                        {channel.lastActivity}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <button className="py-3 rounded-lg border border-primary bg-primary/10 text-primary font-mono text-sm hover:bg-primary/20 transition-colors">
                        Open Channel
                    </button>
                    <button className="py-3 rounded-lg border border-border bg-secondary/50 text-foreground font-mono text-sm hover:bg-secondary transition-colors">
                        Close All
                    </button>
                </div>
            </div>
        </div>
    )
}
