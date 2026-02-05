"use client"

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi"
import { SESSION_ESCROW_ADDRESS, SESSION_ESCROW_ABI, POLYGON_USDC_ADDRESS, ERC20_ABI } from "@/lib/contracts"
import { formatUnits, parseUnits } from "viem"
import { useState, useEffect } from "react"

export function useSessionEscrow() {
    const { address, isConnected } = useAccount()
    const [balance, setBalance] = useState("0")

    // Read Balance (Polygon Amoy = chainId 80002)
    const { data: balanceData, refetch: refetchBalance } = useReadContract({
        address: SESSION_ESCROW_ADDRESS,
        abi: SESSION_ESCROW_ABI,
        functionName: "balances",
        args: [address!],
        chainId: 80002,
        query: { enabled: !!address }
    })

    // Read Allowance (Polygon Amoy = chainId 80002)
    const { data: allowanceData, refetch: refetchAllowance } = useReadContract({
        address: POLYGON_USDC_ADDRESS,
        abi: ERC20_ABI,
        functionName: "allowance",
        args: [address!, SESSION_ESCROW_ADDRESS],
        chainId: 80002,
        query: { enabled: !!address }
    })

    useEffect(() => {
        if (balanceData) {
            // balanceData is [totalDeposited, lockedInSession, pendingWithdrawal]
            // We care about totalDeposited - pendingWithdrawal (available)? 
            // Or just totalDeposited. Let's use totalDeposited for now.
            // @ts-ignore
            setBalance(formatUnits(balanceData[0], 6)) // USDC has 6 decimals on Polygon
        }
    }, [balanceData])

    // Write: Approve
    const { writeContract: writeApprove, data: approveHash, isPending: isApproving } = useWriteContract()
    const { isLoading: isWaitingApprove, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({ hash: approveHash })

    // Write: Deposit
    const { writeContract: writeDeposit, data: depositHash, isPending: isDepositing } = useWriteContract()
    const { isLoading: isWaitingDeposit, isSuccess: isDepositSuccess } = useWaitForTransactionReceipt({ hash: depositHash })

    const deposit = async (amount: string) => {
        const amountBig = parseUnits(amount, 6)
        
        // Check allowance
        // @ts-ignore
        if (!allowanceData || allowanceData < amountBig) {
             writeApprove({
                 address: POLYGON_USDC_ADDRESS,
                 abi: ERC20_ABI,
                 functionName: "approve",
                 args: [SESSION_ESCROW_ADDRESS, amountBig]
             })
             // In a real app we'd wait for approve then deposit. handling this loosely for now.
             return "approving"
        }

        writeDeposit({
            address: SESSION_ESCROW_ADDRESS,
            abi: SESSION_ESCROW_ABI,
            functionName: "deposit",
            args: [amountBig]
        })
        return "depositing"
    }

    return {
        balance,
        available: balance, // simplified
        deposit,
        isApproving: isApproving || isWaitingApprove,
        isDepositing: isDepositing || isWaitingDeposit,
        isSuccess: isDepositSuccess,
        refetch: refetchBalance
    }
}
