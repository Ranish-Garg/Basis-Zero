import { type Address } from "viem"

export const SESSION_ESCROW_ADDRESS = "0x49E4177eA6F21Cc5673bDc0b09507C5648fd53a3" as Address // From backend/.env
export const POLYGON_USDC_ADDRESS = "0x41E94Eb019C0762f9Bfcf9Fb1E58725BfB0e7582" as Address

// Arc Testnet vault contract
export const ARC_VAULT_ADDRESS = "0x49E4177eA6F21Cc5673bDc0b09507C5648fd53a3" as Address // Same as deposit widget
export const ARC_USDC_ADDRESS = "0x3600000000000000000000000000000000000000" as Address

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
    "type": "function",
    "name": "deposit",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "requestWithdrawal",
    "inputs": [
      {
        "name": "amount",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "balances",
    "inputs": [
      {
        "name": "",
        "type": "address",
        "internalType": "address"
      }
    ],
    "outputs": [
      {
        "name": "totalDeposited",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "lockedInSession",
        "type": "uint256",
        "internalType": "uint256"
      },
      {
        "name": "pendingWithdrawal",
        "type": "uint256",
        "internalType": "uint256"
      }
    ],
    "stateMutability": "view"
  }
] as const

// ArcYieldVault ABI - for reading vault data directly from contract
export const ARC_VAULT_ABI = [
  {
    name: "getUserDeposit",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "principal", type: "uint256" },
      { name: "depositTimestamp", type: "uint256" },
      { name: "accruedYield", type: "uint256" },
      { name: "availableYield", type: "uint256" },
      { name: "totalBalance", type: "uint256" }
    ]
  },
  {
    name: "getSession",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [
      { name: "state", type: "uint8" },
      { name: "lockedAmount", type: "uint256" },
      { name: "startedAt", type: "uint256" },
      { name: "sessionId", type: "bytes32" },
      { name: "timeUntilTimeout", type: "uint256" }
    ]
  },
  {
    name: "getAccruedYield",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "getStreamingBalance",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "rwaRateBps",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }]
  },
  {
    name: "withdraw",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    name: "deposit",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "amount", type: "uint256" }],
    outputs: []
  },
  {
    name: "lockSessionAllowance",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "sessionId", type: "bytes32" }
    ],
    outputs: []
  },
  {
    name: "cancelTimedOutSession",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "user", type: "address" }],
    outputs: []
  }
] as const

