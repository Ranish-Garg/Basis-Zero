/**
 * CCTP Service
 * 
 * Handles direct interactions with Circle's Cross-Chain Transfer Protocol (CCTP) contracts.
 * Used for real bridging of USDC between Arc and Polygon.
 */

import { 
  type Address, 
  type Hex, 
  type PublicClient, 
  type WalletClient,
  type PrivateKeyAccount,
  getContract,
  keccak256,
  encodePacked,
  decodeEventLog,
  parseEventLogs
} from 'viem';

import { CCTP_CONTRACTS, DOMAINS, USDC_ADDRESSES_TESTNET } from './config';
import { setupAllChains, type ChainConfigs } from './setup';

// Minimal ABI for TokenMessenger
const tokenMessengerAbi = [
  {
    name: 'depositForBurn',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amount', type: 'uint256' },
      { name: 'destinationDomain', type: 'uint32' },
      { name: 'mintRecipient', type: 'bytes32' },
      { name: 'burnToken', type: 'address' },
    ],
    outputs: [{ name: 'nonce', type: 'uint64' }],
  },
] as const;

// Minimal ABI for MessageTransmitter
const messageTransmitterAbi = [
  {
    name: 'receiveMessage',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'message', type: 'bytes' },
      { name: 'attestation', type: 'bytes' },
    ],
    outputs: [{ name: 'success', type: 'bool' }],
  },
  {
    name: 'MessageSent',
    type: 'event',
    inputs: [
      { indexed: false, name: 'message', type: 'bytes' },
    ],
  }
] as const;

