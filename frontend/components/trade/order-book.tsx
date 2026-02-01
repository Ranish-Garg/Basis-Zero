"use client"

import { cn } from "@/lib/utils"

interface Order {
    price: number
    size: number
    cumulative: number
}

const buyOrders: Order[] = [
    { price: 0.72, size: 1234, cumulative: 1234 },
    { price: 0.71, size: 2567, cumulative: 3801 },
    { price: 0.70, size: 1890, cumulative: 5691 },
    { price: 0.69, size: 3456, cumulative: 9147 },
    { price: 0.68, size: 2123, cumulative: 11270 },
]

const sellOrders: Order[] = [
    { price: 0.73, size: 1567, cumulative: 1567 },
    { price: 0.74, size: 2890, cumulative: 4457 },
    { price: 0.75, size: 1234, cumulative: 5691 },
    { price: 0.76, size: 3567, cumulative: 9258 },
    { price: 0.77, size: 2345, cumulative: 11603 },
]

interface OrderBookProps {
    selectedMarket?: {
        id: number
        title: string
        yesPrice: string
        noPrice: string
    }
}

export function OrderBook({ selectedMarket }: OrderBookProps) {
    const maxCumulative = Math.max(
        ...buyOrders.map(o => o.cumulative),
        ...sellOrders.map(o => o.cumulative)
    )

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden">
            {/* Header */}
            <div className="border-b border-border/50 bg-secondary/40 px-4 py-3">
                <div className="flex items-center justify-between">
                    <h3 className="font-mono text-xs uppercase tracking-wider text-primary">
                        Order Book
                    </h3>
                    <div className="flex items-center gap-2">
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-mono text-xs text-muted-foreground">
                            Yellow Network
                        </span>
                    </div>
                </div>
                {selectedMarket && (
                    <p className="mt-1 text-xs text-muted-foreground line-clamp-1">
                        {selectedMarket.title}
                    </p>
                )}
            </div>

            {/* Order Book Content */}
            <div className="p-4 space-y-4">
                {/* Column Headers */}
                <div className="grid grid-cols-3 gap-2 text-center font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Price</span>
                    <span>Size</span>
                    <span>Total</span>
                </div>

                {/* Sell Orders (reversed for display) */}
                <div className="space-y-1">
                    {[...sellOrders].reverse().map((order, index) => (
                        <div key={index} className="relative">
                            {/* Background bar */}
                            <div
                                className="absolute inset-0 bg-red-500/10 rounded-sm"
                                style={{ width: `${(order.cumulative / maxCumulative) * 100}%` }}
                            />
                            {/* Content */}
                            <div className="relative grid grid-cols-3 gap-2 py-1.5 px-2 text-center font-mono text-xs">
                                <span className="text-red-500">{order.price.toFixed(2)}</span>
                                <span className="text-muted-foreground">{order.size.toLocaleString()}</span>
                                <span className="text-muted-foreground">{order.cumulative.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Spread Indicator */}
                <div className="flex items-center justify-center py-2 border-y border-border/50">
                    <div className="flex items-center gap-3 font-mono text-xs">
                        <span className="text-muted-foreground">Spread:</span>
                        <span className="text-foreground font-medium">$0.01</span>
                        <span className="text-muted-foreground">(1.37%)</span>
                    </div>
                </div>

                {/* Buy Orders */}
                <div className="space-y-1">
                    {buyOrders.map((order, index) => (
                        <div key={index} className="relative">
                            {/* Background bar */}
                            <div
                                className="absolute inset-0 bg-green-500/10 rounded-sm"
                                style={{ width: `${(order.cumulative / maxCumulative) * 100}%` }}
                            />
                            {/* Content */}
                            <div className="relative grid grid-cols-3 gap-2 py-1.5 px-2 text-center font-mono text-xs">
                                <span className="text-green-500">{order.price.toFixed(2)}</span>
                                <span className="text-muted-foreground">{order.size.toLocaleString()}</span>
                                <span className="text-muted-foreground">{order.cumulative.toLocaleString()}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Footer - Trade Input */}
            <div className="border-t border-border/50 bg-secondary/30 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                    <button className="py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white font-mono text-sm font-medium transition-colors">
                        Buy YES
                    </button>
                    <button className="py-3 rounded-lg bg-red-500 hover:bg-red-600 text-white font-mono text-sm font-medium transition-colors">
                        Buy NO
                    </button>
                </div>
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                    <span className="font-mono">Instant execution via Yellow SDK</span>
                </div>
            </div>
        </div>
    )
}
