
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
const CORRECT_USER_ADDRESS = '0x484826732d75d6A8018bFAD3468Bd84f64614268'; // From logs

async function main() {
    console.log(`Fixing User Address for session: ${SESSION_ID}`);

    const { error } = await supabase
        .from('sessions')
        .update({
            user_address: CORRECT_USER_ADDRESS
        })
        .eq('session_id', SESSION_ID);

    if (error) {
        console.error("Failed to update user_address:", error);
    } else {
        console.log(`✅ Updated user_address to ${CORRECT_USER_ADDRESS}`);
    }

    // Also verify the balance endpoint again
    console.log("\nVerifying DB Session State:");
    const { data: session } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_id', SESSION_ID)
        .single();

    console.log("Session:", session);
}

main().catch(console.error);
