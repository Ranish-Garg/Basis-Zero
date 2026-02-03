/**
 * Basis-Zero Backend Entry Point
 * 
 * This is the main server that orchestrates:
 * - Circle CCTP integration for cross-chain USDC
 * - Yellow Network Nitrolite sessions for off-chain betting
 * - Pyth oracle integration for market resolution
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { CctpService, getAccount, createCctpRouter } from './circle/cctp';
import { YellowSessionService } from './yellow/session-service';
import { MarketResolver } from './markets/resolver';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const yellowSession = new YellowSessionService();
const marketResolver = new MarketResolver();
let cctpService: CctpService | null = null;

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Circle CCTP routes (only if PRIVATE_KEY is set)
if (process.env.PRIVATE_KEY) {
  const account = getAccount();
  cctpService = new CctpService(account);
  const cctpRouter = createCctpRouter(cctpService);
  app.use('/api/cctp', cctpRouter);
  console.log('🔵 Circle CCTP service initialized');
} else {
  console.warn('⚠️ PRIVATE_KEY not found in environment. CCTP routes (/api/cctp) are NOT mounted.');
}

// Yellow Network routes  
app.use('/api/session', yellowSession.router);

// Market routes
app.use('/api/markets', marketResolver.router);

app.listen(PORT, () => {
  console.log(`🚀 Basis-Zero Backend running on port ${PORT}`);
  console.log(`   📍 Health: http://localhost:${PORT}/health`);
  console.log(`   📍 Sessions: http://localhost:${PORT}/api/session`);
  console.log(`   📍 Markets: http://localhost:${PORT}/api/markets`);
});

export { app, cctpService };
