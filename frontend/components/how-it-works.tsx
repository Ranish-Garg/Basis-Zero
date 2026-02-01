"use client"

import { Wallet, TrendingUp, Zap } from "lucide-react"

const steps = [
    {
        step: 1,
        icon: Wallet,
        title: "Deposit USDC",
        subtitle: "Circle Arc",
        description: "Cross-chain deposit via Circle's CCTP from any supported chain",
        accent: "from-blue-500 to-cyan-500",
    },
    {
        step: 2,
        icon: TrendingUp,
        title: "Earn RWA Yield",
        subtitle: "BlackRock BUIDL",
        description: "Your USDC earns institutional-grade yield from tokenized T-Bills",
        accent: "from-green-500 to-emerald-500",
    },
    {
        step: 3,
        icon: Zap,
        title: "Trade with Yield",
        subtitle: "Yellow Network",
        description: "Use accrued yield for instant, off-chain prediction market trading",
        accent: "from-yellow-500 to-orange-500",
    },
]

export function HowItWorks() {
    return (
        <section id="how-it-works" className="px-4 sm:px-6 py-20 sm:py-28">
            <div className="mx-auto max-w-6xl">
                <div className="mb-12 sm:mb-16 text-center space-y-4 animate-fade-in-up">
                    <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">
                        How It Works
                    </p>
                    <h2 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                        Zero Opportunity Cost,{" "}
                        <span className="bg-linear-to-l from-primary/50 to-accent text-transparent bg-clip-text">
                            Maximum Returns
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
                            {/* Step number */}
                            <div className="absolute -right-4 -top-4 font-mono text-8xl font-bold text-primary/5 select-none">
                                {step.step}
                            </div>

                            {/* Icon */}
                            <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-linear-to-br ${step.accent} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                                <step.icon className="h-7 w-7 text-white" />
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
                            <div className="absolute bottom-0 left-0 h-1 w-0 bg-linear-to-r from-primary via-primary/80 to-transparent transition-all duration-500 group-hover:w-full" />
                        </div>
                    ))}
                </div>

                {/* Bottom CTA */}
                <div className="mt-12 sm:mt-16 text-center animate-fade-in-up stagger-4">
                    <p className="mb-4 text-sm text-muted-foreground font-mono">
                        Your principal is never at risk. Only yield is used for trading.
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-primary/30 bg-primary/10">
                        <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        <span className="font-mono text-xs text-primary uppercase tracking-wider">
                            Delta-Neutral Yield Strategy
                        </span>
                    </div>
                </div>
            </div>
        </section>
    )
}
