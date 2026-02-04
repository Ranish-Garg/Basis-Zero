/**
 * AMM Sell API Route
 * 
 * POST: Sell a position back to the pool
 */

import { NextRequest, NextResponse } from 'next/server';
import { sellPositionPersistent } from '@/lib/amm/persistent-pool-manager';
import { Outcome } from '@/lib/amm/types';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { marketId, userId, amount, outcome } = body;

        if (!marketId || !userId || !amount || outcome === undefined) {
            return NextResponse.json(
                { error: 'Missing required parameters: marketId, userId, amount, outcome' },
                { status: 400 }
            );
        }

        const outcomeEnum = outcome === 'YES' || outcome === Outcome.YES ? Outcome.YES : Outcome.NO;

        const result = await sellPositionPersistent(
            marketId,
            userId,
            BigInt(amount),
            outcomeEnum
        );

        return NextResponse.json({
            success: true,
            usdcOut: result.usdcOut.toString(),
            priceImpact: result.priceImpact
        });
    } catch (error) {
        console.error('[AMM Sell] Error:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
