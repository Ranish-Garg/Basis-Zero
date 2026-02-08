/**
 * AMM Sell API Route - Proxies to Backend
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { marketId, userId, amount, outcome } = body;

        // Backend expects outcome as a number (0 for YES, 1 for NO)
        const outcomeNum = outcome === 'YES' ? 0 : 1;

        const response = await fetch(`${BACKEND_URL}/api/amm/sell`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                marketId,
                userId,
                amount,
                outcome: outcomeNum
            }),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('[AMM Sell] Backend error:', error);
        return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
    }
}
