/**
 * AMM Markets API Route
 * 
 * GET: List all active markets
 * POST: Create a new market
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMarketPersistent, getMarketsPersistent } from '@/lib/amm/persistent-pool-manager';

export async function GET() {
    try {
        const markets = await getMarketsPersistent();

        return NextResponse.json({ markets });
    } catch (error) {
        console.error('[AMM Markets] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch markets', markets: [] },
            { status: 200 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { marketId, title, description, initialLiquidity, expiresAt } = body;

        if (!marketId || !initialLiquidity) {
            return NextResponse.json(
                { error: 'Missing required parameters: marketId, initialLiquidity' },
                { status: 400 }
            );
        }

        const market = await createMarketPersistent({
            marketId,
            title: title || marketId,
            description,
            initialLiquidity: BigInt(initialLiquidity),
            expiresAt: expiresAt ? new Date(expiresAt) : undefined
        });

        return NextResponse.json({
            success: true,
            market
        });
    } catch (error) {
        console.error('[AMM Create Market] Error:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
