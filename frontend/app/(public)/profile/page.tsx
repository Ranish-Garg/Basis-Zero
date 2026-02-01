import { SessionManager } from "@/components/profile/session-manager"
import { TradingHistory } from "@/components/profile/trading-history"
import type { Metadata } from "next"

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://basiszero.io'

export const metadata: Metadata = {
    title: "Profile — Basis Zero",
    description: "Manage your Yellow Network sessions and view your trading history with yield vs principal breakdown.",
    keywords: ["profile", "Yellow Network", "trading history", "session", "Nitrolite"],
    openGraph: {
        title: "Profile — Basis Zero",
        description: "Manage sessions and view trading history.",
        url: `${baseUrl}/profile`,
        type: "website",
    },
}

export default function ProfilePage() {
    return (
        <div className="min-h-screen pt-24 pb-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
                {/* Page Header */}
                <div className="mb-8 space-y-2">
                    <p className="font-mono text-xs uppercase tracking-[0.25em] sm:tracking-[0.35em] text-primary">
                        Account
                    </p>
                    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
                        Profile
                    </h1>
                    <p className="max-w-2xl text-base text-muted-foreground">
                        Manage your Yellow Network off-chain sessions and view your complete trading history.
                    </p>
                </div>

                {/* Main Grid Layout */}
                <div className="grid gap-6 lg:grid-cols-12">
                    {/* Left Column - Session Manager */}
                    <div className="lg:col-span-5">
                        <SessionManager />
                    </div>

                    {/* Right Column - Trading History */}
                    <div className="lg:col-span-7">
                        <TradingHistory />
                    </div>
                </div>
            </div>
        </div>
    )
}
