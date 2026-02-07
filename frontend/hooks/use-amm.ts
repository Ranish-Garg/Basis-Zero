"use client";

/**
 * AMM Hooks - React Query hooks for AMM operations
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Outcome } from '@/lib/amm-types';
import type {
    Market,
    BetQuote,
    BetResult,
    SellResult,
    Position
} from '@/lib/amm-types';
import { yellowClientManager } from '@/lib/yellow-client';
import { type Hex, keccak256, encodePacked } from 'viem';
import { yellowEvents } from '@/lib/events';

// ═══════════════════════════════════════════════════════════════════════════
// QUERY KEYS
// ═══════════════════════════════════════════════════════════════════════════

export const ammKeys = {
    all: ['amm'] as const,
    markets: () => [...ammKeys.all, 'markets'] as const,
    market: (id: string) => [...ammKeys.markets(), id] as const,
    quote: (marketId: string, amount: string, outcome: Outcome) =>
        [...ammKeys.all, 'quote', marketId, amount, outcome] as const,
    position: (marketId: string, userId: string) =>
        [...ammKeys.all, 'position', marketId, userId] as const,
};

// ═══════════════════════════════════════════════════════════════════════════
// FETCH FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchMarkets(): Promise<{ markets: Market[] }> {
    const response = await fetch('/api/amm/markets');
    if (!response.ok) {
        throw new Error('Failed to fetch markets');
    }
    return response.json();
}

async function fetchQuote(
    marketId: string,
    amount: string,
    outcome: Outcome
): Promise<BetQuote> {
    const response = await fetch(
        `/api/amm/quote?marketId=${marketId}&amount=${amount}&outcome=${outcome}`
    );
    if (!response.ok) {
        throw new Error('Failed to get quote');
    }
    return response.json();
}

async function claimWinnings(params: {
    marketId: string;
    userId: string;
}): Promise<{ success: boolean; payout: string }> {
    const response = await fetch('/api/amm/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Failed to claim' }));
        throw new Error(error.error || 'Failed to claim winnings');
    }
    return response.json();
}

async function fetchPosition(
    marketId: string,
    userId: string
): Promise<{ position: Position | null }> {
    const response = await fetch(`/api/amm/position/${marketId}/${userId}`);
    if (!response.ok) {
        throw new Error('Failed to get position');
    }
    return response.json();
}

async function placeBet(params: {
    marketId: string;
    userId: string;
    sessionId: string;
    amount: string;
    outcome: Outcome;
}): Promise<BetResult> {
    
    // 1. Try to sign with Session Key
    let signature: Hex | undefined;
    let signedState: Hex | undefined;
    
    const client = yellowClientManager.getClient();
    const signerAddress = yellowClientManager.getSignerAddress();

    if (client && signerAddress) {
        // Create a representation of the state transition
        // In full implementation, this would be the actual Nitrolite 'State' object
        // encoded with ABI. For now, we sign the intent.
        const intentHash = keccak256(
            encodePacked(
                ['string', 'string', 'uint256', 'uint8'],
                [
                    params.marketId,
                    params.userId,
                    BigInt(params.amount),
                    params.outcome === Outcome.YES ? 0 : 1
                ]
            )
        );
        
        // Sign the intent
        try {
            signature = await yellowClientManager.signMessage(intentHash);
            
            // LOGGING FOR DEMO
            yellowEvents.emit({
                type: 'SIGNATURE',
                message: `Bet Signed with Session Key: ${signerAddress}`,
                hash: signature,
                data: {
                    marketId: params.marketId,
                    amount: params.amount,
                    outcome: params.outcome,
                    intentHash
                }
            });

        } catch (e) {
            console.warn("Failed to sign bet with session key:", e);
        }
    }

    const response = await fetch('/api/amm/bet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            ...params,
            signature,
            signerAddress // Send who signed it
        }),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to place bet');
    }
    return response.json();
}

async function sellPosition(params: {
    marketId: string;
    userId: string;
    amount: string;
    outcome: Outcome;
}): Promise<SellResult> {
    const response = await fetch('/api/amm/sell', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sell position');
    }
    return response.json();
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Hook to fetch all active markets
 */
