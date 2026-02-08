/**
 * AMM User Positions API Route - Proxies to Backend
 * Fetches all positions for a user across all markets
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;

        const response = await fetch(
            `${BACKEND_URL}/api/amm/positions/${userId}`
        );

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[AMM User Positions] Backend error:', error);
        return NextResponse.json({ positions: [], totalValue: '0' }, { status: 200 });
    }
}
