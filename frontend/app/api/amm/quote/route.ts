/**
 * AMM Quote API Route - Proxies to Backend
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const marketId = searchParams.get('marketId');
        const amount = searchParams.get('amount');
        const outcome = searchParams.get('outcome');

        if (!marketId || !amount || !outcome) {
            return NextResponse.json(
                { error: 'Missing parameters' },
                { status: 400 }
            );
        }

        // Backend expects outcome as a number (0 for YES, 1 for NO)
        const outcomeNum = outcome === 'YES' ? 0 : 1;

        const response = await fetch(
            `${BACKEND_URL}/api/amm/quote?marketId=${marketId}&amount=${amount}&outcome=${outcomeNum}`
        );

        const data = await response.json();

        // Map backend response back to frontend format if needed
        return NextResponse.json({
            expectedShares: data.shares,
            effectivePrice: data.effectivePrice,
            priceImpact: data.priceImpact
        });
    } catch (error) {
        console.error('[AMM Quote] Backend error:', error);
        return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
    }
}