// Minimal ABI for ERC20
const erc20Abi = [
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export class CctpService {
  private chains: ChainConfigs;
  private irisApiUrl = 'https://iris-api-sandbox.circle.com/attestations'; // Sandbox for testnet

  constructor(private account: PrivateKeyAccount) {
    this.chains = setupAllChains(account);
  }

  /**
   * Bridge USDC using CCTP
   * 1. Approve TokenMessenger
   * 2. Call depositForBurn on source
   * 3. Fetch attestation from Circle Iris
   * 4. Call receiveMessage on destination
   */
  async bridgeUSDC(
    sourceChainName: keyof typeof CCTP_CONTRACTS,
    destChainName: keyof typeof CCTP_CONTRACTS,
    amount: bigint,
    recipient: Address
  ): Promise<{ burnTx: Hex; message: Hex; attestation: Hex; mintTx: Hex }> {
    const sourceChain = this.chains[sourceChainName];
    const destChain = this.chains[destChainName];

    if (!sourceChain || !destChain) throw new Error('Invalid chain config');
    
    // @ts-ignore - Assuming config exists for these keys
    const sourceConfig = CCTP_CONTRACTS[sourceChainName];
    // @ts-ignore
    const destConfig = CCTP_CONTRACTS[destChainName];
    const destDomain = DOMAINS[destChainName];

    console.log(`[CCTP] Bridging ${Number(amount)/1e6} USDC from ${sourceChainName} -> ${destChainName}`);

    // 1. Approve TokenMessenger
    const usdc = getContract({
      address: sourceChain.usdcAddress,
      abi: erc20Abi,
      client: { public: sourceChain.publicClient, wallet: sourceChain.walletClient }
    });

    console.log(`[CCTP] Approving TokenMessenger...`);
    const approveTx = await usdc.write.approve(
      [sourceConfig.tokenMessenger as Address, amount],
      { account: this.account, chain: sourceChain.chain }
    );
    await sourceChain.publicClient.waitForTransactionReceipt({ hash: approveTx });

    // 2. Deposit For Burn
    const tokenMessenger = getContract({
      address: sourceConfig.tokenMessenger as Address,
      abi: tokenMessengerAbi,
      client: { public: sourceChain.publicClient, wallet: sourceChain.walletClient }
    });

    // Recipient must be bytes32 padded
    const recipientBytes32 = this.addressToBytes32(recipient);

    console.log(`[CCTP] Calling depositForBurn...`);
    const burnTx = await tokenMessenger.write.depositForBurn([
      amount,
      destDomain,
      recipientBytes32,
      sourceChain.usdcAddress
    ], { account: this.account, chain: sourceChain.chain });
    
    const receipt = await sourceChain.publicClient.waitForTransactionReceipt({ hash: burnTx });
    console.log(`[CCTP] Burn confirmed: ${burnTx}`);

    // 3. Retrieve Message Bytes from Event
    const message = await this.getMessageBytesFromReceipt(receipt, sourceConfig.messageTransmitter as Address);
    const messageHash = keccak256(message);
    
    console.log(`[CCTP] Message Hash: ${messageHash}`);
    console.log(`[CCTP] Waiting for attestation (this may take a moment)...`);

    // 4. Fetch Attestation
    const attestation = await this.fetchAttestation(messageHash);
    console.log(`[CCTP] Attestation received!`);

    // 5. Mint on Destination
    const messageTransmitter = getContract({
      address: destConfig.messageTransmitter as Address,
      abi: messageTransmitterAbi,
      client: { public: destChain.publicClient, wallet: destChain.walletClient }
    });

    console.log(`[CCTP] Executing mint on ${destChainName}...`);
    const mintTx = await messageTransmitter.write.receiveMessage([
      message,
      attestation
    ], { account: this.account, chain: destChain.chain });
    await destChain.publicClient.waitForTransactionReceipt({ hash: mintTx });
    console.log(`[CCTP] Mint confirmed: ${mintTx}`);

    return { burnTx, message, attestation, mintTx };
  }

  // Helper to convert address to bytes32
  private addressToBytes32(address: Address): Hex {
    return ('0x' + address.slice(2).padStart(64, '0')) as Hex;
  }

  // Extract message bytes from MessageSent event
  private async getMessageBytesFromReceipt(receipt: any, transmitterAddress: Address): Promise<Hex> {
    const logs = parseEventLogs({
      abi: messageTransmitterAbi,
      eventName: 'MessageSent',
      logs: receipt.logs,
    });

    // Filter by transmitter address just in case
    // The logs might come from the TokenMessenger -> MessageTransmitter call
    // Usually MessageTransmitter emits MessageSent
    for (const log of logs) {
        // @ts-ignore
      if (log.address.toLowerCase() === transmitterAddress.toLowerCase()) {
        return log.args.message;
      }
    }
    
    // If not found in parsed logs, try to find raw log
    // MessageSent signature: MessageSent(bytes message)
    // Topic 0: 0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036
    const messageSentTopic = '0x8c5261668696ce22758910d05bab8f186d6eb247ceac2af2e82c7dc17669b036';
    
    for (const log of receipt.logs) {
      if (log.topics[0] === messageSentTopic) {
        // Check if data is encoded bytes
        // decode generic bytes
        const data = log.data;
        // The data is the message bytes (dynamic bytes)
        // Usually abi decoding handles this, but for raw:
        // skip 0x, skip 32 bytes (offset), skip 32 bytes (length), take rest
        // Easier to trust parseEventLogs usually...
        
        // Let's assume the first matching log is ours if parse failed for some reason
      }
    }
    
    if (logs.length > 0) return logs[0].args.message;

    throw new Error('MessageSent event not found in receipt');
  }

  // Poll Circle Iris API for attestation
  private async fetchAttestation(messageHash: Hex): Promise<Hex> {
    let attempts = 0;
    while (attempts < 60) { // Try for ~5 minutes
      const response = await fetch(`${this.irisApiUrl}/${messageHash}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.status === 'complete' && data.attestation) {
          return data.attestation as Hex;
        }
      }
      
      await new Promise(r => setTimeout(r, 5000)); // Wait 5s
      attempts++;
    }
    throw new Error('Timeout fetching attestation');
  }
}
