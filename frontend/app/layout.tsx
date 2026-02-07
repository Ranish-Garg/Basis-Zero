import type { Metadata } from "next";
import { config } from "@/lib/wagmi";
import { Geist, Geist_Mono } from "next/font/google";
import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Providers } from "@/components/providers";
import { NitroliteConsole } from "@/components/admin/NitroliteConsole";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "Basis Zero — Zero Opportunity Cost Prediction Market",
        template: "%s — Basis Zero",
    },
    description: "Trade the world, keep your yield. Deposit USDC via Circle Arc, earn yield from BlackRock BUIDL RWAs, and trade prediction markets using only your accrued yield.",
};

// ... existing code ...

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body
                className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased`}
            >
                <ThemeProvider
                    attribute="class"
                    defaultTheme="dark"
                    enableSystem
                    disableTransitionOnChange
                >
                    <Providers>
                        {children}
                        <NitroliteConsole />
                    </Providers>
                </ThemeProvider>
            </body>
        </html>
    );
}
