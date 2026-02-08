/**
 * AMM Markets API Route - Proxies to Backend
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function GET() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/amm/markets`);
        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[AMM Markets] Backend error:', error);
        return NextResponse.json({ markets: [] }, { status: 200 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Backend expects 'create' endpoint for POST
        const response = await fetch(`${BACKEND_URL}/api/amm/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        const data = await response.json();
        return NextResponse.json(data, { status: response.status });
    } catch (error) {
        console.error('[AMM Create Market] Backend error:', error);
        return NextResponse.json({ error: 'Backend unavailable' }, { status: 503 });
    }
}
