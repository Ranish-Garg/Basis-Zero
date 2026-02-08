/**
 * AMM Position API Route - Proxies to Backend
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ marketId: string; userId: string }> }
) {
    try {
        const { marketId, userId } = await params;

        const response = await fetch(
            `${BACKEND_URL}/api/amm/position/${marketId}/${userId}`
        );

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[AMM Position] Backend error:', error);
        return NextResponse.json({ position: null }, { status: 200 });
    }
}
