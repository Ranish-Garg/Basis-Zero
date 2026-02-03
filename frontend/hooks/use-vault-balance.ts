import { useState, useEffect, useCallback } from "react"
import { useWallet } from "./use-wallet"
import { formatUnits } from "ethers"

interface VaultBalance {
    principal: string
    totalBalance: string
    availableYield: string
    isLoading: boolean
    error: string | null
    refetch: () => Promise<void>
}

export function useVaultBalance(): VaultBalance {
    const { address, isConnected } = useWallet()
    const [data, setData] = useState({
        principal: "0.00",
        totalBalance: "0.00",
        availableYield: "0.00"
    })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchBalance = useCallback(async () => {
        if (!address || !isConnected) {
            setData({
                principal: "0.00",
                totalBalance: "0.00",
                availableYield: "0.00"
            })
            return
        }

        setIsLoading(true)
        setError(null)

        try {
            const response = await fetch(`http://localhost:3001/api/cctp/vault/balance/${address}`)

            if (!response.ok) {
                throw new Error("Failed to fetch vault balance")
            }

            const result = await response.json()

            // Result comes as strings (BigInt representations)
            // Need to format them (assuming 6 decimals for USDC)
            setData({
                principal: formatUnits(result.principal || "0", 6),
                totalBalance: formatUnits(result.totalBalance || "0", 6),
                availableYield: formatUnits(result.availableYield || "0", 6)
            })
        } catch (err: any) {
            console.error("Error fetching vault balance:", err)
            setError(err.message || "Failed to fetch balance")
        } finally {
            setIsLoading(false)
        }
    }, [address, isConnected])

    useEffect(() => {
        fetchBalance()
    }, [fetchBalance])

    return {
        ...data,
        isLoading,
        error,
        refetch: fetchBalance
    }
}
