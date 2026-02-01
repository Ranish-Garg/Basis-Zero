"use client"

import Link from "next/link"
import { useEffect, useState } from "react"

const roles = ["yield farming", "prediction markets", "RWA exposure", "zero opportunity cost", "delta-neutral trading"]

export function HeroSection() {
  const [currentRole, setCurrentRole] = useState(0)
  const [displayText, setDisplayText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    const targetText = roles[currentRole]
    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (displayText.length < targetText.length) {
            setDisplayText(targetText.slice(0, displayText.length + 1))
          } else {
            setTimeout(() => setIsDeleting(true), 2000)
          }
        } else {
          if (displayText.length > 0) {
            setDisplayText(displayText.slice(0, -1))
          } else {
            setIsDeleting(false)
            setCurrentRole((prev) => (prev + 1) % roles.length)
          }
        }
      },
      isDeleting ? 50 : 100,
    )
    return () => clearTimeout(timeout)
  }, [displayText, isDeleting, currentRole])

  return (
    <section className="relative min-h-screen overflow-hidden">
      {/* Video Background */}
      <div className="absolute inset-0 w-full h-full">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/204306-923909642_small.mp4" type="video/mp4" />
        </video>
        {/* Dark overlay - subtle to keep video visible */}
        <div className="absolute inset-0 bg-background/50" />
        {/* Gradient overlay - only darken bottom for content readability */}
        <div className="absolute inset-0 bg-linear-to-t from-background via-background/20 to-transparent" />
      </div>

      {/* Content Overlay - positioned from top with padding */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 text-center pt-32 sm:pt-40 pb-20">
        <div className="space-y-8 sm:space-y-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 backdrop-blur-sm px-4 py-2 animate-fade-in-up">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-wider text-primary">
              Zero Opportunity Cost Prediction Market
            </span>
          </div>

          {/* Main Title */}
          <div className="space-y-4 animate-fade-in-up stagger-1">
            <h1 className="text-5xl font-bold tracking-tight sm:text-6xl lg:text-7xl xl:text-8xl text-balance">
              Trade the World,
              <br />
              <span className="inline-block min-h-[1.2em] bg-linear-to-r from-primary via-cyan-400 to-primary text-transparent bg-clip-text typing-cursor">
                {displayText || "\u00A0"}
              </span>
            </h1>
          </div>

          {/* Subtitle */}
          <p className="mx-auto max-w-2xl text-lg sm:text-xl leading-relaxed text-muted-foreground animate-fade-in-up stagger-2">
            Deposit USDC via <span className="text-foreground font-semibold">Circle Arc</span>, earn yield from
            <span className="text-foreground font-semibold"> BlackRock BUIDL</span> RWAs, and trade prediction markets
            using only your accrued yield. <span className="text-primary">Principal protection meets speculation.</span>
          </p>

          {/* Stats Row */}
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12 py-4 animate-fade-in-up stagger-3">
            <div className="text-center">
              <p className="font-mono text-2xl sm:text-3xl font-bold text-foreground">$2.4M</p>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">TVL</p>
            </div>
            <div className="h-8 w-px bg-border/50" />
            <div className="text-center">
              <p className="font-mono text-2xl sm:text-3xl font-bold text-primary">5.12%</p>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">BUIDL APY</p>
            </div>
            <div className="h-8 w-px bg-border/50" />
            <div className="text-center">
              <p className="font-mono text-2xl sm:text-3xl font-bold text-foreground">24</p>
              <p className="font-mono text-xs text-muted-foreground uppercase tracking-wider">Markets</p>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up stagger-4">
            <Link
              href="/trade"
              className="group relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-lg bg-primary px-8 py-4 font-mono text-sm font-medium text-primary-foreground transition-all duration-500 hover:scale-105 active:scale-[0.98] shadow-lg shadow-primary/25"
            >
              <span className="relative z-10">Launch App</span>
              <span className="relative z-10 transition-transform duration-300 group-hover:translate-x-1">→</span>
            </Link>
            <a
              href="#how-it-works"
              className="group inline-flex items-center justify-center gap-3 rounded-lg border border-border/50 bg-background/50 backdrop-blur-sm px-8 py-4 font-mono text-sm text-muted-foreground transition-all duration-300 hover:border-foreground hover:text-foreground hover:bg-secondary/50 active:scale-[0.98]"
            >
              <span>How It Works</span>
              <span className="opacity-0 -translate-x-2 transition-all duration-300 group-hover:opacity-100 group-hover:translate-x-0">
                →
              </span>
            </a>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 animate-fade-in stagger-6">
        <span className="font-mono text-xs text-muted-foreground">scroll</span>
        <div className="w-px h-12 bg-linear-to-b from-primary/50 to-transparent animate-pulse" />
      </div>
    </section>
  )
}
