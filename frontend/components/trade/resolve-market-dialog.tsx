"use client"

import { useState } from "react"
import { Check, X, Gavel, Loader2, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Market } from "@/lib/amm-types"
import { useAccount } from "wagmi"

interface ResolveMarketDialogProps {
    isOpen: boolean
    onClose: () => void
    market: Market
}

export function ResolveMarketDialog({ isOpen, onClose, market }: ResolveMarketDialogProps) {
    const [outcome, setOutcome] = useState<'YES' | 'NO' | null>(null)
    const [confirming, setConfirming] = useState(false)
    const queryClient = useQueryClient()
    const { address } = useAccount()

    // Resolve Mutation
    const resolveMutation = useMutation({
        mutationFn: async (vars: { marketId: string, outcome: number, resolvedBy: string }) => {
            // Retrieve resolver address (assuming user is connected and we can get it from context/props if needed, 
            // but for simplicity we'll just pass a placeholder or let the backend validate if we send the wallet address)
            // Implementation note: Ideally we should sign this message or pass the connected wallet address.
            // For now, we'll send it to the resolve endpoint.

            const response = await fetch('/api/amm/markets/resolve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(vars)
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.error || 'Failed to resolve market')
            }
            return response.json()
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['amm', 'markets'] })
            onClose()
        }
    })

    const handleResolve = async () => {
        if (!outcome) return
        setConfirming(true)

        try {
            // Need connected address here. For hackathon/MVP, we'll assume the visible button implies authorization 
            // and maybe pass a mock or current wallet address if available.
            // Since we need to modify `use-amm.ts` or similar to get wallet, we'll implement the mutation directly here for now.
            // Assuming we can get 'resolvedBy' from a hook or prop.
            // Let's defer address fetching and just send the request.
            // Note: In a real app we'd need to verify the sender.

            await resolveMutation.mutateAsync({
                marketId: market.marketId,
                outcome: outcome === 'YES' ? 0 : 1,
                resolvedBy: address || "unknown"
            })
        } catch (err) {
            console.error(err)
            setConfirming(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Dialog */}
            <div className="relative w-full max-w-sm mx-4 rounded-xl border border-border bg-card p-6 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center mb-6">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4 text-primary">
                        <Gavel className="h-6 w-6" />
                    </div>
                    <h2 className="text-xl font-semibold">Resolve Market</h2>
                    <p className="text-sm text-muted-foreground mt-1 px-4">
                        {market.title}
                    </p>
                </div>

                {!confirming ? (
                    <div className="space-y-4">
                        <p className="text-sm font-medium text-center text-muted-foreground/80">
                            Select the winning outcome:
                        </p>

                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setOutcome('YES')}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                                    outcome === 'YES'
                                        ? "border-green-500 bg-green-500/10 text-green-500"
                                        : "border-border hover:border-primary/50 hover:bg-accent"
                                )}
                            >
                                <Check className="h-6 w-6 mb-2" />
                                <span className="font-bold">YES</span>
                            </button>

                            <button
                                onClick={() => setOutcome('NO')}
                                className={cn(
                                    "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all",
                                    outcome === 'NO'
                                        ? "border-red-500 bg-red-500/10 text-red-500"
                                        : "border-border hover:border-primary/50 hover:bg-accent"
                                )}
                            >
                                <X className="h-6 w-6 mb-2" />
                                <span className="font-bold">NO</span>
                            </button>
                        </div>

                        {outcome && (
                            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 flex items-start gap-3 mt-4">
                                <AlertCircle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
                                <p className="text-xs text-yellow-500/90 text-left">
                                    This action is irreversible. Funds will be distributed immediately to {outcome} holders.
                                </p>
                            </div>
                        )}

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={onClose}
                                className="flex-1 py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleResolve}
                                disabled={!outcome}
                                className={cn(
                                    "flex-1 py-2.5 rounded-lg font-medium transition-all shadow-lg",
                                    outcome === 'YES' ? "bg-green-500 text-white shadow-green-500/20" :
                                        outcome === 'NO' ? "bg-red-500 text-white shadow-red-500/20" :
                                            "bg-muted text-muted-foreground cursor-not-allowed"
                                )}
                            >
                                Confirm Resolve
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="py-8 flex flex-col items-center">
                        <Loader2 className="h-10 w-10 text-primary animate-spin mb-4" />
                        <p className="text-lg font-medium">Resolving Market...</p>
                        <p className="text-sm text-muted-foreground mt-2">
                            Distributing payouts on-chain
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
