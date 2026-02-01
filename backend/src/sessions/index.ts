/**
 * Sessions module exports
 * 
 * Manages Yellow betting sessions with Arc custody and Polygon escrow.
 */

export {
  SessionOrchestrator,
  createSessionOrchestrator,
  SessionPhase,
  type SessionInfo,
  type SessionConfig,
} from './session-orchestrator';
