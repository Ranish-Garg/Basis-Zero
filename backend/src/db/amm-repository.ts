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
    category: string | null;
    expires_at: string;
    yes_reserves: string;
    no_reserves: string;
    k_invariant: string;
    status: 'ACTIVE' | 'RESOLVED' | 'CANCELLED';
    resolution_value: 'YES' | 'NO' | null;
    resolution_type: 'manual' | 'oracle' | null;
    oracle_config: Record<string, unknown> | null;
    resolver_address: string | null;
    resolved_at: string | null;
    resolved_by: string | null;
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
    category?: string;
    expiresAt: Date;
    yesReserves: bigint;
    noReserves: bigint;
    kInvariant: bigint;
    resolutionType?: 'manual' | 'oracle';
    oracleConfig?: Record<string, unknown>;
    resolverAddress?: string;
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
            category: input.category ?? 'general',
            expires_at: input.expiresAt.toISOString(),
            yes_reserves: input.yesReserves.toString(),
            no_reserves: input.noReserves.toString(),
            k_invariant: input.kInvariant.toString(),
            status: 'ACTIVE',
            resolution_type: input.resolutionType ?? 'manual',
            oracle_config: input.oracleConfig ?? null,
            resolver_address: input.resolverAddress ?? null
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

export async function getMarketsByResolver(resolverAddress: string): Promise<MarketRow[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('markets')
        .select('*')
        .ilike('resolver_address', resolverAddress)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get markets by resolver: ${error.message}`);
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
    winner: Outcome,
    resolvedBy?: string
): Promise<void> {
    const supabase = getSupabase();

    // First, fetch the market to check expiry
    const { data: market, error: fetchError } = await supabase
        .from('markets')
        .select('expires_at, status, resolver_address')
        .eq('market_id', marketId)
        .single();

    if (fetchError || !market) {
        throw new Error(`Market not found: ${marketId}`);
    }

    // Check if market is already resolved
    if (market.status === 'RESOLVED') {
        throw new Error('Market is already resolved');
    }

    // Check if market has expired (resolver can only resolve AFTER expiry)
    const expiresAt = new Date(market.expires_at);
    const now = new Date();
    if (now < expiresAt) {
        throw new Error(`Market cannot be resolved until after expiry: ${expiresAt.toISOString()}`);
    }

    // Optionally validate resolver address (if set)
    if (market.resolver_address && resolvedBy && 
        market.resolver_address.toLowerCase() !== resolvedBy.toLowerCase()) {
        throw new Error(`Unauthorized resolver. Only ${market.resolver_address} can resolve this market.`);
    }

    const { error } = await supabase
        .from('markets')
        .update({
            status: 'RESOLVED',
            resolution_value: winner === Outcome.YES ? 'YES' : 'NO',
            resolved_at: new Date().toISOString(),
            resolved_by: resolvedBy ?? 'system'
        })
        .eq('market_id', marketId);

    if (error) throw new Error(`Failed to resolve market: ${error.message}`);
}

/**
 * Get markets that are expired and pending resolution
 */
export async function getMarketsToResolve(): Promise<MarketRow[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('markets')
        .select('*')
        .eq('status', 'ACTIVE')
        .lt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true });

    if (error) throw new Error(`Failed to get markets to resolve: ${error.message}`);
    return data ?? [];
}

/**
 * Get oracle markets that are expired
 */
export async function getOracleMarketsToResolve(): Promise<MarketRow[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('markets')
        .select('*')
        .eq('status', 'ACTIVE')
        .eq('resolution_type', 'oracle')
        .lt('expires_at', new Date().toISOString())
        .order('expires_at', { ascending: true });

    if (error) throw new Error(`Failed to get oracle markets to resolve: ${error.message}`);
    return data ?? [];
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

export async function getSessionByUser(userAddress: string): Promise<SessionRow | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_address', userAddress)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error?.code === 'PGRST116') return null;
    if (error) throw new Error(`Failed to get user session: ${error.message}`);
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

export async function upsertSession(
    sessionId: string,
    userAddress: string,
    collateral: bigint,
    rateBps: number,
    safeMode: boolean
): Promise<void> {
    const supabase = getSupabase();

    const { error } = await supabase
        .from('sessions')
        .upsert({
            session_id: sessionId,
            user_address: userAddress,
            initial_collateral: collateral.toString(),
            current_balance: collateral.toString(), // Estimate
            rwa_rate_bps: rateBps,
            safe_mode_enabled: safeMode,
            status: 'OPEN',
            latest_signature: 'init',
            nonce: 0
        }, {
            onConflict: 'session_id'
        });

    if (error) throw new Error(`Failed to upsert session: ${error.message}`);
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

/**
 * Get positions only from ACTIVE markets (not resolved/cancelled)
 * Used for calculating locked balance — resolved positions shouldn't count as locked
 */
export async function getUserActivePositions(userId: string): Promise<(PositionRow & { market_status: string })[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('positions')
        .select('*, markets!inner(status)')
        .eq('user_id', userId)
        .gt('shares', '0');

    if (error) throw new Error(`Failed to get active positions: ${error.message}`);

    // Filter to only ACTIVE markets and flatten
    return (data ?? [])
        .filter((row: any) => row.markets?.status === 'ACTIVE')
        .map((row: any) => ({
            id: row.id,
            user_id: row.user_id,
            market_id: row.market_id,
            outcome: row.outcome,
            shares: row.shares,
            average_entry_price: row.average_entry_price,
            created_at: row.created_at,
            market_status: row.markets?.status || 'ACTIVE'
        }));
}

/**
 * Ensure a session exists in the database (auto-create if not)
 * This allows using on-chain sessionIds without explicit session registration
 * The positions table has FK to sessions.session_id, so we need sessions not users
 */
export async function ensureSessionExists(sessionId: string, userAddress?: string): Promise<void> {
    const supabase = getSupabase();

    // Check if session already exists
    const { data: existing } = await supabase
        .from('sessions')
        .select('session_id')
        .eq('session_id', sessionId)
        .single();

    if (existing) return; // Session exists

    // Auto-create session for betting - require userAddress to avoid storing invalid data
    if (!userAddress) {
        console.warn(`[AMM] Cannot auto-create session ${sessionId}: userAddress is required`);
        return; // Skip auto-creation without proper userAddress
    }

    const { error } = await supabase
        .from('sessions')
        .insert({
            session_id: sessionId,
            user_address: userAddress,
            status: 'OPEN',
            initial_collateral: '0',
            current_balance: '0',
            latest_signature: 'auto-created',
            nonce: 0
        });

    if (error && !error.message.includes('duplicate')) {
        console.warn(`Warning: Could not ensure session exists: ${error.message}`);
    } else {
        console.log(`[AMM] Auto-created session: ${sessionId}`);
    }
}

/**
 * Get the user_address for a given session
 */
export async function getSessionUserAddress(sessionId: string): Promise<string | null> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('sessions')
        .select('user_address')
        .eq('session_id', sessionId)
        .single();

    if (error?.code === 'PGRST116') return null;
    if (error) return null;
    return data?.user_address ?? null;
}

export async function upsertPosition(
    userId: string,
    marketId: string,
    outcome: Outcome,
    shares: bigint,
    averageEntryPrice: number
): Promise<PositionRow> {
    const supabase = getSupabase();

    // Auto-create session if not exists (userId is actually sessionId due to FK)
    await ensureSessionExists(userId);

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
// TRADE OPERATIONS (PnL Tracking)
// ═══════════════════════════════════════════════════════════════════════════

export interface TradeRow {
    id: string;
    session_id: string;
    user_address: string;
    market_id: string;
    trade_type: 'BUY' | 'SELL' | 'CLAIM';
    outcome: 'YES' | 'NO';
    shares: string;
    price: number;
    cost_basis: string;
    realized_pnl: string;
    market_title: string | null;
    created_at: string;
}

export interface InsertTradeInput {
    sessionId: string;
    userAddress: string;
    marketId: string;
    tradeType: 'BUY' | 'SELL' | 'CLAIM';
    outcome: Outcome;
    shares: bigint;
    price: number;
    costBasis: bigint;
    realizedPnl: bigint;
    marketTitle?: string;
}

export async function insertTrade(input: InsertTradeInput): Promise<TradeRow> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('trades')
        .insert({
            session_id: input.sessionId,
            user_address: input.userAddress,
            market_id: input.marketId,
            trade_type: input.tradeType,
            outcome: input.outcome === Outcome.YES ? 'YES' : 'NO',
            shares: input.shares.toString(),
            price: input.price,
            cost_basis: input.costBasis.toString(),
            realized_pnl: input.realizedPnl.toString(),
            market_title: input.marketTitle ?? null
        })
        .select()
        .single();

    if (error) throw new Error(`Failed to insert trade: ${error.message}`);
    return data;
}

export async function getTradesByUser(userAddress: string): Promise<TradeRow[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('trades')
        .select('*')
        .ilike('user_address', userAddress)
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) throw new Error(`Failed to get user trades: ${error.message}`);
    return data ?? [];
}

export async function getTradesBySession(sessionId: string): Promise<TradeRow[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('session_id', sessionId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get session trades: ${error.message}`);
    return data ?? [];
}

export async function getTradesByMarketAndUser(marketId: string, userAddress: string): Promise<TradeRow[]> {
    const supabase = getSupabase();

    const { data, error } = await supabase
        .from('trades')
        .select('*')
        .eq('market_id', marketId)
        .ilike('user_address', userAddress)
        .order('created_at', { ascending: false });

    if (error) throw new Error(`Failed to get market trades: ${error.message}`);
    return data ?? [];
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

export function marketRowToPoolState(row: MarketRow): PoolState {
    const yesReserves = BigInt(row.yes_reserves);
    const noReserves = BigInt(row.no_reserves);
    
    // Calculate total collateral from reserves
    // In our AMM: totalCollateral should equal the sum of both reserves
    // because each USDC creates 1 YES + 1 NO share
    const totalCollateral = yesReserves + noReserves;
    
    return {
        marketId: row.market_id,
        yesReserves,
        noReserves,
        k: BigInt(row.k_invariant),
        virtualLiquidity: yesReserves, // Use initial reserves as virtual liquidity
        totalCollateral,
        createdAt: new Date(row.created_at).getTime(),
        updatedAt: Date.now()
    };
}
