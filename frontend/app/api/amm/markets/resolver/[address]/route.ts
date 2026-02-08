/**
 * AMM Markets By Resolver API Route - Proxies to Backend
 * Fetches all markets (any status) created by a specific resolver address
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
            `${BACKEND_URL}/api/amm/markets/resolver/${address}`
        );

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[AMM Markets By Resolver] Backend error:', error);
        return NextResponse.json({ markets: [] }, { status: 200 });
    }
}
