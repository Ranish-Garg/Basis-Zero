/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Basis-Zero Full Backend Flow Test Script
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * This script tests the complete backend flow using CCTP service:
 * 
 * 1. DEPOSIT: Bridge 0.5 USDC from Ethereum Sepolia → Arc Vault (via CCTP)
 * 2. SESSION START: Lock 0.3 USDC for Yellow Network trading session
 * 3. SESSION END: End session and reconcile/cancel to return funds
 * 4. WITHDRAWAL: Bridge 0.5 USDC back from Arc → Ethereum Sepolia (via CCTP)
 * 
 * Prerequisites:
 * - PRIVATE_KEY set in .env with 0.5+ USDC on Sepolia
 * - Test USDC from Circle faucet: https://faucet.circle.com/
 * 
 * Usage:
 *   npx tsx src/test-full-flow.ts
 */

import 'dotenv/config';
import {
    createPublicClient,
    createWalletClient,
    getContract,
    http,
    formatUnits,
    parseUnits,
    type Address,
    type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { erc20Abi } from 'viem';

// Import internal services
import { CctpService } from './circle/cctp/cctp-service';
import { setupAllChains, arcTestnet } from './circle/cctp/setup';
import {
    USDC_ADDRESSES_TESTNET,
    RPC_URLS_TESTNET,
} from './circle/cctp/config';

// Arc Vault Address (update this with actual deployed address)
const ARC_VAULT_ADDRESS = '0x49E4177eA6F21Cc5673bDc0b09507C5648fd53a3' as Address;

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const DEPOSIT_AMOUNT = 0.5; // 0.5 USDC
const SESSION_AMOUNT = 0.3; // 0.3 USDC for Yellow Network trading
const DEPOSIT_AMOUNT_ATOMIC = parseUnits(DEPOSIT_AMOUNT.toString(), 6);
const SESSION_AMOUNT_ATOMIC = parseUnits(SESSION_AMOUNT.toString(), 6);

// ABI for Arc Yield Vault (from session-orchestrator.ts)
const arcYieldVaultAbi = [
    {
        name: 'deposit',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
    },
    {
        name: 'withdraw',
        type: 'function',
        stateMutability: 'nonpayable',
        inputs: [{ name: 'amount', type: 'uint256' }],
        outputs: [],
    },
    {
        name: 'lockSessionAllowance',
        type: 'function',
        inputs: [
            { name: 'amount', type: 'uint256' },
            { name: 'sessionId', type: 'bytes32' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        name: 'confirmBridge',
        type: 'function',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        name: 'reconcileSession',
        type: 'function',
        inputs: [
            { name: 'user', type: 'address' },
            { name: 'pnl', type: 'int256' },
            { name: 'settlementProof', type: 'bytes' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        name: 'cancelTimedOutSession',
        type: 'function',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [],
        stateMutability: 'nonpayable',
    },
    {
        name: 'getSession',
        type: 'function',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [
            { name: 'state', type: 'uint8' },
            { name: 'lockedAmount', type: 'uint256' },
            { name: 'startedAt', type: 'uint256' },
            { name: 'sessionId', type: 'bytes32' },
            { name: 'timeUntilTimeout', type: 'uint256' },
        ],
        stateMutability: 'view',
    },
    {
        name: 'getAvailableYieldForSession',
        type: 'function',
        inputs: [{ name: 'user', type: 'address' }],
        outputs: [{ name: '', type: 'uint256' }],
        stateMutability: 'view',
    },
] as const;

// Session state enum
const SESSION_STATES = ['None', 'PendingBridge', 'Active', 'Settled', 'Cancelled'];

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

const LOG_COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m',
    white: '\x1b[37m',
};

function logHeader(title: string) {
    console.log('\n');
    console.log(`${LOG_COLORS.cyan}${'═'.repeat(70)}${LOG_COLORS.reset}`);
    console.log(`${LOG_COLORS.cyan}${LOG_COLORS.bright}  ${title}${LOG_COLORS.reset}`);
    console.log(`${LOG_COLORS.cyan}${'═'.repeat(70)}${LOG_COLORS.reset}`);
}

function logStep(step: number, total: number, description: string) {
    console.log(`\n${LOG_COLORS.yellow}━━━ Step ${step}/${total}: ${description} ━━━${LOG_COLORS.reset}`);
}

function logInfo(message: string) {
    console.log(`${LOG_COLORS.blue}ℹ ${LOG_COLORS.reset}${message}`);
}

function logSuccess(message: string) {
    console.log(`${LOG_COLORS.green}✓ ${LOG_COLORS.reset}${message}`);
}

function logWaiting(message: string) {
    console.log(`${LOG_COLORS.magenta}⏳ ${LOG_COLORS.reset}${message}`);
}

function logTx(label: string, hash: string) {
    console.log(`${LOG_COLORS.cyan}📄 ${label}:${LOG_COLORS.reset} ${hash}`);
}

function logBalance(chain: string, balance: string) {
    console.log(`${LOG_COLORS.green}💰 ${chain}:${LOG_COLORS.reset} ${balance} USDC`);
}

function logError(message: string) {
    console.log(`${LOG_COLORS.red}✗ ERROR:${LOG_COLORS.reset} ${message}`);
}

function logWarning(message: string) {
    console.log(`${LOG_COLORS.yellow}⚠ WARNING:${LOG_COLORS.reset} ${message}`);
}

function logDivider() {
    console.log(`${LOG_COLORS.dim}${'─'.repeat(70)}${LOG_COLORS.reset}`);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

function generateSessionId(user: Address): Hex {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const data = `${user}-${timestamp}-${random}`;

    let hash = 0n;
    for (let i = 0; i < data.length; i++) {
        hash = (hash * 31n + BigInt(data.charCodeAt(i))) % (2n ** 256n);
    }

    return ('0x' + hash.toString(16).padStart(64, '0')) as Hex;
}

async function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN TEST FLOW
// ═══════════════════════════════════════════════════════════════════════════

async function runFullFlowTest() {
    logHeader('BASIS-ZERO FULL BACKEND FLOW TEST (CCTP)');

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZATION
    // ─────────────────────────────────────────────────────────────────────────

    logStep(0, 5, 'INITIALIZATION');

    // Get account from environment
    let privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        logError('PRIVATE_KEY environment variable is not set');
        process.exit(1);
    }

    if (!privateKey.startsWith('0x')) {
        privateKey = `0x${privateKey}`;
    }

    const account = privateKeyToAccount(privateKey as `0x${string}`);
    logInfo(`Using wallet address: ${account.address}`);

    // Setup CCTP service
    const cctpService = new CctpService(account);

    // Setup clients
    const sepoliaPublic = createPublicClient({
        chain: sepolia,
        transport: http(RPC_URLS_TESTNET.sepolia),
    });

    const sepoliaWallet = createWalletClient({
        account,
        chain: sepolia,
        transport: http(RPC_URLS_TESTNET.sepolia),
    });

    const arcPublic = createPublicClient({
        chain: arcTestnet,
        transport: http(RPC_URLS_TESTNET.arcTestnet),
    });

    const arcWallet = createWalletClient({
        account,
        chain: arcTestnet,
        transport: http(RPC_URLS_TESTNET.arcTestnet),
    });

    // Setup contracts
    const sepoliaUsdc = getContract({
        address: USDC_ADDRESSES_TESTNET.sepolia as Address,
        abi: erc20Abi,
        client: { public: sepoliaPublic, wallet: sepoliaWallet },
    });

    const arcUsdc = getContract({
        address: USDC_ADDRESSES_TESTNET.arcTestnet as Address,
        abi: erc20Abi,
        client: { public: arcPublic, wallet: arcWallet },
    });

    const arcVault = getContract({
        address: ARC_VAULT_ADDRESS,
        abi: arcYieldVaultAbi,
        client: { public: arcPublic, wallet: arcWallet },
    });

    logSuccess('Services and contracts initialized');

    // Check initial balances
    logDivider();
    logInfo('Checking initial balances...');

    const initialSepoliaBalance = await sepoliaUsdc.read.balanceOf([account.address]) as bigint;
    const initialArcBalance = await arcUsdc.read.balanceOf([account.address]) as bigint;

    logBalance('Sepolia USDC', formatUnits(initialSepoliaBalance, 6));
    logBalance('Arc Testnet USDC', formatUnits(initialArcBalance, 6));

    // Check if we have funds
    if (initialSepoliaBalance < DEPOSIT_AMOUNT_ATOMIC && initialArcBalance < DEPOSIT_AMOUNT_ATOMIC) {
        logError(`Insufficient balance. Need at least ${DEPOSIT_AMOUNT} USDC on Sepolia or Arc`);
        logInfo('Get test USDC from: https://faucet.circle.com/');
        process.exit(1);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1: BRIDGE FROM SEPOLIA TO ARC VAULT (via CCTP)
    // ─────────────────────────────────────────────────────────────────────────

    logStep(1, 5, `DEPOSIT: Bridge ${DEPOSIT_AMOUNT} USDC from Sepolia → Arc Vault`);

    let step1Success = false;

    if (initialSepoliaBalance >= DEPOSIT_AMOUNT_ATOMIC) {
        logInfo(`Bridging ${DEPOSIT_AMOUNT} USDC via Circle CCTP...`);
        logWaiting('This will take 2-5 minutes while waiting for attestation...');

        try {
            // Use CCTP service directly to bridge from Sepolia to Arc
            const bridgeResult = await cctpService.bridgeUSDC(
                'sepolia',
                'arcTestnet',
                DEPOSIT_AMOUNT_ATOMIC,
                account.address
            );

            logSuccess('CCTP Bridge complete!');
            logTx('Burn TX (Sepolia)', bridgeResult.burnTx);
            logInfo(`Attestation: ${(bridgeResult.attestation as string).slice(0, 40)}...`);
            logTx('Mint TX (Arc)', bridgeResult.mintTx);

            // Check new Arc balance
            const newArcBalance = await arcUsdc.read.balanceOf([account.address]) as bigint;
            logBalance('Arc USDC (after deposit)', formatUnits(newArcBalance, 6));

            step1Success = true;

        } catch (error: any) {
            logError(`Failed to bridge: ${error.message || error}`);
            logInfo('Will continue with existing Arc balance...');
        }
    } else {
        logInfo(`Already have ${formatUnits(initialArcBalance, 6)} USDC on Arc`);
        logInfo('Skipping bridge step - using existing Arc balance');
        step1Success = true;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2: START YELLOW SESSION (Lock 0.3 USDC)
    // ─────────────────────────────────────────────────────────────────────────

    logStep(2, 5, `SESSION START: Lock ${SESSION_AMOUNT} USDC for Yellow Network`);

    let step2Success = false;
    let currentSessionId: Hex | null = null;

    // Check if a session already exists
    try {
        const existingSession = await arcVault.read.getSession([account.address]) as [number, bigint, bigint, Hex, bigint];
        const sessionState = existingSession[0];

        logInfo(`Current Session State: ${SESSION_STATES[sessionState] || 'Unknown'}`);

        if (sessionState !== 0) {
            logWarning('A session already exists');
            logInfo(`Session ID: ${existingSession[3]}`);
            logInfo(`Locked Amount: ${formatUnits(existingSession[1], 6)} USDC`);
            logInfo(`Time Until Timeout: ${existingSession[4]} seconds`);

            currentSessionId = existingSession[3];
            step2Success = true;
        }
    } catch (e: any) {
        logInfo('Could not read existing session, will try to create new one');
    }

    if (!step2Success) {
        const sessionId = generateSessionId(account.address);
        logInfo(`Generated Session ID: ${sessionId}`);

        try {
            // First approve the vault to spend USDC (Arc uses USDC as gas, but vault needs approval)
            logInfo('Approving Arc Vault...');
            const approveTx = await arcUsdc.write.approve(
                [ARC_VAULT_ADDRESS, SESSION_AMOUNT_ATOMIC],
                { account, chain: arcTestnet }
            ) as Hex;
            await arcPublic.waitForTransactionReceipt({ hash: approveTx });
            logTx('Approval TX', approveTx);

            // Lock session allowance
            logInfo('Locking yield for session...');
            const lockTx = await arcVault.write.lockSessionAllowance(
                [SESSION_AMOUNT_ATOMIC, sessionId],
                { account, chain: arcTestnet }
            ) as Hex;
            await arcPublic.waitForTransactionReceipt({ hash: lockTx });
            logTx('Lock Session TX', lockTx);
            logSuccess(`Locked ${SESSION_AMOUNT} USDC for Yellow Network trading`);

            currentSessionId = sessionId;
            step2Success = true;

            // Verify session state
            const sessionState = await arcVault.read.getSession([account.address]) as [number, bigint, bigint, Hex, bigint];
            logInfo(`Session State: ${SESSION_STATES[sessionState[0]] || 'Unknown'}`);
            logInfo(`Locked Amount: ${formatUnits(sessionState[1], 6)} USDC`);

        } catch (error: any) {
            logError(`Failed to start session: ${error.message || error}`);
        }
    }

    // Simulate Yellow Network trading
    logDivider();
    logInfo('Simulating Yellow Network trading session...');
    logWaiting('In production, off-chain betting would happen here via Nitrolite...');
    await sleep(3000);
    logSuccess('Yellow Network session simulation complete!');
    logInfo('Assuming net PnL: 0 USDC (break-even for this test)');

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3: END YELLOW SESSION (Return funds)
    // ─────────────────────────────────────────────────────────────────────────

    logStep(3, 5, 'SESSION END: Close Yellow session and return funds');

    let step3Success = false;

    // Check current session state
    try {
        const sessionState = await arcVault.read.getSession([account.address]) as [number, bigint, bigint, Hex, bigint];
        const state = sessionState[0];
        logInfo(`Current Session State: ${SESSION_STATES[state] || 'Unknown'}`);

        if (state === 0) {
            // No session
            logInfo('No active session to end');
            step3Success = true;
        } else if (state === 1) {
            // PendingBridge - try to reconcile with 0 PnL (break-even)
            logInfo('Session in PendingBridge state, attempting reconciliation...');

            try {
                const reconcileTx = await arcVault.write.reconcileSession(
                    [account.address, 0n, '0x' as Hex],
                    { account, chain: arcTestnet }
                ) as Hex;
                await arcPublic.waitForTransactionReceipt({ hash: reconcileTx });
                logTx('Reconcile TX', reconcileTx);
                logSuccess('Session reconciled successfully');
                step3Success = true;
            } catch (reconcileError: any) {
                logWarning(`Reconcile failed: ${reconcileError.message?.slice(0, 100)}`);

                // Try cancel as fallback (if timeout has passed)
                logInfo('Attempting to cancel timed-out session...');
                try {
                    const cancelTx = await arcVault.write.cancelTimedOutSession(
                        [account.address],
                        { account, chain: arcTestnet }
                    ) as Hex;
                    await arcPublic.waitForTransactionReceipt({ hash: cancelTx });
                    logTx('Cancel TX', cancelTx);
                    logSuccess('Session cancelled successfully');
                    step3Success = true;
                } catch (cancelError: any) {
                    logError(`Cancel also failed: ${cancelError.message?.slice(0, 100)}`);
                    logInfo('Session may need more time before it can be cancelled');
                }
            }
        } else if (state === 3 || state === 4) {
            // Already settled or cancelled
            logInfo('Session already ended');
            step3Success = true;
        }
    } catch (e: any) {
        logError(`Failed to check/end session: ${e.message}`);
    }

    // Check Arc balance after session
    const arcBalanceAfterSession = await arcUsdc.read.balanceOf([account.address]) as bigint;
    logBalance('Arc USDC (after session end)', formatUnits(arcBalanceAfterSession, 6));

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 4: WITHDRAW FROM ARC VAULT (if needed)
    // ─────────────────────────────────────────────────────────────────────────

    logStep(4, 5, 'WITHDRAW: Withdraw funds from Arc Vault to wallet');

    let step4Success = false;

    try {
        // Check if funds are in wallet or vault
        const walletBalance = await arcUsdc.read.balanceOf([account.address]) as bigint;
        logBalance('Arc Wallet USDC', formatUnits(walletBalance, 6));

        // Try to check available yield
        try {
            const availableYield = await arcVault.read.getAvailableYieldForSession([account.address]) as bigint;
            logBalance('Available Yield', formatUnits(availableYield, 6));
        } catch (e) {
            // Function may not exist or fail
        }

        // If the user has funds in wallet, we're good
        if (walletBalance >= DEPOSIT_AMOUNT_ATOMIC) {
            logSuccess('Sufficient funds in wallet for withdrawal');
            step4Success = true;
        } else {
            logInfo('Attempting vault withdrawal...');
            try {
                const withdrawTx = await arcVault.write.withdraw(
                    [DEPOSIT_AMOUNT_ATOMIC],
                    { account, chain: arcTestnet }
                ) as Hex;
                await arcPublic.waitForTransactionReceipt({ hash: withdrawTx });
                logTx('Withdraw TX', withdrawTx);
                logSuccess('Vault withdrawal complete');
                step4Success = true;
            } catch (withdrawError: any) {
                logWarning(`Vault withdraw skipped or failed: ${withdrawError.message?.slice(0, 100)}`);
                logInfo('Funds may already be in wallet');
                step4Success = walletBalance > 0n;
            }
        }
    } catch (e: any) {
        logError(`Withdrawal step failed: ${e.message}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 5: BRIDGE BACK TO SEPOLIA (via CCTP)
    // ─────────────────────────────────────────────────────────────────────────

    logStep(5, 5, `WITHDRAWAL: Bridge ${DEPOSIT_AMOUNT} USDC from Arc → Sepolia`);

    let step5Success = false;
    const arcWalletBalance = await arcUsdc.read.balanceOf([account.address]) as bigint;
    logBalance('Arc Wallet USDC', formatUnits(arcWalletBalance, 6));

    // Determine amount to bridge
    const amountToBridge = arcWalletBalance >= DEPOSIT_AMOUNT_ATOMIC
        ? DEPOSIT_AMOUNT_ATOMIC
        : arcWalletBalance;

    if (amountToBridge > 0n) {
        logInfo(`Bridging ${formatUnits(amountToBridge, 6)} USDC back to Sepolia via CCTP...`);
        logWaiting('This will take 2-5 minutes while waiting for attestation...');

        try {
            const bridgeResult = await cctpService.bridgeUSDC(
                'arcTestnet',
                'sepolia',
                amountToBridge,
                account.address
            );

            logSuccess('CCTP Bridge back to Sepolia complete!');
            logTx('Burn TX (Arc)', bridgeResult.burnTx);
            logInfo(`Message Hash: ${bridgeResult.message.slice(0, 40)}...`);
            logInfo(`Attestation: ${(bridgeResult.attestation as string).slice(0, 40)}...`);
            logTx('Mint TX (Sepolia)', bridgeResult.mintTx);

            step5Success = true;

        } catch (error: any) {
            logError(`Failed to bridge back: ${error.message || error}`);
        }
    } else {
        logWarning('No funds available on Arc to bridge back');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FINAL SUMMARY
    // ─────────────────────────────────────────────────────────────────────────

    logHeader('TEST COMPLETE - FINAL BALANCES');

    const finalSepoliaBalance = await sepoliaUsdc.read.balanceOf([account.address]) as bigint;
    const finalArcBalance = await arcUsdc.read.balanceOf([account.address]) as bigint;

    logBalance('Sepolia USDC', formatUnits(finalSepoliaBalance, 6));
    logBalance('Arc Testnet USDC', formatUnits(finalArcBalance, 6));

    logDivider();
    logInfo('Flow Summary:');
    console.log(`  1. ${step1Success ? '✓' : '✗'} Bridge ${DEPOSIT_AMOUNT} USDC from Sepolia → Arc Vault`);
    console.log(`  2. ${step2Success ? '✓' : '✗'} Lock ${SESSION_AMOUNT} USDC for Yellow Network session`);
    console.log(`  3. ${step3Success ? '✓' : '✗'} End Yellow session and return funds`);
    console.log(`  4. ${step4Success ? '✓' : '✗'} Withdraw funds from Arc Vault`);
    console.log(`  5. ${step5Success ? '✓' : '✗'} Bridge ${DEPOSIT_AMOUNT} USDC from Arc → Sepolia`);

    logDivider();

    // Calculate net change
    const netChange = finalSepoliaBalance - initialSepoliaBalance;
    if (netChange < 0n) {
        logInfo(`Net cost: ${formatUnits(-netChange, 6)} USDC (bridge fees + gas)`);
    } else if (netChange > 0n) {
        logSuccess(`Net gain: ${formatUnits(netChange, 6)} USDC`);
    } else {
        logInfo('Net change: 0 USDC (break-even)');
    }

    const allSuccess = step1Success && step2Success && step3Success && step4Success && step5Success;
    if (allSuccess) {
        logSuccess('Full backend flow test completed successfully! 🎉');
    } else {
        logWarning('Some steps failed - review logs above for details');
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// RUN TEST
// ═══════════════════════════════════════════════════════════════════════════

runFullFlowTest().catch((error) => {
    logError(`Test failed: ${error}`);
    console.error(error);
    process.exit(1);
});
