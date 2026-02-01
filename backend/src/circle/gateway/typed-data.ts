import { randomBytes } from 'node:crypto';
import { pad, zeroAddress, maxUint256, type Address, type Hex } from 'viem';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

// Minimal chain config needed for burn intent creation
interface ChainConfig {
  domain: number;
  usdcAddress: Address;
  gatewayWalletAddress: Address;
  gatewayMinterAddress: Address;
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface TransferSpec {
  version: number;
  sourceDomain: number;
  destinationDomain: number;
  sourceContract: Address;
  destinationContract: Address;
  sourceToken: Address;
  destinationToken: Address;
  sourceDepositor: Address;
  destinationRecipient: Address;
  sourceSigner: Address;
  destinationCaller: Address;
  value: bigint;
  salt: Hex;
  hookData: Hex;
}

export interface BurnIntent {
  maxBlockHeight: bigint;
  maxFee: bigint;
  spec: TransferSpec;
}

export interface BurnIntentOptions {
  account: { address: Address };
  from: ChainConfig;
  to: ChainConfig;
  amount: number;
  recipient?: Address;
  maxFee?: bigint;
}

// ═══════════════════════════════════════════════════════════════════════════
// EIP-712 DOMAIN & TYPES
// ═══════════════════════════════════════════════════════════════════════════

const domain = {
  name: 'GatewayWallet',
  version: '1',
} as const;

const EIP712Domain = [
  { name: 'name', type: 'string' },
  { name: 'version', type: 'string' },
] as const;

const TransferSpecType = [
  { name: 'version', type: 'uint32' },
  { name: 'sourceDomain', type: 'uint32' },
  { name: 'destinationDomain', type: 'uint32' },
  { name: 'sourceContract', type: 'bytes32' },
  { name: 'destinationContract', type: 'bytes32' },
  { name: 'sourceToken', type: 'bytes32' },
  { name: 'destinationToken', type: 'bytes32' },
  { name: 'sourceDepositor', type: 'bytes32' },
  { name: 'destinationRecipient', type: 'bytes32' },
  { name: 'sourceSigner', type: 'bytes32' },
  { name: 'destinationCaller', type: 'bytes32' },
  { name: 'value', type: 'uint256' },
  { name: 'salt', type: 'bytes32' },
  { name: 'hookData', type: 'bytes' },
] as const;

const BurnIntentType = [
  { name: 'maxBlockHeight', type: 'uint256' },
  { name: 'maxFee', type: 'uint256' },
  { name: 'spec', type: 'TransferSpec' },
] as const;

const BurnIntentSetType = [{ name: 'intents', type: 'BurnIntent[]' }] as const;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert an address to bytes32 format
 */
function addressToBytes32(address: Address): Hex {
  return pad(address.toLowerCase() as Address, { size: 32 });
}

/**
 * Create a burn intent object for a cross-chain transfer
 */
export function burnIntent({
  account,
  from,
  to,
  amount,
  recipient,
  maxFee = 2_010000n, // 2.01 USDC covers fee for any chain
}: BurnIntentOptions): BurnIntent {
  return {
    // Needs to be at least 7 days in the future (maxUint256 = no expiry)
    maxBlockHeight: maxUint256,
    // Max fee user is willing to pay
    maxFee,
    // The details of the transfer
    spec: {
      version: 1,
      sourceDomain: from.domain,
      destinationDomain: to.domain,
      sourceContract: from.gatewayWalletAddress,
      destinationContract: to.gatewayMinterAddress,
      sourceToken: from.usdcAddress,
      destinationToken: to.usdcAddress,
      sourceDepositor: account.address,
      destinationRecipient: recipient || account.address,
      sourceSigner: account.address,
      destinationCaller: zeroAddress, // Anyone can use the attestation
      value: BigInt(Math.floor(amount * 1e6)), // Convert to atomic units (6 decimals)
      salt: `0x${randomBytes(32).toString('hex')}` as Hex,
      hookData: '0x' as Hex, // No hook data for now
    },
  };
}

/**
 * Convert a burn intent to EIP-712 typed data format for signing
 */
export function burnIntentTypedData(intent: BurnIntent) {
  return {
    types: {
      EIP712Domain,
      TransferSpec: TransferSpecType,
      BurnIntent: BurnIntentType,
    },
    domain,
    primaryType: 'BurnIntent' as const,
    message: {
      ...intent,
      spec: {
        ...intent.spec,
        sourceContract: addressToBytes32(intent.spec.sourceContract),
        destinationContract: addressToBytes32(intent.spec.destinationContract),
        sourceToken: addressToBytes32(intent.spec.sourceToken),
        destinationToken: addressToBytes32(intent.spec.destinationToken),
        sourceDepositor: addressToBytes32(intent.spec.sourceDepositor),
        destinationRecipient: addressToBytes32(intent.spec.destinationRecipient),
        sourceSigner: addressToBytes32(intent.spec.sourceSigner),
        destinationCaller: addressToBytes32(intent.spec.destinationCaller),
      },
    },
  };
}

/**
 * Convert multiple burn intents to a single EIP-712 typed data set for batch signing
 */
export function burnIntentSetTypedData(intents: BurnIntent[]) {
  return {
    types: {
      EIP712Domain,
      TransferSpec: TransferSpecType,
      BurnIntent: BurnIntentType,
      BurnIntentSet: BurnIntentSetType,
    },
    domain,
    primaryType: 'BurnIntentSet' as const,
    message: {
      intents: intents.map((intent) => burnIntentTypedData(intent).message),
    },
  };
}
