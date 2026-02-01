/**
 * Basis-Zero Backend Entry Point
 * 
 * This is the main server that orchestrates:
 * - Circle Gateway integration for cross-chain USDC
 * - Yellow Network Nitrolite sessions for off-chain betting
 * - Pyth oracle integration for market resolution
 */

import express from 'express';
import { CircleGatewayService } from './circle/gateway-service';
import { YellowSessionService } from './yellow/session-service';
import { MarketResolver } from './markets/resolver';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize services
const circleGateway = new CircleGatewayService();
const yellowSession = new YellowSessionService();
const marketResolver = new MarketResolver();

app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: Date.now() });
});

// Circle Gateway routes
app.use('/api/gateway', circleGateway.router);

// Yellow Network routes  
app.use('/api/session', yellowSession.router);

// Market routes
app.use('/api/markets', marketResolver.router);

app.listen(PORT, () => {
  console.log(`🚀 Basis-Zero Backend running on port ${PORT}`);
});

export { app };
