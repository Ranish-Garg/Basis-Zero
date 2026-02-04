"use client"

import dynamic from 'next/dynamic'

const DepositWidget = dynamic(() => import('@/components/vault/deposit-widget').then(mod => mod.DepositWidget), { ssr: false })
const PortfolioView = dynamic(() => import('@/components/vault/portfolio-view').then(mod => mod.PortfolioView), { ssr: false })
const WithdrawalWidget = dynamic(() => import('@/components/vault/withdrawal-widget').then(mod => mod.WithdrawalWidget), { ssr: false })
const YieldInjectionWidget = dynamic(() => import('@/components/vault/yield-injection-widget').then(mod => mod.YieldInjectionWidget), { ssr: false })

export function VaultClient() {
    return (
        <div className="min-h-screen pt-24 pb-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                {/* Page Header */}
                <div className="mb-8 space-y-2">
                    <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">
                        Liquidity Management
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        Vault
                    </h1>
                    <p className="max-w-2xl text-base text-muted-foreground">
                        Deposit USDC from any chain and earn yield from BlackRock BUIDL tokenized T-Bills.
                        Your principal is always protected.
                    </p>
                </div>

                {/* Main Grid Layout */}
                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Left Column - Deposit & Withdrawal */}
                    <div className="lg:col-span-5 space-y-6">
                        <DepositWidget />
                        <WithdrawalWidget />
                    </div>

                    {/* Right Column - Portfolio View */}
                    <div className="lg:col-span-7 space-y-6">
                        <PortfolioView />
                        <YieldInjectionWidget />
                    </div>
                </div>
            </div>
        </div>
    )
}
