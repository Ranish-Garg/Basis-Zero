import { Router } from 'express';
import { type Address, isAddress } from 'viem';
import { CctpService } from './cctp-service';
import { CCTP_CONTRACTS } from './config';

type CctpChain = keyof typeof CCTP_CONTRACTS;

/**
 * Validator for bridge request
 */
interface BridgeRequest {
    sourceChain: string;
    destChain: string;
    amount: string; // BigInt as string
    recipient: string;
}

function isValidCctpChain(chain: string): chain is CctpChain {
    return chain in CCTP_CONTRACTS;
}

export function createCctpRouter(cctpService: CctpService): Router {
    const router = Router();

    router.get('/address', (req, res) => {
        try {
            // Expose backend wallet address so frontend can mint to it
            const address = cctpService.getAccountAddress();
            res.json({ address });
        } catch (error: any) {
            console.error('[Address Route Error]', error);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/deposit', async (req, res) => {
        try {
            const { txHash, sourceChain, userAddress } = req.body;

            if (!txHash || !sourceChain || !userAddress) {
                return res.status(400).json({ error: 'Missing txHash, sourceChain, or userAddress' });
            }

            const availableChains = [...Object.keys(CCTP_CONTRACTS)];
            // We allow 'arcTestnet' if logic requires, but relay flow is usually cross-chain
            if (!availableChains.includes(sourceChain)) {
                return res.status(400).json({
                    error: `Invalid bridge source chain. Available: ${availableChains.join(', ')}`
                });
            }

            // Call finalize (Relayer Flow)
            const result = await cctpService.finalizeSmartDeposit(
                txHash,
                sourceChain,
                userAddress
            );

            res.json({ success: true, ...result });
        } catch (error: any) {
            console.error('[Deposit Route Error]', error);
            res.status(500).json({
                error: error.message || 'Internal server error'
            });
        }
    });

    router.get('/vault/balance/:user', async (req, res) => {
        try {
            const userAddress = req.params.user as `0x${string}`;
            const balance = await cctpService.getVaultBalance(userAddress);
            res.json(balance);
        } catch (error: any) {
            // Log but don't crash if user has no balance (might return 0s normally)
            console.error('[Vault Balance Error]', error.message);
            res.status(500).json({ error: error.message });
        }
    });

    router.post('/bridge', async (req, res) => {
        try {
            const { sourceChain, destChain, amount, recipient } = req.body as BridgeRequest;

            // Validate inputs
            if (!sourceChain || !destChain || !amount || !recipient) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            if (!isValidCctpChain(sourceChain)) {
                return res.status(400).json({
                    error: `Invalid source chain. Available: ${Object.keys(CCTP_CONTRACTS).join(', ')}`
                });
            }

            if (!isValidCctpChain(destChain)) {
                return res.status(400).json({
                    error: `Invalid destination chain. Available: ${Object.keys(CCTP_CONTRACTS).join(', ')}`
                });
            }

            if (!isAddress(recipient)) {
                return res.status(400).json({ error: 'Invalid recipient address' });
            }

            const amountBigInt = BigInt(amount);
            if (amountBigInt <= 0n) {
                return res.status(400).json({ error: 'Amount must be positive' });
            }

            // Execute bridge
            const result = await cctpService.bridgeUSDC(
                sourceChain,
                destChain,
                amountBigInt,
                recipient as Address
            );

            // Convert BigInt to string for JSON serialization
            const response = {
                success: true,
                burnTx: result.burnTx,
                message: result.message,
                attestation: result.attestation,
                mintTx: result.mintTx,
            };

            res.json(response);

        } catch (error: any) {
            console.error('[CCTP Route Error]', error);
            res.status(500).json({
                error: error.message || 'Internal server error',
                details: error.toString()
            });
        }
    });

    return router;
}
