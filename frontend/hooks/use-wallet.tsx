'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'
import { BrowserProvider, Eip1193Provider } from 'ethers'

// Extend Window interface for ethereum
declare global {
    interface Window {
        ethereum?: Eip1193Provider & {
            on?: (event: string, handler: (...args: unknown[]) => void) => void
            removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
            isMetaMask?: boolean
        }
    }
}

interface WalletContextType {
    address: string | null
    isConnected: boolean
    isConnecting: boolean
    chainId: number | null
    error: string | null
    provider: BrowserProvider | null
    connect: () => Promise<void>
    disconnect: () => Promise<void>
    formatAddress: (address: string) => string
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

interface WalletProviderProps {
    children: ReactNode
}

export function WalletProvider({ children }: WalletProviderProps) {
    const [address, setAddress] = useState<string | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const [chainId, setChainId] = useState<number | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [provider, setProvider] = useState<BrowserProvider | null>(null)

    const isConnected = !!address

    // Format address for display (e.g., 0x1234...5678)
    const formatAddress = useCallback((addr: string): string => {
        if (!addr) return ''
        return `${addr.slice(0, 6)}...${addr.slice(-4)}`
    }, [])

    // Connect wallet function
    const connect = useCallback(async () => {
        if (!window.ethereum) {
            setError('Please install MetaMask or another Web3 wallet')
            return
        }

        setIsConnecting(true)
        setError(null)

        try {
            const browserProvider = new BrowserProvider(window.ethereum)

            // Request account access
            const accounts = await browserProvider.send('eth_requestAccounts', [])

            if (accounts.length > 0) {
                setAddress(accounts[0])
                setProvider(browserProvider)

                // Get the network/chain ID
                const network = await browserProvider.getNetwork()
                setChainId(Number(network.chainId))

                // Store connection state in localStorage
                localStorage.setItem('walletConnected', 'true')
            }
        } catch (err) {
            console.error('Failed to connect wallet:', err)
            if (err instanceof Error) {
                if (err.message.includes('User rejected')) {
                    setError('Connection rejected by user')
                } else {
                    setError(err.message)
                }
            } else {
                setError('Failed to connect wallet')
            }
        } finally {
            setIsConnecting(false)
        }
    }, [])

    // Disconnect wallet function - uses wallet_revokePermissions for true disconnect
    const disconnect = useCallback(async () => {
        // Clear local state first
        setAddress(null)
        setChainId(null)
        setProvider(null)
        setError(null)
        localStorage.removeItem('walletConnected')

        // Attempt to revoke permissions (supported by MetaMask and some other wallets)
        if (window.ethereum) {
            try {
                await (window.ethereum as Eip1193Provider).request({
                    method: 'wallet_revokePermissions',
                    params: [{ eth_accounts: {} }]
                })
                console.log('Wallet permissions revoked successfully')
            } catch (err) {
                // wallet_revokePermissions may not be supported by all wallets
                // In that case, we've already cleared local state which is the best we can do
                console.log('wallet_revokePermissions not supported, local state cleared')
            }
        }
    }, [])

    // Handle account changes
    const handleAccountsChanged = useCallback((accounts: unknown) => {
        const accountsArray = accounts as string[]
        if (accountsArray.length === 0) {
            // User disconnected their wallet
            disconnect()
        } else {
            setAddress(accountsArray[0])
        }
    }, [disconnect])

    // Handle chain changes
    const handleChainChanged = useCallback((chainIdHex: unknown) => {
        // Chain changed, reload the page as recommended by MetaMask
        const newChainId = parseInt(chainIdHex as string, 16)
        setChainId(newChainId)
    }, [])

    // Auto-connect on mount if previously connected
    useEffect(() => {
        const wasConnected = localStorage.getItem('walletConnected')

        if (wasConnected === 'true' && window.ethereum) {
            // Attempt to reconnect silently
            const reconnect = async () => {
                try {
                    const browserProvider = new BrowserProvider(window.ethereum!)
                    const accounts = await browserProvider.send('eth_accounts', [])

                    if (accounts.length > 0) {
                        setAddress(accounts[0])
                        setProvider(browserProvider)

                        const network = await browserProvider.getNetwork()
                        setChainId(Number(network.chainId))
                    } else {
                        // No accounts available, clear the stored state
                        localStorage.removeItem('walletConnected')
                    }
                } catch (err) {
                    console.error('Failed to reconnect wallet:', err)
                    localStorage.removeItem('walletConnected')
                }
            }

            reconnect()
        }
    }, [])

    // Set up event listeners
    useEffect(() => {
        if (!window.ethereum?.on || !window.ethereum?.removeListener) return

        window.ethereum.on('accountsChanged', handleAccountsChanged)
        window.ethereum.on('chainChanged', handleChainChanged)

        return () => {
            window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged)
            window.ethereum?.removeListener?.('chainChanged', handleChainChanged)
        }
    }, [handleAccountsChanged, handleChainChanged])

    const value: WalletContextType = {
        address,
        isConnected,
        isConnecting,
        chainId,
        error,
        provider,
        connect,
        disconnect,
        formatAddress,
    }

    return (
        <WalletContext.Provider value={value}>
            {children}
        </WalletContext.Provider>
    )
}

export function useWallet(): WalletContextType {
    const context = useContext(WalletContext)
    if (context === undefined) {
        throw new Error('useWallet must be used within a WalletProvider')
    }
    return context
}
