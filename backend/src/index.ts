/**
 * Basis-Zero Backend Entry Point
 * 
 * This is the main server that orchestrates:
 * - Circle Gateway integration for cross-chain USDC
 * - Yellow Network Nitrolite sessions for off-chain betting
 * - Pyth oracle integration for market resolution
 */

import express from 'express';
import { createGatewayService } from './circle/gateway';
import { YellowSessionService } from './yellow/session-service';
import { MarketResolver } from './markets/resolver';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const yellowSession = new YellowSessionService();
const marketResolver = new MarketResolver();

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Circle Gateway routes (only if PRIVATE_KEY is set)
if (process.env.PRIVATE_KEY) {
  const gatewayService = createGatewayService('testnet');
  app.use('/api/gateway', gatewayService.router);
  console.log('🔵 Circle Gateway routes enabled');
}

// Yellow Network routes  
app.use('/api/session', yellowSession.router);

// Market routes
app.use('/api/markets', marketResolver.router);

app.listen(PORT, () => {
  console.log(`🚀 Basis-Zero Backend running on port ${PORT}`);
});

export { app };
