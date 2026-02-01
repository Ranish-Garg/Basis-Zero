import { HeroSection } from "@/components/hero-section";
import { MetricsTicker } from "@/components/metrics-ticker";
import { HowItWorks } from "@/components/how-it-works";
import { MarketPreview } from "@/components/market-preview";
import type { Metadata } from "next";

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://basiszero.io';

export const metadata: Metadata = {
    title: "Basis Zero — Zero Opportunity Cost Prediction Market",
    description: "Trade the world, keep your yield. Deposit USDC via Circle Arc, earn yield from BlackRock BUIDL RWAs, and trade prediction markets using only your accrued yield.",
    keywords: ["prediction market", "DeFi", "yield farming", "RWA", "Circle Arc", "Yellow Network", "zero opportunity cost"],
    openGraph: {
        title: "Basis Zero — Zero Opportunity Cost Prediction Market",
        description: "Trade the world, keep your yield. Principal protection meets speculation.",
        url: baseUrl,
        type: "website",
        images: [
            {
                url: `${baseUrl}/og-image.png`,
                width: 1200,
                height: 630,
                alt: "Basis Zero — Zero Opportunity Cost Prediction Market",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "Basis Zero — Zero Opportunity Cost Prediction Market",
        description: "Trade the world, keep your yield. Principal protection meets speculation.",
        images: [`${baseUrl}/og-image.png`],
    },
    alternates: {
        canonical: baseUrl,
    },
};

export default function HomePage() {
    return (
        <div>
            <HeroSection />
            <MetricsTicker />
            <HowItWorks />
            <MarketPreview />
        </div>
    );
}
