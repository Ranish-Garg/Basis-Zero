/**
 * Circle Gateway API Client
 * 
 * Lightweight client for interacting with the Circle Gateway API.
 * @see https://developers.circle.com/gateway
 */

import { GATEWAY_API, DOMAINS, CHAIN_NAMES, EVM_DOMAINS, type NetworkType } from './config';
import type { Address } from 'viem';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface GatewayBalance {
  domain: number;
  balance: string;
}

export interface GatewayBalancesResponse {
  balances: GatewayBalance[];
}

export interface GatewayDomainInfo {
  chain: string;
  network: string;
  domain: number;
  walletContract?: Address;
  minterContract?: Address;
}

export interface GatewayInfoResponse {
  domains: GatewayDomainInfo[];
}

export interface BurnIntentMessage {
  maxBlockHeight: bigint;
  maxFee: bigint;
  spec: {
    version: number;
    sourceDomain: number;
    destinationDomain: number;
    sourceContract: string;
    destinationContract: string;
    sourceToken: string;
    destinationToken: string;
    sourceDepositor: string;
    destinationRecipient: string;
    sourceSigner: string;
    destinationCaller: string;
    value: bigint;
    salt: string;
    hookData: string;
  };
}

export interface SignedBurnIntent {
  burnIntent: BurnIntentMessage;
  signature: string;
}

export interface TransferResponse {
  attestation: string;
  signature: string;
  error?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// GATEWAY CLIENT
// ═══════════════════════════════════════════════════════════════════════════

export class GatewayClient {
  private baseUrl: string;

  // Static references for convenience
  static DOMAINS = DOMAINS;
  static CHAIN_NAMES = CHAIN_NAMES;
  static EVM_DOMAINS = EVM_DOMAINS;

  constructor(network: NetworkType = 'testnet') {
    const url = GATEWAY_API[network];
    if (!url) {
      throw new Error(`Unknown network: ${network}. Use 'testnet' or 'mainnet'.`);
    }
    this.baseUrl = url;
  }

  /**
   * Gets info about supported chains and contracts
   */
  async info(): Promise<GatewayInfoResponse> {
    return this.get<GatewayInfoResponse>('/info');
  }

  /**
   * Checks balances for a given depositor across specified domains
   * @param token - Token symbol (e.g., "USDC")
   * @param depositor - Wallet address
   * @param domains - Optional array of domain IDs to check (defaults to EVM domains)
   */
  async balances(
    token: 'USDC' | 'EURC',
    depositor: Address,
    domains?: readonly number[]
  ): Promise<GatewayBalancesResponse> {
    const sourceDomains = domains || EVM_DOMAINS;
    return this.post<GatewayBalancesResponse>('/balances', {
      token,
      sources: sourceDomains.map((domain) => ({
        depositor,
        domain,
      })),
    });
  }

  /**
   * Sends burn intents to the API to retrieve an attestation
   * @param burnIntents - Array of signed burn intents
   */
  async transfer(burnIntents: SignedBurnIntent[]): Promise<TransferResponse> {
    return this.post<TransferResponse>('/transfer', burnIntents);
  }

  private async get<T>(path: string): Promise<T> {
    const url = this.baseUrl + path;
    const response = await fetch(url);
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gateway API error: ${response.status} - ${error}`);
    }
    return response.json();
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = this.baseUrl + path;
    const headers = { 'Content-Type': 'application/json' };
    const response = await fetch(url, {
      method: 'POST',
      headers,
      // Serialize bigints as strings
      body: JSON.stringify(body, (_key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      ),
    });
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gateway API error: ${response.status} - ${error}`);
    }
    return response.json();
  }
}
