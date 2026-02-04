"use client"

import { useState, useEffect } from "react"
import { ArrowRight, CheckCircle, Loader2, Wallet, AlertCircle, Clock, Zap, ArrowDownUp } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain, useChainId } from "wagmi"
import { parseUnits, formatUnits, zeroAddress, type Address } from "viem"
import { Confetti } from "@/components/ui/confetti"
import { arcTestnet } from "@/lib/wagmi"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useMultiChainUSDC, USDC_CONFIG, ARC_CHAIN_ID } from "@/hooks/use-multi-chain-usdc"

// --- Constants & ABIs ---

const ARC_VAULT_ADDRESS = "0x49E4177eA6F21Cc5673bDc0b09507C5648fd53a3" as Address

const ERC20_ABI = [
    {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
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
] as const

const VAULT_ABI = [
    {
        name: "deposit",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
            { name: "assets", type: "uint256" },
            { name: "receiver", type: "address" },
        ],
        outputs: [{ name: "", type: "uint256" }],
    },
] as const

// Bridge flow states
type BridgeStep = "idle" | "approving" | "burning" | "waiting_attestation" | "minting" | "depositing" | "success" | "error"

export function DepositWidget() {
    const [mounted, setMounted] = useState(false)
    useEffect(() => setMounted(true), [])

    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const { switchChain } = useSwitchChain()
    
    // Multi-chain USDC hook
    const { 
        balance, 
        balanceRaw, 
        decimals, 
        chainName, 
        usdcAddress, 
        isOnArc, 
        needsBridge, 
        isSupported 
    } = useMultiChainUSDC()
    
    const [amount, setAmount] = useState("")
    const [bridgeStep, setBridgeStep] = useState<BridgeStep>("idle")
    const [bridgeError, setBridgeError] = useState<string | null>(null)
    const [estimatedTime, setEstimatedTime] = useState(0)
    
    // --- Direct Deposit (Arc only) ---
    
    // Allowance check for Arc direct deposit
    const arcUsdcAddress = USDC_CONFIG[ARC_CHAIN_ID]?.address
    const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
        address: arcUsdcAddress,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address || zeroAddress, ARC_VAULT_ADDRESS],
        chainId: ARC_CHAIN_ID,
        query: { enabled: !!address && isOnArc }
    })

    const hasAllowance = allowanceData && amount ? allowanceData >= parseUnits(amount, 6) : false // Arc USDC = 6 decimals

    // Write contracts
    const { writeContract: writeApprove, data: approveHash, isPending: isApproving } = useWriteContract()
    const { writeContract: writeDeposit, data: depositHash, isPending: isDepositing, error: depositError } = useWriteContract()

    const { isLoading: isWaitingApprove, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })
    const { isLoading: isWaitingDeposit, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash })

    useEffect(() => {
        if (isApproveSuccess) refetchAllowance()
    }, [isApproveSuccess, refetchAllowance])

    useEffect(() => {
        if (isDepositSuccess) setBridgeStep("success")
    }, [isDepositSuccess])

    // --- Bridge Flow (Non-Arc chains) ---
    
    const handleBridge = async () => {
        if (!address || !amount || !usdcAddress) return
        setBridgeError(null)

        try {
            // Step 1: Approve USDC on source chain
            setBridgeStep("approving")
            const amountBig = parseUnits(amount, decimals)
            
            // Get source chain CCTP token messenger
            const tokenMessengerMap: Record<number, Address> = {
                80002: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // Polygon Amoy V2
                11155111: "0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA", // Sepolia V2
            }
            const tokenMessenger = tokenMessengerMap[chainId]
            if (!tokenMessenger) throw new Error("Chain not supported for bridging")

            // Call backend bridge API
            setBridgeStep("burning")
            setEstimatedTime(180) // 3 minutes estimate

            const response = await fetch("http://localhost:3001/api/cctp/bridge", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sourceChain: chainId === 80002 ? "polygonAmoy" : "sepolia",
                    destChain: "arcTestnet",
                    amount: amountBig.toString(),
                    recipient: address
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || "Bridge failed")
            }

            setBridgeStep("waiting_attestation")
            
            // Poll for completion or use SSE
            const result = await response.json()
            
            if (result.success) {
                setBridgeStep("success")
            } else {
                throw new Error(result.error || "Bridge failed")
            }

        } catch (error) {
            console.error("Bridge error:", error)
            setBridgeError(error instanceof Error ? error.message : "Bridge failed")
            setBridgeStep("error")
        }
    }

    // --- Direct Deposit Handler (Arc) ---
    
    const handleDirectDeposit = () => {
        if (!isConnected || !address) return

        if (chainId !== ARC_CHAIN_ID) {
            switchChain({ chainId: ARC_CHAIN_ID })
            return
        }

        const amountBig = parseUnits(amount, 6) // Arc USDC = 6 decimals

        if (!hasAllowance) {
            writeApprove({
                address: arcUsdcAddress!,
                abi: ERC20_ABI,
                functionName: "approve",
                args: [ARC_VAULT_ADDRESS, amountBig]
            })
        } else {
            writeDeposit({
                address: ARC_VAULT_ADDRESS,
                abi: VAULT_ABI,
                functionName: "deposit",
                args: [amountBig, address]
            })
        }
    }

    // --- Render ---

    if (!mounted) return (
        <div className="rounded-xl border border-border bg-card/60 glass p-8 text-center h-[400px] flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    )

    const isProcessing = isApproving || isWaitingApprove || isDepositing || isWaitingDeposit || 
                         ["approving", "burning", "waiting_attestation", "minting", "depositing"].includes(bridgeStep)
    const isSuccess = bridgeStep === "success" || isDepositSuccess

    if (!isConnected) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass p-8 text-center space-y-4 flex flex-col items-center">
                <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                    <Wallet className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-bold">Connect Wallet</h3>
                <p className="text-muted-foreground max-w-xs">
                    Connect to deposit USDC into the Yield Vault.
                </p>
                <div className="mt-4">
                    <ConnectButton />
                </div>
            </div>
        )
    }

    if (isSuccess) {
        return (
            <div className="rounded-xl border border-border bg-card/60 glass p-8 text-center space-y-6">
                <Confetti className="absolute inset-0 pointer-events-none" />
                <div className="flex flex-col items-center justify-center">
                    <div className="h-16 w-16 rounded-full bg-green-500/10 flex items-center justify-center mb-4 text-green-500">
                        <CheckCircle className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl font-bold">
                        {needsBridge ? "Bridge & Deposit Complete!" : "Deposit Successful!"}
                    </h3>
                    <p className="text-muted-foreground mt-2">
                        {needsBridge 
                            ? `Bridged ${amount} USDC from ${chainName} to Arc Vault`
                            : `Deposited ${amount} USDC to Vault`
                        }
                    </p>
                </div>
                <button 
                    onClick={() => { setBridgeStep("idle"); setAmount(""); }}
                    className="w-full py-3 bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
                >
                    Make Another Deposit
                </button>
            </div>
        )
    }

    return (
        <div className="rounded-xl border border-border bg-card/60 glass overflow-hidden relative p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/50 pb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <VaultIcon className="h-5 w-5 text-primary" />
                    Vault Deposit
                </h3>
                <div className="px-2 py-1 rounded bg-secondary/50 text-xs font-mono">
                    APY: 5.12%
                </div>
            </div>

            {/* Chain Badge */}
            <div className={cn(
                "flex items-center justify-between p-3 rounded-lg border",
                isOnArc 
                    ? "border-green-500/20 bg-green-500/10" 
                    : "border-yellow-500/20 bg-yellow-500/10"
            )}>
                <div className="flex items-center gap-2">
                    {isOnArc ? (
                        <Zap className="h-4 w-4 text-green-500" />
                    ) : (
                        <ArrowDownUp className="h-4 w-4 text-yellow-500" />
                    )}
                    <span className="text-sm font-medium">
                        {isOnArc ? "Direct Deposit" : `Bridge from ${chainName}`}
                    </span>
                </div>
                {needsBridge && (
                    <div className="flex items-center gap-1 text-xs text-yellow-500">
                        <Clock className="h-3 w-3" />
                        ~3 min
                    </div>
                )}
            </div>

            {/* Unsupported Chain Warning */}
            {!isSupported && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Unsupported chain. Please switch to Arc, Polygon Amoy, or Sepolia.</span>
                </div>
            )}

            {/* Input */}
            <div className="space-y-4">
                <div className="flex justify-between text-xs text-muted-foreground uppercase tracking-wider">
                    <label>Amount (USDC)</label>
                    <span>Balance: {parseFloat(balance).toFixed(2)}</span>
                </div>
                
                <div className="relative">
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="0.00"
                        disabled={isProcessing}
                        className="w-full rounded-lg border border-border bg-secondary/50 px-4 py-3 pr-20 font-mono text-xl focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <span className="font-mono text-sm text-primary font-bold">USDC</span>
                        <button 
                            onClick={() => setAmount(balance)}
                            className="text-xs bg-primary/10 hover:bg-primary/20 text-primary px-2 py-1 rounded"
                        >
                            MAX
                        </button>
                    </div>
                </div>
            </div>

            {/* Bridge Progress */}
            {needsBridge && bridgeStep !== "idle" && bridgeStep !== "error" && (
                <div className="space-y-3">
                    <div className="text-xs text-muted-foreground uppercase tracking-wider">Bridge Progress</div>
                    <div className="flex items-center gap-2">
                        {["approving", "burning", "waiting_attestation", "minting", "depositing"].map((step, i) => (
                            <div 
                                key={step}
                                className={cn(
                                    "flex-1 h-1.5 rounded-full transition-colors",
                                    bridgeStep === step ? "bg-primary animate-pulse" :
                                    ["approving", "burning", "waiting_attestation", "minting", "depositing"].indexOf(bridgeStep) > i 
                                        ? "bg-green-500" : "bg-secondary"
                                )}
                            />
                        ))}
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                        {bridgeStep === "approving" && "Approving USDC..."}
                        {bridgeStep === "burning" && "Burning USDC on source chain..."}
                        {bridgeStep === "waiting_attestation" && "Waiting for Circle attestation (~2-3 min)..."}
                        {bridgeStep === "minting" && "Minting USDC on Arc..."}
                        {bridgeStep === "depositing" && "Depositing to Vault..."}
                    </p>
                </div>
            )}

            {/* Error */}
            {(depositError || bridgeError) && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-2 text-sm text-red-400">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>{bridgeError || depositError?.message.split('\n')[0]}</span>
                </div>
            )}

            {/* Action Button */}
            <button
                onClick={needsBridge ? handleBridge : handleDirectDeposit}
                disabled={!amount || parseFloat(amount) <= 0 || isProcessing || !isSupported}
                className={cn(
                    "w-full py-4 rounded-xl font-bold text-lg transition-all relative overflow-hidden",
                    !amount || parseFloat(amount) <= 0 || !isSupported
                        ? "bg-secondary text-muted-foreground cursor-not-allowed"
                        : "bg-primary text-primary-foreground hover:bg-primary/90"
                )}
            >
                {isProcessing ? (
                    <div className="flex items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span>
                            {isApproving || isWaitingApprove ? "Approving..." : 
                             isDepositing || isWaitingDeposit ? "Depositing..." :
                             "Bridging..."}
                        </span>
                    </div>
                ) : (
                    <div className="flex items-center justify-center gap-2">
                        <span>
                            {!isSupported ? "Switch Network" :
                             needsBridge ? `Bridge & Deposit` :
                             !hasAllowance ? "Approve USDC" : "Deposit"}
                        </span>
                        {isSupported && <ArrowRight className="h-5 w-5" />}
                    </div>
                )}
            </button>

            {/* Footer */}
            <div className="text-center">
                <p className="text-xs text-muted-foreground">
                    Powered by Circle Arc {needsBridge && "& CCTP"} • Principal Protected
                </p>
            </div>
        </div>
    )
}

function VaultIcon({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect width="18" height="18" x="3" y="3" rx="2" />
            <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
            <path d="m7.9 7.9 2.7 2.7" />
            <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
            <path d="m13.4 10.6 2.7-2.7" />
            <circle cx="7.5" cy="16.5" r=".5" fill="currentColor" />
            <path d="m7.9 16.1 2.7-2.7" />
            <circle cx="16.5" cy="16.5" r=".5" fill="currentColor" />
            <path d="m13.4 13.4 2.7 2.7" />
            <circle cx="12" cy="12" r="2" />
        </svg>
    )
}
