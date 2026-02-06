
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

async function main() {
    console.log(`Checking DB for session: ${SESSION_ID}`);

    // Check session
    const { data: sessionData, error: sessionError } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', SESSION_ID)
        .single();

    if (sessionError) {
        console.error("Session NOT found in DB:", sessionError);
    } else {
        console.log("Session found in DB:", sessionData);
    }

    console.log(`\nChecking positions...`);

    // Fetch positions
    const { data: positions, error } = await supabase
        .from('positions')
        .select('*')
        .eq('user_id', SESSION_ID);

    if (error) {
        console.error("Error fetching positions:", error);
        return;
    }

    console.log(`Found ${positions.length} positions.`);

    let totalLocked = BigInt(0);

    for (const pos of positions) {
        console.log(`\nPosition: ${pos.market_id} | ${pos.outcome}`);
        console.log(`  Shares: ${pos.shares}`);
        console.log(`  Avg Price: ${pos.average_entry_price}`);

        const sharesBig = BigInt(pos.shares);

        // Logic from session-service.ts
        const cost = Number(sharesBig) * pos.average_entry_price;
        const locked = BigInt(Math.floor(cost));

        console.log(`  Calculated Cost: ${cost} (Units)`);
        console.log(`  Locked BigInt: ${locked}`);

        totalLocked += locked;
    }

    console.log(`\n--------------------------------`);
    console.log(`Total Locked: ${totalLocked}`);
    console.log(`Total Locked (USDC): ${Number(totalLocked) / 1e6}`);

    // Assume Principal from DB if available, else 1.00
    const principal = sessionData ? BigInt(sessionData.initial_collateral) : BigInt(1000000);
    const available = principal - totalLocked;

    console.log(`\nBased on Session Collateral (${Number(principal) / 1e6} USDC):`);
    console.log(`Available: ${available}`);
    console.log(`Available (USDC): ${Number(available) / 1e6}`);
}

main().catch(console.error);
