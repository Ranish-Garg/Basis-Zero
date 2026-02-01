/**
 * Basis-Zero Backend Entry Point
 * 
 * This is the main server that orchestrates:
 * - Circle Gateway integration for cross-chain USDC
 * - Session Orchestrator for Arc+Yellow dual-layer architecture
 * - Yellow Network Nitrolite sessions for off-chain betting
 * - Pyth oracle integration for market resolution
 */

import express from 'express';
import { createGatewayService, type GatewayService } from './circle/gateway';
import { createSessionOrchestrator } from './sessions';
import { YellowSessionService } from './yellow/session-service';
import { MarketResolver } from './markets/resolver';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const yellowSession = new YellowSessionService();
const marketResolver = new MarketResolver();
let gatewayService: GatewayService | null = null;

app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Circle Gateway routes (only if PRIVATE_KEY is set)
if (process.env.PRIVATE_KEY) {
  gatewayService = createGatewayService('testnet');
  app.use('/api/gateway', gatewayService.router);
  console.log('🔵 Circle Gateway routes enabled');
  
  // Session Orchestrator (requires Gateway)
  const sessionOrchestrator = createSessionOrchestrator(gatewayService);
  app.use('/api/sessions', sessionOrchestrator.router);
  console.log('🟡 Session Orchestrator routes enabled (Arc + Yellow)');
}

// Yellow Network routes  
app.use('/api/session', yellowSession.router);

// Market routes
app.use('/api/markets', marketResolver.router);

app.listen(PORT, () => {
  console.log(`🚀 Basis-Zero Backend running on port ${PORT}`);
  console.log(`   📍 Health: http://localhost:${PORT}/health`);
  console.log(`   📍 Gateway: http://localhost:${PORT}/api/gateway`);
  console.log(`   📍 Sessions: http://localhost:${PORT}/api/sessions`);
  console.log(`   📍 Markets: http://localhost:${PORT}/api/markets`);
});

export { app };
