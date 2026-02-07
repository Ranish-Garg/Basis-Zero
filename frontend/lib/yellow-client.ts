import { NitroliteClient, SessionKeyStateSigner } from '@erc7824/nitrolite';
import { createWalletClient, custom, type WalletClient, type Hex, type Address } from 'viem';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { polygonAmoy } from 'viem/chains';

const SESSION_KEY_STORAGE = 'yellow_session_key';

export class YellowClientManager {
  private client: NitroliteClient | null = null;
  private sessionKey: Hex | null = null;
  private signerAddress: Address | null = null;
  private signer: SessionKeyStateSigner | null = null;

  constructor() {
    // Try to load existing session key
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SESSION_KEY_STORAGE);
      if (stored) {
        this.sessionKey = stored as Hex;
        const account = privateKeyToAccount(this.sessionKey);
        this.signerAddress = account.address;
        this.initializeClient();
      }
    }
  }

  /**
   * Initialize the Nitrolite Client with the current session key
   */
  private initializeClient() {
    if (!this.sessionKey) return;

    try {
      this.signer = new SessionKeyStateSigner(this.sessionKey);
      
      // Initialize the SDK Client
      // Note: In a real app, you might pass more config here (RPC providers, etc.)
      // For now, we just need the signing capability.
      const account = privateKeyToAccount(this.sessionKey);
      
      const publicClient = require('viem').createPublicClient({
        chain: polygonAmoy,
        transport: require('viem').http()
      });

      const walletClient = createWalletClient({
        account,
        chain: polygonAmoy,
        transport: require('viem').http()
      });

      this.client = new NitroliteClient({
        stateSigner: this.signer,
        chainId: polygonAmoy.id,
        publicClient,
        walletClient,
        challengeDuration: 60n, // 60 blocks default
        addresses: {
          // Official Polygon Amoy Testnet Addresses for Nitrolite
          adjudicator: '0x7c7ccbc98469190849BCC6c926307794fDfB11F2',
          assetHolder: '0x019B65A265EB3363822f2752141b3dF16131b262',
          challengeToken: '0x0000000000000000000000000000000000000000', // Token not strictly needed for this flow
        } as any 
      });

      console.log(`[YellowClient] Initialized with Session Signer: ${this.signerAddress}`);
    } catch (err) {
      console.error('[YellowClient] Failed to initialize client:', err);
    }
  }

  /**
   * Create a new session key and request user authorization
   */
  async createSession(walletClient: WalletClient): Promise<{ address: Address; signature: Hex }> {
    // 1. Generate new random key
    const newKey = generatePrivateKey();
    const account = privateKeyToAccount(newKey);
    
    // 2. Request User Authorization
    // The message should be EIP-712 typed data in production, but string is fine for MVP
    const message = `Authorize Yellow Session Key: ${account.address}`;
    const signature = await walletClient.signMessage({
      account: walletClient.account!,
      message
    });

    // 3. Save and Initialize
    this.sessionKey = newKey;
    this.signerAddress = account.address;
    localStorage.setItem(SESSION_KEY_STORAGE, newKey);
    
    this.initializeClient();

    return {
      address: account.address,
      signature
    };
  }

  /**
   * Get the active Nitrolite Client
   */
  getClient(): NitroliteClient | null {
    return this.client;
  }

  /**
   * Get the session signer address
   */
  getSignerAddress(): Address | null {
    return this.signerAddress;
  }

  /**
   * Clear session
   */
  clearSession() {
    this.client = null;
    this.sessionKey = null;
    this.signer = null;
    localStorage.removeItem(SESSION_KEY_STORAGE);
  }

  /**
   * Sign a raw message with the session key
   */
  async signMessage(message: Hex): Promise<Hex> {
    if (!this.signer) throw new Error("No active session signer");
    return this.signer.signRawMessage(message);
  }
}

// Singleton instance
export const yellowClientManager = new YellowClientManager();
