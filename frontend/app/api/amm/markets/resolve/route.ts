/**
 * AMM Resolve Market API Route - Proxies to Backend
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();

        // Check if backend URL is available
        if (!BACKEND_URL) {
            return NextResponse.json(
                { error: 'Backend configuration missing' },
                { status: 500 }
            );
        }

        const response = await fetch(`${BACKEND_URL}/api/amm/resolve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ error: 'Backend error' }));
            return NextResponse.json(error, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error('[AMM Resolve] Backend error:', error);
        return NextResponse.json(
            { error: 'Failed to connect to backend service' },
            { status: 500 }
        );
    }
}
