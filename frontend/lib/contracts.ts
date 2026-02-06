import { type Address } from "viem"

// Polygon Amoy contracts
export const SESSION_ESCROW_ADDRESS = "0x55bc3bdee84453debd340af693af7af825acfe26" as Address
export const POLYGON_USDC_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as Address

export const ERC20_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "decimals",
        type: "function",
        stateMutability: "view",
        inputs: [],
        outputs: [{ name: "", type: "uint8" }],
    },
    {
        name: "approve",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
    {
        name: "allowance",
        type: "function",
        stateMutability: "view",
        inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
    {
        name: "transfer",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "to", type: "address" },
            { name: "amount", type: "uint256" },
        ],
        outputs: [{ name: "", type: "bool" }],
    },
] as const

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
  },
  {
    type: "function",
    name: "setYieldRate",
    inputs: [{ name: "_yieldRateBps", type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "setNitroliteSigner",
    inputs: [
      { name: "_signer", type: "address" },
      { name: "_active", type: "bool" }
    ],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "transferOwnership",
    inputs: [{ name: "newOwner", type: "address" }],
    outputs: [],
    stateMutability: "nonpayable"
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view"
  }
] as const
