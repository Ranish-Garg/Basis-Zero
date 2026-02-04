/**
 * AMM Bet API Route
 * 
 * POST: Place a bet on a market
 */

import { NextRequest, NextResponse } from 'next/server';
import { placeBetPersistent } from '@/lib/amm/persistent-pool-manager';
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

        const result = await placeBetPersistent(
            marketId,
            userId,
            BigInt(amount),
            outcomeEnum
        );

        return NextResponse.json({
            success: true,
            shares: result.totalShares.toString(),
            price: result.effectivePrice,
            newProbability: result.newProbability
        });
    } catch (error) {
        console.error('[AMM Bet] Error:', error);
        return NextResponse.json(
            { error: String(error) },
            { status: 500 }
        );
    }
}
