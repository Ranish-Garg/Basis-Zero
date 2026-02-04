/**
 * AMM Quote API Route
 * 
 * GET: Get a quote for a potential bet
 */

import { NextRequest, NextResponse } from 'next/server';
import { getQuotePersistent } from '@/lib/amm/persistent-pool-manager';
import { Outcome } from '@/lib/amm/types';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const marketId = searchParams.get('marketId');
        const amount = searchParams.get('amount');
        const outcome = searchParams.get('outcome');

        if (!marketId || !amount || !outcome) {
            return NextResponse.json(
                { error: 'Missing required parameters: marketId, amount, outcome' },
                { status: 400 }
            );
        }

        const outcomeEnum = outcome === 'YES' ? Outcome.YES : Outcome.NO;
        const quote = await getQuotePersistent(
            marketId,
            BigInt(amount),
            outcomeEnum
        );

        if (!quote) {
            return NextResponse.json(
                { error: 'Market not found or not active' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            expectedShares: quote.expectedShares.toString(),
            effectivePrice: quote.effectivePrice,
            priceImpact: quote.priceImpact
        });
    } catch (error) {
        console.error('[AMM Quote] Error:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
