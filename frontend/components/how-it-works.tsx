"use client"

import { useRef, useState, useCallback } from "react"
import { Wallet, TrendingUp, Zap } from "lucide-react"

const steps = [
    {
        step: 1,
        icon: Wallet,
        title: "Deposit USDC",
        subtitle: "Yield Vault",
        description: "Deposit USDC into the vault where it immediately starts earning RWA yield",
    },
    {
        step: 2,
        icon: TrendingUp,
        title: "Earn RWA Yield",
        subtitle: "Simulated RWA",
        description: "Your USDC earns yield from tokenized Real-World Assets at 5.20% APY",
    },
    {
        step: 3,
        icon: Zap,
        title: "Trade with Yield",
        subtitle: "Yellow Network",
        description: "Use accrued yield for instant, off-chain prediction market trading",
    },
]

export function HowItWorks() {
    const headingRef = useRef<HTMLHeadingElement>(null)
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
    const [isHovering, setIsHovering] = useState(false)

    const handleMouseMove = useCallback((e: React.MouseEvent<HTMLHeadingElement>) => {
        if (!headingRef.current) return
        const rect = headingRef.current.getBoundingClientRect()
        setMousePosition({
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
        })
    }, [])

    return (
        <section id="how-it-works" className="px-4 sm:px-6 py-20 sm:py-28">
            <div className="mx-auto max-w-6xl">
                <div className="mb-12 sm:mb-16 text-center space-y-4 animate-fade-in-up">
                    <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">
                        How It Works
                    </p>
                    <h2
                        ref={headingRef}
                        onMouseMove={handleMouseMove}
                        onMouseEnter={() => setIsHovering(true)}
                        onMouseLeave={() => setIsHovering(false)}
                        className="relative text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl cursor-default overflow-hidden"
                    >
                        {/* Base text layer */}
                        <span className="relative z-10">
                            Zero Opportunity Cost,{" "}
                            <span className="bg-linear-to-r from-primary via-cyan-400 to-primary text-transparent bg-clip-text">
                                Maximum Returns
                            </span>
                        </span>

                        {/* Mouse-following spotlight gradient overlay */}
                        <span
                            className="absolute inset-0 z-20 bg-linear-to-r from-cyan-400 via-primary to-cyan-400 text-transparent bg-clip-text transition-opacity duration-300 pointer-events-none"
                            style={{
                                opacity: isHovering ? 1 : 0,
                                maskImage: `radial-gradient(circle 350px at ${mousePosition.x}px ${mousePosition.y}px, black 0%, transparent 100%)`,
                                WebkitMaskImage: `radial-gradient(circle 350px at ${mousePosition.x}px ${mousePosition.y}px, black 0%, transparent 100%)`,
                            }}
                        >
                            Zero Opportunity Cost,{" "}
                            <span>Maximum Returns</span>
                        </span>
                    </h2>
                    <p className="max-w-2xl mx-auto text-base sm:text-lg text-muted-foreground">
                        Your principal stays protected in yield-bearing RWAs while you speculate using only accrued interest
                    </p>
                </div>

                <div className="grid gap-6 sm:gap-8 lg:grid-cols-3">
                    {steps.map((step, index) => (
                        <div
                            key={step.step}
                            className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-6 sm:p-8 glass transition-all duration-400 hover-lift hover:border-primary/40 hover:bg-card/70 animate-fade-in-up"
                            style={{ animationDelay: `${index * 150}ms` }}
                        >
                            {/* Step number with gradient */}
                            <div className="absolute -right-4 -top-4 font-mono text-8xl font-bold bg-linear-to-br from-primary/20 via-cyan-400/15 to-transparent text-transparent bg-clip-text select-none">
                                {step.step}
                            </div>

                            {/* Icon */}
                            <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-card border border-border/60 shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:border-primary/40">
                                <step.icon className="h-7 w-7 text-primary" />
                            </div>

                            {/* Content */}
                            <div className="relative z-10 space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono text-xs text-primary uppercase tracking-wider">
                                        Step {step.step}
                                    </span>
                                    <span className="text-border">•</span>
                                    <span className="font-mono text-xs text-muted-foreground">
                                        {step.subtitle}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold tracking-tight sm:text-2xl transition-colors group-hover:text-primary">
                                    {step.title}
                                </h3>
                                <p className="text-sm leading-relaxed text-muted-foreground">
                                    {step.description}
                                </p>
                            </div>

                            {/* Connector line (except last) */}
                            {index < steps.length - 1 && (
                                <div className="hidden lg:block absolute -right-4 top-1/2 w-8 border-t-2 border-dashed border-primary/30" />
                            )}

                            {/* Bottom accent */}
                            <div className="absolute bottom-0 left-0 h-1 w-0 bg-linear-to-r from-primary via-cyan-400 to-transparent transition-all duration-500 group-hover:w-full" />
                        </div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-12 sm:mt-16 text-center animate-fade-in-up stagger-4">
                    <p className="mb-4 text-sm text-muted-foreground font-mono">
                        Your principal is never at risk. Only yield is used for trading.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-linear-to-r from-primary/10 to-cyan-400/10">
                        <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        <span className="font-mono text-xs bg-linear-to-r from-primary to-cyan-400 text-transparent bg-clip-text uppercase tracking-wider font-semibold">
                            Delta-Neutral Yield Strategy
                        </span>
                    </div>
                </div>
            </div>
        </section>
    )
}
