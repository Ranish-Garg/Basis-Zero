/**
 * Session Close API Route - Proxies to Backend
 * Closes an active trading session via the backend, gets settlement signature
 */

import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { sessionId } = body;

        if (!sessionId) {
            return NextResponse.json(
                { error: 'Session ID is required' },
                { status: 400 }
            );
        }

        // Call backend to close session and get settlement signature
        const response = await fetch(`${BACKEND_URL}/api/session/close`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
        });

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        // Returns: { success, pnl, signature, sessionId }
        return NextResponse.json(data);
    } catch (error) {
        console.error('[Session Close] Backend error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Failed to close session' },
            { status: 500 }
        );
    }
}
