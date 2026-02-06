import { type Address } from 'viem';

export const SESSION_ESCROW_ADDRESS = process.env.SESSION_ESCROW_ADDRESS as Address;

export const SESSION_ESCROW_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "withdraw",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "withdrawYield",
    inputs: [],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "openSession",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "sessionId", type: "bytes32" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "settleSession",
    inputs: [
      { name: "sessionId", type: "bytes32" },
      { name: "pnl", type: "int256" },
      { name: "signatures", type: "bytes[]" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "timeoutRelease",
    inputs: [{ name: "sessionId", type: "bytes32" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "getAccountInfo",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "principal", type: "uint256" },
      { name: "yield", type: "uint256" },
      { name: "locked", type: "uint256" },
      { name: "activeSessionId", type: "bytes32" },
      { name: "state", type: "uint8" }
    ],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "yieldRateBps",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view"
  },
  {
    type: "function",
    name: "accounts",
    inputs: [{ name: "", type: "address" }],
    outputs: [
      { name: "principalBalance", type: "uint256" },
      { name: "accruedYield", type: "uint256" },
      { name: "lastUpdateTimestamp", type: "uint256" },
      { name: "lockedAmount", type: "uint256" },
      { name: "activeSessionId", type: "bytes32" },
      { name: "sessionStartTime", type: "uint256" },
      { name: "sessionState", type: "uint8" }
    ],
    stateMutability: "view"
  }
] as const;
