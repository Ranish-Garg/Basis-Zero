"use client"

import { useEffect, useRef } from "react"

interface Metric {
    label: string
    value: string
    trend?: "up" | "down" | "neutral"
}

const metrics: Metric[] = [
    { label: "BUIDL APY", value: "5.12%", trend: "up" },
    { label: "TVL", value: "$2.4M", trend: "up" },
    { label: "Active Markets", value: "24", trend: "neutral" },
    { label: "24h Volume", value: "$890K", trend: "up" },
    { label: "Yield Distributed", value: "$156K", trend: "up" },
    { label: "Circle Arc Deposits", value: "1,247", trend: "up" },
]

export function MetricsTicker() {
    const scrollRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const scrollContainer = scrollRef.current
        if (!scrollContainer) return

        const scrollAnimation = () => {
            if (scrollContainer.scrollLeft >= scrollContainer.scrollWidth / 2) {
                scrollContainer.scrollLeft = 0
            } else {
                scrollContainer.scrollLeft += 1
            }
        }

        const intervalId = setInterval(scrollAnimation, 30)
        return () => clearInterval(intervalId)
    }, [])

    return (
        <div className="w-full border-y border-border/50 bg-card/30 backdrop-blur-sm overflow-hidden">
            <div
                ref={scrollRef}
                className="flex items-center gap-8 py-3 px-4 overflow-x-hidden whitespace-nowrap"
                style={{ scrollBehavior: 'auto' }}
            >
                {/* Double the metrics for seamless scrolling */}
                {[...metrics, ...metrics].map((metric, index) => (
                    <div
                        key={`${metric.label}-${index}`}
                        className="flex items-center gap-3 shrink-0"
                    >
                        <span className="font-mono text-xs text-muted-foreground uppercase tracking-wider">
                            {metric.label}:
                        </span>
                        <span className={`font-mono text-sm font-semibold ${metric.trend === "up"
                                ? "text-green-500"
                                : metric.trend === "down"
                                    ? "text-red-500"
                                    : "text-primary"
                            }`}>
                            {metric.value}
                        </span>
                        {metric.trend === "up" && (
                            <span className="text-green-500 text-xs">↑</span>
                        )}
                        {metric.trend === "down" && (
                            <span className="text-red-500 text-xs">↓</span>
                        )}
                        {index < [...metrics, ...metrics].length - 1 && (
                            <span className="text-border/50 mx-4">•</span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
