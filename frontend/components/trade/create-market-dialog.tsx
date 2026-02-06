"use client"

import { useState } from "react"
import { Plus, X, Loader2, CheckCircle, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import { useCreateMarket } from "@/hooks/use-amm"
import { parseUSDCInput } from "@/lib/amm-types"
import { useAccount } from "wagmi"

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

// Oracle Assets
const oracleAssets = [
    { id: "BTC", label: "Bitcoin (BTC)" },
    { id: "ETH", label: "Ethereum (ETH)" },
    { id: "SOL", label: "Solana (SOL)" },
    { id: "USDC", label: "USDC" },
]

export function CreateMarketDialog({ isOpen, onClose }: CreateMarketDialogProps) {
    const [title, setTitle] = useState("")
    const [description, setDescription] = useState("")
    const [category, setCategory] = useState("crypto")
    const [expiresAt, setExpiresAt] = useState("")
    const [liquidity, setLiquidity] = useState("10")

    // Resolution state
    const [resolutionType, setResolutionType] = useState<"manual" | "oracle">("manual")
    const [oracleAsset, setOracleAsset] = useState("BTC")
    const [oracleCondition, setOracleCondition] = useState(">")
    const [oracleTarget, setOracleTarget] = useState("")
    const [resolverAddress, setResolverAddress] = useState("")

    const [success, setSuccess] = useState(false)

    const createMarket = useCreateMarket()
    const { address } = useAccount()

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
                initialLiquidity: parseUSDCInput(liquidity),
                resolutionType,
                oracleConfig: resolutionType === 'oracle' ? {
                    asset: oracleAsset,
                    condition: oracleCondition,
                    targetPrice: parseFloat(oracleTarget)
                } : undefined,
                // Use explicit resolver address if provided, otherwise default to connected wallet
                resolverAddress: resolutionType === 'manual' ? (resolverAddress || address || undefined) : undefined
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
                setResolutionType("manual")
                setOracleTarget("")
                setResolverAddress("")
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

                        {/* Resolution Settings */}
                        <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-4">
                            <label className="block text-sm font-medium text-primary">Resolution Method</label>

                            <div className="flex bg-background rounded-lg border border-border p-1">
                                <button
                                    type="button"
                                    onClick={() => setResolutionType('manual')}
                                    className={cn(
                                        "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                                        resolutionType === 'manual' ? "bg-primary text-primary-foreground shadow-sm" : "hover:text-primary"
                                    )}
                                >
                                    Manual
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setResolutionType('oracle')}
                                    className={cn(
                                        "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                                        resolutionType === 'oracle' ? "bg-primary text-primary-foreground shadow-sm" : "hover:text-primary"
                                    )}
                                >
                                    Price Oracle
                                </button>
                            </div>

                            {resolutionType === 'oracle' ? (
                                <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium mb-1 block text-muted-foreground">Asset</label>
                                            <select
                                                value={oracleAsset}
                                                onChange={(e) => setOracleAsset(e.target.value)}
                                                className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
                                            >
                                                {oracleAssets.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium mb-1 block text-muted-foreground">Title</label>
                                            <select
                                                value={oracleCondition}
                                                onChange={(e) => setOracleCondition(e.target.value)}
                                                className="w-full px-2 py-1.5 rounded-md border border-border bg-background text-sm"
                                            >
                                                <option value=">">Greater (&gt;)</option>
                                                <option value=">=">Greater/Eq (&ge;)</option>
                                                <option value="<">Less (&lt;)</option>
                                                <option value="<=">Less/Eq (&le;)</option>
                                                <option value="==">Equal (=)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="text-xs font-medium mb-1 block text-muted-foreground">Target Price (USD)</label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                                            <input
                                                type="number"
                                                value={oracleTarget}
                                                onChange={(e) => setOracleTarget(e.target.value)}
                                                placeholder="100000"
                                                className="w-full pl-6 pr-3 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:border-primary"
                                                required={resolutionType === 'oracle'}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Market resolves YES if {oracleAsset} is {oracleCondition} ${oracleTarget} on expiry.
                                    </p>
                                </div>
                            ) : (
                                <div className="pt-2 animate-in slide-in-from-top-2 fade-in duration-200">
                                    <label className="text-xs font-medium mb-1 block text-muted-foreground">Resolver Address (Optional)</label>
                                    <input
                                        type="text"
                                        value={resolverAddress}
                                        onChange={(e) => setResolverAddress(e.target.value)}
                                        placeholder="0x... (Leave empty for Admin)"
                                        className="w-full px-3 py-1.5 rounded-md border border-border bg-background text-sm outline-none focus:border-primary"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Address authorized to resolve this market.
                                    </p>
                                </div>
                            )}
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
