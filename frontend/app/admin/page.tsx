"use client"

import { useState, useEffect } from "react"
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { SESSION_ESCROW_ADDRESS, SESSION_ESCROW_ABI } from "@/lib/contracts"
import { parseUnits, type Address } from "viem"
import { Loader2, ShieldAlert, Settings, Save } from "lucide-react"
import { polygonAmoy } from "viem/chains"

export default function AdminPage() {
    const { address, isConnected } = useAccount()
    const [rateInput, setRateInput] = useState("")
    const [signerInput, setSignerInput] = useState("")
    const [isSignerActive, setIsSignerActive] = useState(true)

    // Read current settings
    const { data: currentRate } = useReadContract({
        address: SESSION_ESCROW_ADDRESS,
        abi: SESSION_ESCROW_ABI,
        functionName: "yieldRateBps",
        chainId: polygonAmoy.id
    })
    
    const { data: ownerAddress } = useReadContract({
        address: SESSION_ESCROW_ADDRESS,
        abi: SESSION_ESCROW_ABI,
        functionName: "owner",
        chainId: polygonAmoy.id
    })

    // Write: Set Yield Rate
    const { writeContract: writeSetRate, data: setRateHash, isPending: isSettingRate } = useWriteContract()
    const { isLoading: isWaitingRate, isSuccess: isRateSuccess } = useWaitForTransactionReceipt({ hash: setRateHash })

    // Write: Set Signer
    const { writeContract: writeSetSigner, data: setSignerHash, isPending: isSettingSigner } = useWriteContract()
    const { isLoading: isWaitingSigner, isSuccess: isSignerSuccess } = useWaitForTransactionReceipt({ hash: setSignerHash })

    const handleSetRate = () => {
        if (!rateInput) return
        writeSetRate({
            address: SESSION_ESCROW_ADDRESS,
            abi: SESSION_ESCROW_ABI,
            functionName: "setYieldRate",
            args: [BigInt(rateInput)]
        })
    }

    const handleSetSigner = () => {
        if (!signerInput) return
        writeSetSigner({
            address: SESSION_ESCROW_ADDRESS,
            abi: SESSION_ESCROW_ABI,
            functionName: "setNitroliteSigner",
            args: [signerInput as Address, isSignerActive]
        })
    }

    const isOwner = address && ownerAddress && address.toLowerCase() === (ownerAddress as string).toLowerCase()

    if (!isConnected) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <p>Please connect your wallet.</p>
            </div>
        )
    }

    return (
        <div className="min-h-screen pt-24 pb-12 px-4 max-w-4xl mx-auto space-y-8">
            <div className="flex items-center gap-4 border-b border-border pb-6">
                <div className="h-12 w-12 rounded-lg bg-red-500/20 text-red-500 flex items-center justify-center">
                    <ShieldAlert className="h-6 w-6" />
                </div>
                <div>
                    <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                    <p className="text-muted-foreground">Protocol Configuration & Management</p>
                </div>
            </div>

            {!isOwner && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-lg text-yellow-500">
                    ⚠️ You are not the contract owner. Write operations will likely fail.
                </div>
            )}

            {/* Yield Rate Configuration */}
            <div className="rounded-xl border border-border bg-card/60 glass p-6">
                <div className="flex items-center gap-2 mb-6">
                    <Settings className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-bold">Yield Rate Configuration</h2>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    <div>
                        <label className="block text-sm font-medium text-muted-foreground mb-2">
                           Current APY
                        </label>
                        <div className="text-2xl font-mono font-bold">
                            {currentRate ? (Number(currentRate) / 100).toFixed(2) : "Loading..."}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Base Points: {currentRate?.toString()} bps
                        </p>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                New Rate (Basis Points)
                            </label>
                            <input 
                                type="number" 
                                className="w-full bg-background border border-border rounded-lg px-4 py-2"
                                placeholder="e.g. 500 for 5%"
                                value={rateInput}
                                onChange={(e) => setRateInput(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground mt-1">100 bps = 1%</p>
                        </div>
                        <button 
                            onClick={handleSetRate}
                            disabled={isSettingRate || isWaitingRate}
                            className="w-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                        >
                            {(isSettingRate || isWaitingRate) ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                            Update Yield Rate
                        </button>
                        {isRateSuccess && <p className="text-green-500 text-sm text-center">Rate updated successfully!</p>}
                    </div>
                </div>
            </div>

            {/* Signer Configuration */}
            <div className="rounded-xl border border-border bg-card/60 glass p-6">
                 <div className="flex items-center gap-2 mb-6">
                    <ShieldAlert className="h-5 w-5 text-primary" />
                    <h2 className="text-xl font-bold">Backend Signer Config</h2>
                </div>
                
                <div className="space-y-4">
                     <div>
                        <label className="block text-sm font-medium mb-2">
                            Signer Address (Backend Wallet)
                        </label>
                        <input 
                            type="text" 
                            className="w-full bg-background border border-border rounded-lg px-4 py-2 font-mono text-sm"
                            placeholder="0x..."
                            value={signerInput}
                            onChange={(e) => setSignerInput(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox"
                            checked={isSignerActive}
                            onChange={(e) => setIsSignerActive(e.target.checked)}
                            className="rounded border-border"
                        />
                        <label className="text-sm">Authorize as Signer</label>
                    </div>
                     <button 
                        onClick={handleSetSigner}
                        disabled={isSettingSigner || isWaitingSigner}
                        className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-lg font-medium flex items-center justify-center gap-2"
                    >
                         {(isSettingSigner || isWaitingSigner) ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="h-4 w-4" />}
                        Update Signer
                    </button>
                    {isSignerSuccess && <p className="text-green-500 text-sm text-center">Signer updated successfully!</p>}
                </div>
            </div>
        </div>
    )
}
