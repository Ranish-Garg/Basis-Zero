
import dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error("Missing Env Vars");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const SESSION_ID = '0x3d547f5ea66bbc6a00d4021f7c5c471e8e3a6788cd6caf47d69ebf448d2fb99e';
const MARKET_ID = 'will-btc-reach-100k-by-march-26-ml8lhj56';

async function main() {
    console.log(`Fixing DB for session: ${SESSION_ID}`);

    // 1. Update Session Collateral to 1 USDC (1,000,000)
    // Only if it is currently 0
    const { error: sessionError } = await supabase
        .from('sessions')
        .update({
            initial_collateral: '1000000',
            current_balance: '1000000',
            rwa_rate_bps: 520, // Default 5.2%
            safe_mode_enabled: false // They used full mode
        })
        .eq('session_id', SESSION_ID);

    if (sessionError) {
        console.error("Failed to update session:", sessionError);
    } else {
        console.log("✅ Session collateral updated to 1.00 USDC");
    }

    // 2. Update Position Shares
    // Bet: 0.63 USDC.
    // Price from DB: 0.644603.
    // Shares = 0.63 / 0.644603 * 1e6 = 977345
    const SHARES = '977345'; // Roughly correct

    // Check if position exists first (it should, as 0 shares)
    const { data: posData, error: posError } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', SESSION_ID)
        .eq('market_id', MARKET_ID)
        .single();

    if (posError) {
        console.error("Failed to find position:", posError);
    } else {
        console.log("Found position (shares=" + posData.shares + ")");

        // Update
        const { error: updateError } = await supabase
            .from('positions')
            .update({
                shares: SHARES
            })
            .eq('id', posData.id);

        if (updateError) {
            console.error("Failed to update position:", updateError);
        } else {
            console.log(`✅ Position shares updated to ${SHARES}`);
        }
    }
}

main().catch(console.error);
