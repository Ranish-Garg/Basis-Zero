import { DepositWidget } from "@/components/vault/deposit-widget"
import { PortfolioView } from "@/components/vault/portfolio-view"
import { WithdrawalWidget } from "@/components/vault/withdrawal-widget"
import type { Metadata } from "next"

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://basiszero.io'

export const metadata: Metadata = {
    title: "Vault — Basis Zero",
    description: "Deposit USDC via Circle Arc and earn yield from BlackRock BUIDL RWAs. Manage your cross-chain liquidity.",
    keywords: ["USDC vault", "Circle Arc", "CCTP", "RWA yield", "BlackRock BUIDL", "cross-chain"],
    openGraph: {
        title: "Vault — Basis Zero",
        description: "Deposit USDC and earn institutional-grade RWA yield.",
        url: `${baseUrl}/vault`,
        type: "website",
    },
}

export default function VaultPage() {
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
                    <div className="lg:col-span-7">
                        <PortfolioView />
                    </div>
                </div>
            </div>
        </div>
    )
}
