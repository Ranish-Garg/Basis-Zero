"use client"

import { useState, useEffect, useCallback } from "react"
import { useAccount, useWalletClient } from "wagmi"
import { type Address } from "viem"
import { yellowClientManager } from "@/lib/yellow-client"

// Types matching backend
export interface SessionConfig {
    sessionId: string
    appSessionId: string
    user: string
    collateral: string
    rwaRateBps: number
    safeModeEnabled: boolean
    createdAt: number
    status: 'pending' | 'active' | 'closing' | 'closed'
}

export interface Bet {
    id: string
    marketId: string
    side: 'YES' | 'NO'
    amount: string
    shares: string
    timestamp: number
    resolved: boolean
    won?: boolean
}

export interface StreamingBalance {
    principal: string
    yield: string
    openBets: string
    available: string
}

const BACKEND_URL = `${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001"}/api/session`

export function useYellowSession() {
    const { address } = useAccount()
    const { data: walletClient } = useWalletClient()
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [session, setSession] = useState<SessionConfig | null>(null)
    const [bets, setBets] = useState<Bet[]>([])
    const [balance, setBalance] = useState<StreamingBalance | null>(null)
    const [isLoading, setIsLoading] = useState(false)

    // Load session ID from local storage on mount
    useEffect(() => {
        const stored = localStorage.getItem("basis-zero-session-id")
        if (stored) setSessionId(stored)
    }, [])

    const fetchSession = useCallback(async () => {
        if (!sessionId) return
        try {
            const res = await fetch(`${BACKEND_URL}/${sessionId}`)
            if (res.ok) {
                const data = await res.json()
                setSession(data.session)
                setBets(data.bets)
            } else {
                // If 404, maybe session is gone or invalid
                console.warn("Session not found")
            }
        } catch (e) {
            console.error("Failed to fetch session", e)
        }
    }, [sessionId])

    const fetchBalance = useCallback(async () => {
        if (!sessionId || !session) return
        try {
            const res = await fetch(`${BACKEND_URL}/${sessionId}/balance?safeMode=${session.safeModeEnabled}`)
            if (res.ok) {
                const data = await res.json()
                setBalance(data)
            }
        } catch (e) {
            console.error("Failed to fetch balance", e)
        }
    }, [sessionId, session])

    // Polling
    useEffect(() => {
        if (sessionId) {
            fetchSession()
            const interval = setInterval(() => {
                fetchSession()
                fetchBalance()
            }, 3000)
            return () => clearInterval(interval)
        }
    }, [sessionId, fetchSession, fetchBalance])

    const openSession = async (collateral: string, safeMode: boolean) => {
        if (!address) return
        setIsLoading(true)
        try {
            const res = await fetch(`${BACKEND_URL}/open`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userAddress: address,
                    collateral: collateral, // Already parsed units string? Backend expects string
                    safeModeEnabled: safeMode,
                    rwaRateBps: 520, // 5.2%
                    // Init Session Key (if wallet available)
                    ...(walletClient && await (async () => {
                        const { address: sessionKey, signature } = await yellowClientManager.createSession(walletClient);
                        return { sessionKey, authorization: signature };
                    })())
                })
            })
            const data = await res.json()
            if (data.success && data.session) {
                setSessionId(data.session.sessionId)
                setSession(data.session)
                localStorage.setItem("basis-zero-session-id", data.session.sessionId)
            }
            return data
        } catch (e) {
            console.error("Open session failed", e)
            throw e
        } finally {
            setIsLoading(false)
        }
    }

    const closeSession = async () => {
        if (!sessionId) return
        setIsLoading(true)
        try {
            const res = await fetch(`${BACKEND_URL}/close`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sessionId })
            })
            const data = await res.json()
            if (data.success) {
                // Clear local state
                setSessionId(null)
                setSession(null)
                localStorage.removeItem("basis-zero-session-id")
            }
            return data
        } catch (e) {
            console.error("Close session failed", e)
            throw e
        } finally {
            setIsLoading(false)
        }
    }

    return {
        session,
        bets,
        balance,
        isLoading,
        openSession,
        closeSession,
        refresh: fetchSession,
        sessionId
    }
}
