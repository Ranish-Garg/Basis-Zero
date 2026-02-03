/**
 * AMM Pool Test Script
 * 
 * Run with: npx ts-node src/amm/test-amm.ts
 * 
 * This demonstrates all the logic from:
 * "Basis Zero - AMM Pool Technical Logic.md"
 */

import {
    poolManager,
    Outcome,
    ONE_USDC,
    getPrices,
    runSpecExample
} from './index';

// ═══════════════════════════════════════════════════════════════════════════
// TEST 1: Run the example from the spec document
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n\n🧪 TEST 1: Spec Example (Betting $100 on YES)\n');
runSpecExample();

// ═══════════════════════════════════════════════════════════════════════════
// TEST 2: Create a market and place bets
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n\n🧪 TEST 2: Full Market Lifecycle\n');
console.log('═══════════════════════════════════════════════════════════════');

// Create a prediction market
const marketId = 'btc-100k-feb-2026';
console.log(`Creating market: ${marketId}`);

poolManager.createMarket({
    marketId,
    initialLiquidity: 10000n * ONE_USDC, // 10,000 shares each side
    virtualLiquidity: 50000n * ONE_USDC  // Virtual liquidity for lower slippage
});

// Check initial prices
console.log('\n📊 Initial Prices:');
const prices1 = poolManager.getPrices(marketId)!;
console.log(`  YES: $${prices1.yesPrice.toFixed(4)} (${prices1.yesProbability.toFixed(1)}%)`);
console.log(`  NO:  $${prices1.noPrice.toFixed(4)} (${prices1.noProbability.toFixed(1)}%)`);

// User 1 bets $500 on YES
console.log('\n🎲 User1 bets $500 on YES:');
const bet1 = poolManager.placeBet(marketId, 'user1', 500n * ONE_USDC, Outcome.YES);
console.log(`  Shares received: ${Number(bet1.totalShares) / 1e6}`);
console.log(`  Effective price: $${bet1.effectivePrice.toFixed(4)}`);
console.log(`  New YES probability: ${bet1.newProbability.toFixed(1)}%`);

// User 2 bets $300 on NO
console.log('\n🎲 User2 bets $300 on NO:');
const bet2 = poolManager.placeBet(marketId, 'user2', 300n * ONE_USDC, Outcome.NO);
console.log(`  Shares received: ${Number(bet2.totalShares) / 1e6}`);
console.log(`  Effective price: $${bet2.effectivePrice.toFixed(4)}`);
console.log(`  New NO probability: ${bet2.newProbability.toFixed(1)}%`);

// Check updated prices
console.log('\n📊 Updated Prices:');
const prices2 = poolManager.getPrices(marketId)!;
console.log(`  YES: $${prices2.yesPrice.toFixed(4)} (${prices2.yesProbability.toFixed(1)}%)`);
console.log(`  NO:  $${prices2.noPrice.toFixed(4)} (${prices2.noProbability.toFixed(1)}%)`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 3: Get a quote without executing
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n\n🧪 TEST 3: Get Quote (No Execution)\n');
console.log('═══════════════════════════════════════════════════════════════');

const quote = poolManager.quoteBet(marketId, 1000n * ONE_USDC, Outcome.YES);
if (quote) {
    console.log(`Quote for $1000 bet on YES:`);
    console.log(`  Expected shares: ${Number(quote.expectedShares) / 1e6}`);
    console.log(`  Effective price: $${quote.effectivePrice.toFixed(4)}`);
    console.log(`  Price impact: ${quote.priceImpact.toFixed(2)}%`);
}

// ═══════════════════════════════════════════════════════════════════════════
// TEST 4: Market Resolution & Settlement
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n\n🧪 TEST 4: Market Resolution & Settlement\n');
console.log('═══════════════════════════════════════════════════════════════');

// Resolve the market - YES wins!
console.log('Resolving market: YES WINS! 🎉\n');
poolManager.resolveMarket({
    marketId,
    winningOutcome: Outcome.YES,
    resolvedAt: Date.now(),
    oracleSource: 'pyth-btc-usd'
});

// Get settlement
const settlement = poolManager.settleMarket(marketId);

console.log('\n📋 Settlement Summary:');
for (const payout of settlement.userPayouts) {
    const pnlSign = payout.profitLoss >= 0n ? '+' : '';
    console.log(`  ${payout.userId}:`);
    console.log(`    Winning shares: ${Number(payout.winningShares) / 1e6}`);
    console.log(`    Net payout: $${(Number(payout.netPayout) / 1e6).toFixed(2)}`);
    console.log(`    P&L: ${pnlSign}$${(Number(payout.profitLoss) / 1e6).toFixed(2)}`);
}

console.log(`\nProtocol fee collected: $${(Number(settlement.protocolFeeCollected) / 1e6).toFixed(2)}`);

// ═══════════════════════════════════════════════════════════════════════════
// TEST 5: Position Tracking
// ═══════════════════════════════════════════════════════════════════════════
console.log('\n\n🧪 TEST 5: Position Tracking\n');
console.log('═══════════════════════════════════════════════════════════════');

const pos1 = poolManager.getPosition(marketId, 'user1');
const pos2 = poolManager.getPosition(marketId, 'user2');

console.log('User1 position:');
console.log(`  YES shares: ${Number(pos1?.yesShares ?? 0n) / 1e6}`);
console.log(`  NO shares: ${Number(pos1?.noShares ?? 0n) / 1e6}`);
console.log(`  Cost basis: $${Number(pos1?.totalCostBasis ?? 0n) / 1e6}`);

console.log('\nUser2 position:');
console.log(`  YES shares: ${Number(pos2?.yesShares ?? 0n) / 1e6}`);
console.log(`  NO shares: ${Number(pos2?.noShares ?? 0n) / 1e6}`);
console.log(`  Cost basis: $${Number(pos2?.totalCostBasis ?? 0n) / 1e6}`);

console.log('\n\n✅ All tests completed!\n');
