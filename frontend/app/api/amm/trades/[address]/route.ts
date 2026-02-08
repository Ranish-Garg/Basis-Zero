/**
 * AMM Trades API Route - Proxies to Backend
 * Fetches all trade history for a user address
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ address: string }> }
) {
    try {
        const { address } = await params;

        const response = await fetch(
            `${BACKEND_URL}/api/amm/trades/${address}`
        );

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[AMM Trades] Backend error:', error);
        return NextResponse.json({ trades: [] }, { status: 200 });
    }
}
