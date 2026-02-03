/**
 * AMM Repository - Database Access Layer for Markets, Sessions, and Positions
 */

import { getSupabase } from './supabase';
import { PoolState, Outcome } from '../amm/types';

// ═══════════════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export interface MarketRow {
    market_id: string;
    title: string;
    description: string | null;
    expires_at: string;
    yes_reserves: string;
    no_reserves: string;
    k_invariant: string;
    status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
    resolution_value: 'YES' | 'NO' | null;
    created_at: string;
}

export interface SessionRow {
    session_id: string;
    user_address: string;
    status: 'OPEN' | 'CLOSING' | 'CLOSED';
    initial_collateral: string;
    current_balance: string;
    latest_signature: string;
    nonce: number;
    created_at: string;
    updated_at: string;
}

export interface PositionRow {
    id: string;
    user_id: string;
    market_id: string;
    outcome: 'YES' | 'NO';
    shares: string;
    average_entry_price: number;
    created_at: string;
}

export interface CreateMarketInput {
    marketId: string;
    title: string;
    description?: string;
    expiresAt: Date;
    yesReserves: bigint;
    noReserves: bigint;
    kInvariant: bigint;
}

// ═══════════════════════════════════════════════════════════════════════════
// MARKET OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function createMarket(input: CreateMarketInput): Promise<MarketRow> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('markets')
        .insert({
            market_id: input.marketId,
            title: input.title,
            description: input.description ?? null,
            expires_at: input.expiresAt.toISOString(),
            yes_reserves: input.yesReserves.toString(),
            no_reserves: input.noReserves.toString(),
            k_invariant: input.kInvariant.toString(),
            status: 'ACTIVE'
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create market: ${error.message}`);
    return data;
}

export async function getMarket(marketId: string): Promise<MarketRow | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('markets')
        .select('*')
        .eq('market_id', marketId)
        .single();

    if (error?.code === 'PGRST116') return null; // Not found
    if (error) throw new Error(`Failed to get market: ${error.message}`);
    return data;
}

export async function getActiveMarkets(): Promise<MarketRow[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('markets')
        .select('*')
        .eq('status', 'ACTIVE')
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get active markets: ${error.message}`);
    return data ?? [];
}

export async function updateMarketReserves(
    marketId: string,
    yesReserves: bigint,
    noReserves: bigint,
    kInvariant: bigint
): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
        .from('markets')
        .update({
            yes_reserves: yesReserves.toString(),
            no_reserves: noReserves.toString(),
            k_invariant: kInvariant.toString()
        })
        .eq('market_id', marketId);

    if (error) throw new Error(`Failed to update market reserves: ${error.message}`);
}

export async function resolveMarket(
    marketId: string,
    winner: Outcome
): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
        .from('markets')
        .update({
            status: 'RESOLVED',
            resolution_value: winner === Outcome.YES ? 'YES' : 'NO'
        })
        .eq('market_id', marketId);

    if (error) throw new Error(`Failed to resolve market: ${error.message}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// SESSION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function createSession(
    sessionId: string,
    userAddress: string,
    initialCollateral: bigint,
    signature: string
): Promise<SessionRow> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('sessions')
        .insert({
            session_id: sessionId,
            user_address: userAddress,
            initial_collateral: initialCollateral.toString(),
            current_balance: initialCollateral.toString(),
            latest_signature: signature,
            nonce: 0
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to create session: ${error.message}`);
    return data;
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`Failed to get session: ${error.message}`);
    return data;
}

export async function updateSessionBalance(
    sessionId: string,
    newBalance: bigint,
    newSignature: string,
    newNonce: number
): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
        .from('sessions')
        .update({
            current_balance: newBalance.toString(),
            latest_signature: newSignature,
            nonce: newNonce
        })
        .eq('session_id', sessionId);

    if (error) throw new Error(`Failed to update session: ${error.message}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// POSITION OPERATIONS
// ═══════════════════════════════════════════════════════════════════════════

export async function getPosition(
    userId: string,
    marketId: string,
    outcome: Outcome
): Promise<PositionRow | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', userId)
        .eq('market_id', marketId)
        .eq('outcome', outcome === Outcome.YES ? 'YES' : 'NO')
        .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`Failed to get position: ${error.message}`);
    return data;
}

export async function getUserPositions(userId: string): Promise<PositionRow[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', userId);

    if (error) throw new Error(`Failed to get user positions: ${error.message}`);
    return data ?? [];
}

export async function getMarketPositions(marketId: string): Promise<PositionRow[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('positions')
        .select('*')
        .eq('market_id', marketId);

    if (error) throw new Error(`Failed to get market positions: ${error.message}`);
    return data ?? [];
}

export async function upsertPosition(
    userId: string,
    marketId: string,
    outcome: Outcome,
    shares: bigint,
    averageEntryPrice: number
): Promise<PositionRow> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('positions')
        .upsert({
            user_id: userId,
            market_id: marketId,
            outcome: outcome === Outcome.YES ? 'YES' : 'NO',
            shares: shares.toString(),
            average_entry_price: averageEntryPrice
        }, {
            onConflict: 'user_id,market_id,outcome'
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to upsert position: ${error.message}`);
    return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function marketRowToPoolState(row: MarketRow): PoolState {
    return {
        marketId: row.market_id,
        yesReserves: BigInt(row.yes_reserves),
        noReserves: BigInt(row.no_reserves),
        k: BigInt(row.k_invariant),
        virtualLiquidity: BigInt(row.yes_reserves), // Assume initial liquidity = reserves
        totalCollateral: 0n,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: Date.now()
    };
}
