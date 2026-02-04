/**
 * AMM Position API Route
 * 
 * GET: Get user's position in a market
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPositionPersistent } from '@/lib/amm/persistent-pool-manager';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ marketId: string; userId: string }> }
) {
    try {
        const { marketId, userId } = await params;

        const position = await getPositionPersistent(marketId, userId);

        return NextResponse.json({ position });
    } catch (error) {
        console.error('[AMM Position] Error:', error);
        return NextResponse.json(
            { error: String(error), position: null },
            { status: 200 }
        );
    }
}
