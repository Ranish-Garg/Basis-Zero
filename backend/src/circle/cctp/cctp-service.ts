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

import { CCTP_CONTRACTS, DOMAINS, USDC_ADDRESSES_TESTNET, ARC_VAULT_ADDRESS } from './config';
import { vaultAbi, erc20Abi } from './abis';
import { setupAllChains, type ChainConfigs } from './setup';

// Minimal ABI for TokenMessengerV2 (V2 has additional parameters)
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
      { name: 'destinationCaller', type: 'bytes32' },   // V2: who can call receiveMessage (0x0 = anyone)
      { name: 'maxFee', type: 'uint256' },              // V2: max fee for transfer
      { name: 'minFinalityThreshold', type: 'uint32' }, // V2: 1000 = fast, 2000+ = standard
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
    stateMutability: 'view',
  }
] as const;



export class CctpService {
  private chains: ChainConfigs;
  private irisApiUrl = 'https://iris-api-sandbox.circle.com'; // Base URL for Circle Iris API (sandbox for testnet)

  constructor(private account: PrivateKeyAccount) {
    this.chains = setupAllChains(account);
  }

  public getAccountAddress(): Address {
    return this.account.address;
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

    console.log(`[CCTP] Bridging ${Number(amount) / 1e6} USDC from ${sourceChainName} -> ${destChainName}`);

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

    // V2 parameters
    const destinationCallerBytes32 = '0x0000000000000000000000000000000000000000000000000000000000000000' as Hex; // Anyone can call receiveMessage
    const maxFee = 500n; // 0.0005 USDC (500 subunits) - max fee for the transfer
    const minFinalityThreshold = 1000; // 1000 = Fast Transfer, 2000+ = Standard Transfer

    console.log(`[CCTP] Calling depositForBurn (V2)...`);
    const burnTx = await tokenMessenger.write.depositForBurn([
      amount,
      destDomain,
      recipientBytes32,
      sourceChain.usdcAddress,
      destinationCallerBytes32,
      maxFee,
      minFinalityThreshold
    ], { account: this.account, chain: sourceChain.chain });

    const receipt = await sourceChain.publicClient.waitForTransactionReceipt({ hash: burnTx });
    console.log(`[CCTP] Burn confirmed: ${burnTx}`);

    // 3. Get source domain for V2 attestation API
    const sourceDomain = DOMAINS[sourceChainName];

    console.log(`[CCTP] Waiting for attestation (V2 API with srcDomain=${sourceDomain})...`);

    // 4. Fetch Attestation using V2 API (uses txHash + srcDomain instead of messageHash)
    const attestationResult = await this.fetchAttestation(sourceDomain, burnTx);
    console.log(`[CCTP] Attestation received!`);

    // V2 API returns both message and attestation
    const message = attestationResult.message;
    const attestation = attestationResult.attestation;

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

  /**
   * Smart Deposit: Bridge (if needed) and Deposit to Vault
   */
  async smartDeposit(
    sourceChainName: keyof typeof CCTP_CONTRACTS,
    amount: bigint
  ): Promise<{ step: string; txHash: Hex; bridgeData?: any }> {
    console.log(`[SmartDeposit] Request: ${sourceChainName} -> Vault (${Number(amount) / 1e6} USDC)`);

    // 1. If Arc Testnet, directly deposit
    if (sourceChainName === 'arcTestnet') {
      const tx = await this.depositToVault(amount);
      return { step: 'direct_deposit', txHash: tx };
    }

    // 2. Otherwise, Bridge then Deposit
    console.log(`[SmartDeposit] Initiating bridge first...`);
    const bridgeResult = await this.bridgeUSDC(
      sourceChainName,
      'arcTestnet',
      amount,
      this.account.address
    );

    console.log(`[SmartDeposit] Bridge complete. Depositing to vault...`);
    const depositTx = await this.depositToVault(amount);

    return {
      step: 'bridge_and_deposit',
      txHash: depositTx,
      bridgeData: bridgeResult
    };
  }

  /**
   * Internal: Deposit USDC to Arc Vault from Backend Wallet
   */
  private async depositToVault(amount: bigint): Promise<Hex> {
    const chain = this.chains.arcTestnet;
    if (!chain) throw new Error('Arc Testnet not configured');

    const usdc = getContract({
      address: USDC_ADDRESSES_TESTNET.arcTestnet,
      abi: erc20Abi,
      client: { public: chain.publicClient, wallet: chain.walletClient }
    });

    const vault = getContract({
      address: ARC_VAULT_ADDRESS,
      abi: vaultAbi,
      client: { public: chain.publicClient, wallet: chain.walletClient }
    });

    // Approve Vault
    console.log(`[Vault] Approving...`);
    const approveTx = await usdc.write.approve(
      [ARC_VAULT_ADDRESS, amount],
      { account: this.account, chain: chain.chain }
    );
    await chain.publicClient.waitForTransactionReceipt({ hash: approveTx });

    // Deposit
    console.log(`[Vault] Depositing...`);
    const depositTx = await vault.write.deposit(
      [amount],
      { account: this.account, chain: chain.chain }
    );
    await chain.publicClient.waitForTransactionReceipt({ hash: depositTx });
    console.log(`[Vault] Deposit confirmed: ${depositTx}`);

    return depositTx;
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

  // Poll Circle Iris API V2 for attestation
  // V2 uses /v2/messages/{srcDomain}?transactionHash={txHash} instead of /attestations/{messageHash}
  private async fetchAttestation(sourceDomain: number, transactionHash: Hex): Promise<{ attestation: Hex; message: Hex }> {
    const url = `${this.irisApiUrl}/v2/messages/${sourceDomain}?transactionHash=${transactionHash}`;
    let attempts = 0;

    console.log(`[CCTP] Polling for attestation at: ${url}`);

    while (attempts < 120) { // Try for ~10 minutes (5s * 120 = 600s)
      try {
        const response = await fetch(url, { method: 'GET' });

        if (response.ok) {
          const data = await response.json() as { messages?: Array<{ status: string; attestation?: string; message?: string }> };

          if (data.messages && data.messages[0]) {
            const msg = data.messages[0];
            if (msg.status === 'complete' && msg.attestation) {
              console.log(`[CCTP] Attestation received after ${attempts * 5}s`);
              return {
                attestation: msg.attestation as Hex,
                message: msg.message as Hex
              };
            }
            console.log(`[CCTP] Attestation status: ${msg.status}...`);
          }
        } else if (response.status !== 404) {
          const text = await response.text().catch(() => '');
          console.log(`[CCTP] API response: ${response.status} ${response.statusText} ${text.slice(0, 100)}`);
        }
      } catch (error: any) {
        console.log(`[CCTP] Error polling attestation: ${error.message?.slice(0, 50)}`);
      }

      await new Promise(r => setTimeout(r, 5000)); // Wait 5s
      attempts++;

      // Log progress every 30 seconds
      if (attempts % 6 === 0) {
        console.log(`[CCTP] Still waiting for attestation... (${attempts * 5}s elapsed)`);
      }
    }
    throw new Error('Timeout fetching attestation after 10 minutes');
  }
  /**
    * Finalize Smart Deposit (Relayer Flow)
    */
  async finalizeSmartDeposit(
    txHash: Hex,
    sourceChainName: keyof typeof CCTP_CONTRACTS,
    userAddress: Address
  ): Promise<{ step: string; txHash: Hex }> {
    console.log(`[FinalizeDeposit] Processing bridge tx: ${txHash} for user ${userAddress}`);

    const sourceDomain = DOMAINS[sourceChainName];
    // @ts-ignore
    const destConfig = CCTP_CONTRACTS['arcTestnet'];
    const chain = this.chains.arcTestnet;

    if (!chain) throw new Error('Arc Testnet not configured');

    // 1. Fetch Attestation
    const attestationResult = await this.fetchAttestation(sourceDomain, txHash);
    const { message, attestation } = attestationResult;

    // 2. Mint to Backend
    const messageTransmitter = getContract({
      address: destConfig.messageTransmitter as Address,
      abi: messageTransmitterAbi,
      client: { public: chain.publicClient, wallet: chain.walletClient }
    });

    const usdc = getContract({
      address: USDC_ADDRESSES_TESTNET.arcTestnet,
      abi: erc20Abi,
      client: { public: chain.publicClient, wallet: chain.walletClient }
    });

    const preUSDC = await usdc.read.balanceOf([this.account.address]);

    console.log(`[CCTP] Minting (receiveMessage)...`);
    const mintTx = await messageTransmitter.write.receiveMessage([
      message,
      attestation
    ], { account: this.account, chain: chain.chain });
    await chain.publicClient.waitForTransactionReceipt({ hash: mintTx });

    const postUSDC = await usdc.read.balanceOf([this.account.address]);
    const amountMinted = postUSDC - preUSDC;
    console.log(`[CCTP] Minted: ${Number(amountMinted) / 1e6} USDC`);

    if (amountMinted <= 0n) {
      throw new Error("Minted 0 USDC. Cannot deposit.");
    }

    // 3. Deposit to Vault (Gateway Flow)
    // ArcYieldVault uses onGatewayDeposit for cross-chain credits (no shares)

    const vault = getContract({
      address: ARC_VAULT_ADDRESS,
      abi: vaultAbi,
      client: { public: chain.publicClient, wallet: chain.walletClient }
    });

    // A. Claim Gateway Role (if needed)
    // Note: If backend is NOT owner, this will revert. We assume backend deployed/owns vault.
    try {
      const currentGateway = await vault.read.circleGateway();
      if (currentGateway.toLowerCase() !== this.account.address.toLowerCase()) {
        console.log(`[Vault] Claiming Gateway role (current: ${currentGateway})...`);
        const setTx = await vault.write.setCircleGateway([this.account.address], { account: this.account, chain: chain.chain });
        await chain.publicClient.waitForTransactionReceipt({ hash: setTx });
        console.log(`[Vault] Gateway role claimed.`);
      }
    } catch (e: any) {
      console.warn(`[Vault] Failed to check/set Gateway role (ignoring if already set): ${e.message}`);
    }

    // B. Transfer USDC to Vault
    console.log(`[Vault] Transferring ${Number(amountMinted) / 1e6} USDC to Vault...`);
    const transferTx = await usdc.write.transfer(
      [ARC_VAULT_ADDRESS, amountMinted],
      { account: this.account, chain: chain.chain }
    );
    await chain.publicClient.waitForTransactionReceipt({ hash: transferTx });
    console.log(`[Vault] Transfer confirmed: ${transferTx}`);

    // C. Call onGatewayDeposit
    console.log(`[Vault] Crediting user ${userAddress}...`);
    const creditTx = await vault.write.onGatewayDeposit(
      [userAddress, amountMinted, sourceDomain],
      { account: this.account, chain: chain.chain }
    );
    await chain.publicClient.waitForTransactionReceipt({ hash: creditTx });
    console.log(`[Vault] User Credited: ${creditTx}`);

    return {
      step: 'complete',
      txHash: creditTx,
    };
  }

  /**
   * Get User's Vault Balance
   */
  async getVaultBalance(userAddress: Address): Promise<{
    principal: string;
    totalBalance: string;
    availableYield: string;
  }> {
    const chain = this.chains.arcTestnet;
    if (!chain) throw new Error('Arc Testnet not configured');

    const vault = getContract({
      address: ARC_VAULT_ADDRESS,
      abi: vaultAbi,
      client: { public: chain.publicClient, wallet: chain.walletClient }
    });

    // getUserDeposit returns tuple/struct
    const [principal, depositTimestamp, accruedYield, availableYield, totalBalance] =
      await vault.read.getUserDeposit([userAddress]);

    return {
      principal: principal.toString(),
      totalBalance: totalBalance.toString(),
      availableYield: availableYield.toString()
    };
  }
}
