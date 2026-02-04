"use client"

import { useState } from "react"
import { Plus, X, Loader2, CheckCircle, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCreateMarket } from "@/hooks/use-amm"
import { parseUSDCInput } from "@/lib/amm-types"

interface CreateMarketDialogProps {
    isOpen: boolean
    onClose: () => void
}

// Category options
const categories = [
    { id: "crypto", label: "Crypto" },
    { id: "sports", label: "Sports" },
    { id: "macro", label: "Macro/Economy" },
    { id: "politics", label: "Politics" },
    { id: "weather", label: "Weather" },
    { id: "other", label: "Other" },
]

export function CreateMarketDialog({ isOpen, onClose }: CreateMarketDialogProps) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("crypto")
    const [expiresAt, setExpiresAt] = useState("")
    const [liquidity, setLiquidity] = useState("10")
    const [success, setSuccess] = useState(false)

    const createMarket = useCreateMarket()

    // Get minimum date (tomorrow)
    const getMinDate = () => {
        const tomorrow = new Date()
        tomorrow.setDate(tomorrow.getDate() + 1)
        return tomorrow.toISOString().split('T')[0]
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!title.trim() || !expiresAt) return

        // Generate marketId from title
        const marketId = title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            + '-' + Date.now().toString(36)

        try {
            await createMarket.mutateAsync({
                marketId,
                title,
                description: description || undefined,
                category,
                expiresAt: new Date(expiresAt).toISOString(),
                initialLiquidity: parseUSDCInput(liquidity)
            })

            setSuccess(true)
            setTimeout(() => {
                setSuccess(false)
                onClose()
                setTitle("")
                setDescription("")
                setCategory("crypto")
                setExpiresAt("")
                setLiquidity("10")
            }, 1500)
        } catch (error) {
            console.error('Failed to create market:', error)
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
            <div className="relative w-full max-w-md mx-4 rounded-xl border border-border bg-card p-5 sm:p-6 shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-semibold">Create Prediction Market</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-lg hover:bg-muted transition-colors"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {success ? (
                    <div className="py-8 text-center">
                        <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                        <p className="text-lg font-medium">Market Created!</p>
                        <p className="text-sm text-muted-foreground mt-1">
                            Your market is now live for trading
                        </p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* Market Title */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Market Question *
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Will BTC reach $100K by March 2026?"
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                required
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Frame as a yes/no question
                            </p>
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Category *
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                required
                            >
                                {categories.map((cat) => (
                                    <option key={cat.id} value={cat.id}>
                                        {cat.label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Expiry Date */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Resolution Date *
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <input
                                    type="date"
                                    value={expiresAt}
                                    onChange={(e) => setExpiresAt(e.target.value)}
                                    min={getMinDate()}
                                    className="w-full pl-10 pr-3 py-2 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                    required
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                When should this market be resolved?
                            </p>
                        </div>

                        {/* Description */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Description (optional)
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                placeholder="Add details about resolution criteria..."
                                rows={2}
                                className="w-full px-3 py-2 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors resize-none"
                            />
                        </div>

                        {/* Initial Liquidity */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                Initial Liquidity (USDC) *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    $
                                </span>
                                <input
                                    type="number"
                                    value={liquidity}
                                    onChange={(e) => setLiquidity(e.target.value)}
                                    min="1"
                                    step="1"
                                    className="w-full pl-7 pr-3 py-2 rounded-lg border border-border bg-background focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-colors"
                                    required
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Higher liquidity = lower slippage for traders
                            </p>
                        </div>

                        {/* Error Message */}
                        {createMarket.error && (
                            <p className="text-sm text-red-500">
                                {createMarket.error.message}
                            </p>
                        )}

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={createMarket.isPending || !title.trim() || !expiresAt}
                            className={cn(
                                "w-full py-3 rounded-lg font-medium transition-all",
                                "bg-primary text-primary-foreground hover:bg-primary/90",
                                "disabled:opacity-50 disabled:cursor-not-allowed"
                            )}
                        >
                            {createMarket.isPending ? (
                                <span className="flex items-center justify-center gap-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    Creating...
                                </span>
                            ) : (
                                "Create Market"
                            )}
                        </button>
                    </form>
                )}
            </div>
        </div>
    )
}

export function CreateMarketButton({ onClick }: { onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all",
                "bg-primary text-primary-foreground hover:bg-primary/90",
                "shadow-lg shadow-primary/25"
            )}
        >
            <Plus className="h-4 w-4" />
            Create Market
        </button>
    )
}