export function useMarkets() {
    return useQuery({
        queryKey: ammKeys.markets(),
        queryFn: fetchMarkets,
        staleTime: 10 * 1000, // 10 seconds
        refetchInterval: 30 * 1000, // Refetch every 30 seconds
    });
}

/**
 * Hook to get a bet quote
 */
export function useQuote(
    marketId: string | null,
    amount: string,
    outcome: Outcome | null,
    enabled = true
) {
    return useQuery({
        queryKey: ammKeys.quote(marketId || '', amount, outcome || Outcome.YES),
        queryFn: () => fetchQuote(marketId!, amount, outcome!),
        enabled: enabled && !!marketId && !!amount && amount !== '0' && !!outcome,
        staleTime: 5 * 1000, // 5 seconds
    });
}

/**
 * Hook to get user's position in a market
 */
export function usePosition(marketId: string | null, userId: string | null) {
    return useQuery({
        queryKey: ammKeys.position(marketId || '', userId || ''),
        queryFn: () => fetchPosition(marketId!, userId!),
        enabled: !!marketId && !!userId,
        staleTime: 10 * 1000,
    });
}

/**
 * Hook to place a bet
 */
export function usePlaceBet() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: placeBet,
        onSuccess: (data, variables) => {
            // Invalidate markets to update prices
            queryClient.invalidateQueries({ queryKey: ammKeys.markets() });
            // Invalidate user's position
            queryClient.invalidateQueries({
                queryKey: ammKeys.position(variables.marketId, variables.userId)
            });
            // Invalidate streaming balance so Max amount updates after trade
            queryClient.invalidateQueries({ queryKey: ['streaming-balance-for-trade'] });
            // Invalidate trade history so profile updates
            queryClient.invalidateQueries({ queryKey: ['user-trades'] });
        },
    });
}

/**
 * Hook to sell a position
 */
export function useSellPosition() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: sellPosition,
        onSuccess: (data, variables) => {
            // Invalidate markets to update prices
            queryClient.invalidateQueries({ queryKey: ammKeys.markets() });
            // Invalidate user's position
            queryClient.invalidateQueries({
                queryKey: ammKeys.position(variables.marketId, variables.userId)
            });
            // Invalidate streaming balance so Max amount updates after sell
            queryClient.invalidateQueries({ queryKey: ['streaming-balance-for-trade'] });
            // Invalidate trade history so profile updates
            queryClient.invalidateQueries({ queryKey: ['user-trades'] });
        },
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// CREATE MARKET
// ═══════════════════════════════════════════════════════════════════════════

interface CreateMarketParams {
    marketId: string;
    title: string;
    description?: string;
    category?: string;
    expiresAt: string; // ISO date string
    initialLiquidity: string; // USDC amount in base units
    resolutionType?: 'manual' | 'oracle';
    oracleConfig?: Record<string, unknown>;
    resolverAddress?: string;
}

async function createMarket(params: CreateMarketParams): Promise<{ success: boolean; market: any }> {
    const response = await fetch('/api/amm/markets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create market');
    }

    return response.json();
}

/**
 * Hook to create a new prediction market
 */
export function useCreateMarket() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: createMarket,
        onSuccess: () => {
            // Invalidate markets to refresh the list
            queryClient.invalidateQueries({ queryKey: ammKeys.markets() });
        },
    });
}

/**
 * Hook to claim winnings
 */
export function useClaimWinnings() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: claimWinnings,
        onSuccess: () => {
            // Refresh positions and session balance
            queryClient.invalidateQueries({ queryKey: ['amm-positions'] });
            // Invalidate trade history so profile updates
            queryClient.invalidateQueries({ queryKey: ['user-trades'] });
        },
    });
}

