"use client"

import { useState, useEffect } from "react"
import { Syringe, Loader2, CheckCircle, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from "wagmi"
import { parseUnits, formatUnits } from "viem"
import { ARC_VAULT_ADDRESS, ARC_USDC_ADDRESS, ERC20_ABI } from "@/lib/contracts"
import { arcTestnet } from "@/lib/wagmi"

type InjectStep = "idle" | "approving" | "transferring" | "success" | "error"

export function YieldInjectionWidget() {
    const { address, isConnected } = useAccount()
    const chainId = useChainId()
    const { switchChain } = useSwitchChain()
    
    const [amount, setAmount] = useState("")
    const [step, setStep] = useState<InjectStep>("idle")
    const [error, setError] = useState<string | null>(null)

    // Read wallet USDC balance
    const { data: usdcBalance } = useReadContract({
        address: ARC_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [address!],
        chainId: arcTestnet.id,
        query: { enabled: !!address }
    })

    // Read vault USDC balance (reserves)
    const { data: vaultBalance, refetch: refetchVaultBalance } = useReadContract({
        address: ARC_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "balanceOf",
        args: [ARC_VAULT_ADDRESS],
        chainId: arcTestnet.id
    })

    const walletBalanceFormatted = usdcBalance ? formatUnits(usdcBalance as bigint, 6) : "0"
    const vaultReservesFormatted = vaultBalance ? formatUnits(vaultBalance as bigint, 6) : "0"
    const walletBalanceNum = parseFloat(walletBalanceFormatted)
    const amountNum = parseFloat(amount) || 0
    const isValidAmount = amountNum > 0 && amountNum <= walletBalanceNum

    // Write contracts
    const { writeContract: writeTransfer, data: transferHash, isPending: isTransferring, error: transferError } = useWriteContract()
    const { isLoading: isWaitingTransfer, isSuccess: isTransferSuccess } = useWaitForTransactionReceipt({ hash: transferHash })

    // Handle injection
    const handleInject = async () => {
        if (!isConnected || !amount || !isValidAmount) return
        setError(null)

        if (chainId !== arcTestnet.id) {
            switchChain({ chainId: arcTestnet.id })
            return
        }

        setStep("transferring")
        const amountBig = parseUnits(amount, 6)

        // Direct transfer to vault (not deposit - no accounting)
        writeTransfer({
            address: ARC_USDC_ADDRESS,
            abi: ERC20_ABI,
            functionName: "transfer",
            args: [ARC_VAULT_ADDRESS, amountBig]
        })
    }

    // Handle success
    useEffect(() => {
        if (isTransferSuccess) {
            setStep("success")
            refetchVaultBalance()
        }
    }, [isTransferSuccess])

    // Handle errors
    useEffect(() => {
        if (transferError) {
            setError(transferError.message || "Transfer failed")
            setStep("error")
        }
    }, [transferError])

    const handleReset = () => {
        setStep("idle")
        setAmount("")
        setError(null)
    }

    if (!isConnected) return null

    const isProcessing = step === "approving" || step === "transferring" || isTransferring || isWaitingTransfer

    return (
        <div className="rounded-xl border border-yellow-500/20 bg-yellow-500/5 overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-yellow-500/20 bg-yellow-500/10">
                <div className="flex items-center gap-2">
                    <Syringe className="h-4 w-4 text-yellow-500" />
                    <h3 className="font-mono text-xs uppercase tracking-wider text-yellow-500">
                        Yield Injection (Dev)
                    </h3>
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* Vault Reserves */}
                <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Vault Reserves</span>
                    <span className="font-mono font-bold text-primary">
                        ${parseFloat(vaultReservesFormatted).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                </div>

                {/* Success State */}
                {step === "success" && (
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                        <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-500" />
                        <p className="text-sm text-green-400">Injected ${amount} USDC</p>
                        <button onClick={handleReset} className="text-xs text-muted-foreground mt-2 underline">
                            Inject more
                        </button>
                    </div>
                )}

                {/* Error State */}
                {step === "error" && (
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-center">
                        <AlertCircle className="h-6 w-6 mx-auto mb-2 text-red-500" />
                        <p className="text-sm text-red-400">{error}</p>
                        <button onClick={handleReset} className="text-xs text-muted-foreground mt-2 underline">
                            Try again
                        </button>
                    </div>
                )}

                {/* Input Form */}
                {step !== "success" && step !== "error" && (
                    <>
                        <div>
                            <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                <span>Amount</span>
                                <span>Wallet: ${walletBalanceNum.toFixed(2)}</span>
                            </div>
                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder="0.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    disabled={isProcessing}
                                    className="w-full px-3 py-2 pr-16 bg-secondary/50 border border-border rounded-lg text-sm font-mono focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
                                />
                                <button 
                                    onClick={() => setAmount(walletBalanceFormatted)}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs bg-yellow-500/20 text-yellow-500 px-2 py-0.5 rounded"
                                >
                                    MAX
                                </button>
                            </div>
                        </div>

                        <button
                            onClick={handleInject}
                            disabled={!isValidAmount || isProcessing}
                            className={cn(
                                "w-full py-2 rounded-lg font-medium text-sm transition-all flex items-center justify-center gap-2",
                                isValidAmount && !isProcessing
                                    ? "bg-yellow-500 hover:bg-yellow-600 text-black"
                                    : "bg-secondary text-muted-foreground cursor-not-allowed"
                            )}
                        >
                            {isProcessing ? (
                                <>
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Injecting...</span>
                                </>
                            ) : (
                                <span>Inject Yield Reserves</span>
                            )}
                        </button>

                        <p className="text-xs text-muted-foreground text-center">
                            Transfers USDC from your wallet to vault reserves
                        </p>
                    </>
                )}
            </div>
        </div>
    )
}
