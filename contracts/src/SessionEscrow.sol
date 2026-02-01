// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title SessionEscrow
 * @author Basis-Zero Team
 * @notice Lightweight escrow contract on Yellow-supported chain (Polygon Amoy).
 *         Holds session allowance for Yellow Nitrolite off-chain betting sessions.
 * 
 * Architecture:
 * - Receives bridged USDC from Arc via Circle Gateway
 * - Holds escrow during Yellow Nitrolite session
 * - Settles final PnL with multi-sig verification
 * - Produces settlement proof for Arc reconciliation
 * 
 * Economic Rules:
 * - Payout capped at escrow amount (no unbounded liability)
 * - Protocol fee: 10% of winnings (configurable)
 * - Losses: deducted from escrow, remainder returned
 * - Wins: paid from escrow (within cap)
 * 
 * Session Flow:
 * 1. Backend bridges USDC from Arc → receiveEscrow()
 * 2. Yellow Nitrolite runs off-chain session
 * 3. Session ends → settleSession() with participant signatures
 * 4. Funds distributed, settlement proof emitted
 * 5. Settlement proof relayed back to ArcYieldVault
 */
contract SessionEscrow is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant SESSION_TIMEOUT = 24 hours;  // Longer timeout for Yellow sessions

    // ═══════════════════════════════════════════════════════════════════════════
    // ENUMS
    // ═══════════════════════════════════════════════════════════════════════════
    
    enum EscrowState {
        Empty,      // No escrow for this user
        Funded,     // Escrow received, session can start
        Active,     // Yellow session in progress
        Settled     // Session settled (terminal)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════
    
    /// @notice USDC token contract
    IERC20 public immutable USDC;
    
    /// @notice Protocol fee in basis points (e.g., 1000 = 10%)
    uint256 public protocolFeeBps;
    
    /// @notice Protocol fee recipient
    address public protocolTreasury;
    
    /// @notice Authorized relayers (can fund escrow and submit settlements)
    mapping(address => bool) public authorizedRelayers;
    
    /// @notice Trusted Yellow Nitrolite signers
    mapping(address => bool) public trustedNitroliteSigners;
    
    /// @notice Required signatures for settlement
    uint256 public requiredSignatures;

    // ═══════════════════════════════════════════════════════════════════════════
    // ESCROW STATE
    // ═══════════════════════════════════════════════════════════════════════════
    
    struct Escrow {
        EscrowState state;
        uint256 amount;           // USDC escrowed
        bytes32 sessionId;        // Matching Arc session ID
        uint256 fundedAt;         // When escrow was funded
        address user;             // User who owns this escrow
    }
    
    /// @notice Escrows by session ID
    mapping(bytes32 => Escrow) public escrows;
    
    /// @notice User's current active session ID
    mapping(address => bytes32) public userActiveSession;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event EscrowReceived(
        address indexed user, 
        bytes32 indexed sessionId, 
        uint256 amount
    );
    
    event SessionActivated(
        address indexed user, 
        bytes32 indexed sessionId
    );
    
    event SessionSettled(
        address indexed user,
        bytes32 indexed sessionId,
        int256 pnl,
        uint256 userPayout,
        uint256 protocolFee,
        bytes settlementProof
    );
    
    event EscrowTimedOut(
        address indexed user,
        bytes32 indexed sessionId,
        uint256 refundAmount
    );
    
    event RelayerAuthorized(address indexed relayer, bool authorized);
    event NitroliteSignerUpdated(address indexed signer, bool trusted);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════
    
    error ZeroAmount();
    error UnauthorizedCaller();
    error InvalidAddress();
    error InvalidEscrowState(EscrowState current, EscrowState expected);
    error SessionIdMismatch();
    error UserAlreadyHasActiveSession();
    error InvalidSettlementProof();
    error InsufficientSignatures();
    error SessionNotTimedOut();
    error PayoutExceedsEscrow();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════
    
    constructor(
        address _usdc,
        address _treasury,
        uint256 _protocolFeeBps,
        uint256 _requiredSignatures
    ) Ownable(msg.sender) {
        if (_usdc == address(0) || _treasury == address(0)) revert InvalidAddress();
        
        USDC = IERC20(_usdc);
        protocolTreasury = _treasury;
        protocolFeeBps = _protocolFeeBps;
        requiredSignatures = _requiredSignatures;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════
    
    modifier onlyAuthorizedRelayer() {
        if (!authorizedRelayers[msg.sender]) revert UnauthorizedCaller();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ESCROW LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Receive escrowed USDC from Arc (via Gateway bridge)
     * @dev Called by relayer after Gateway transfer completes
     * @param user The user this escrow belongs to
     * @param sessionId Unique session ID (must match Arc)
     * @param amount Amount of USDC escrowed
     */
    function receiveEscrow(
        address user,
        bytes32 sessionId,
        uint256 amount
    ) external onlyAuthorizedRelayer nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (user == address(0)) revert InvalidAddress();
        if (userActiveSession[user] != bytes32(0)) revert UserAlreadyHasActiveSession();
        
        // Transfer USDC from relayer (who received it from bridge)
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        
        // Create escrow
        escrows[sessionId] = Escrow({
            state: EscrowState.Funded,
            amount: amount,
            sessionId: sessionId,
            fundedAt: block.timestamp,
            user: user
        });
        
        userActiveSession[user] = sessionId;
        
        emit EscrowReceived(user, sessionId, amount);
    }
    
    /**
     * @notice Activate a session (Yellow Nitrolite channel opened)
     * @param sessionId Session to activate
     */
    function activateSession(bytes32 sessionId) external onlyAuthorizedRelayer {
        Escrow storage e = escrows[sessionId];
        
        if (e.state != EscrowState.Funded) {
            revert InvalidEscrowState(e.state, EscrowState.Funded);
        }
        
        e.state = EscrowState.Active;
        
        emit SessionActivated(e.user, sessionId);
    }
    
    /**
     * @notice Settle a session with verified Nitrolite signatures
     * @param sessionId Session to settle
     * @param pnl Final profit/loss (positive = user won, negative = user lost)
     * @param signatures Array of signatures from Nitrolite participants
     * @return settlementProof Encoded proof for Arc reconciliation
     */
    function settleSession(
        bytes32 sessionId,
        int256 pnl,
        bytes[] calldata signatures
    ) external onlyAuthorizedRelayer nonReentrant returns (bytes memory settlementProof) {
        Escrow storage e = escrows[sessionId];
        
        if (e.state != EscrowState.Active) {
            revert InvalidEscrowState(e.state, EscrowState.Active);
        }
        
        // Verify signatures
        _verifySettlement(sessionId, pnl, signatures);
        
        address user = e.user;
        uint256 escrowAmount = e.amount;
        uint256 userPayout = 0;
        uint256 protocolFee = 0;
        
        if (pnl >= 0) {
            // User won
            uint256 winnings = uint256(pnl);
            
            // Cap winnings at escrow (no unbounded liability)
            if (winnings > escrowAmount) {
                winnings = escrowAmount;
            }
            
            // Calculate protocol fee (on winnings only)
            protocolFee = (winnings * protocolFeeBps) / BPS_DENOMINATOR;
            
            // User gets escrow + winnings - fee
            userPayout = escrowAmount + winnings - protocolFee;
            
            // Note: In a real system, winnings would come from counterparty escrow
            // For hackathon simplicity, we cap at own escrow
            if (userPayout > escrowAmount) {
                userPayout = escrowAmount;
                protocolFee = 0;
            }
        } else {
            // User lost
            uint256 loss = uint256(-pnl);
            
            if (loss >= escrowAmount) {
                // Total loss - nothing returned
                userPayout = 0;
            } else {
                // Partial loss - return remainder
                userPayout = escrowAmount - loss;
            }
            
            // No protocol fee on losses
            protocolFee = 0;
        }
        
        // Mark settled
        e.state = EscrowState.Settled;
        userActiveSession[user] = bytes32(0);
        
        // Create settlement proof for Arc
        settlementProof = abi.encode(sessionId, pnl, signatures);
        
        // Distribute funds
        if (userPayout > 0) {
            USDC.safeTransfer(user, userPayout);
        }
        if (protocolFee > 0) {
            USDC.safeTransfer(protocolTreasury, protocolFee);
        }
        
        emit SessionSettled(user, sessionId, pnl, userPayout, protocolFee, settlementProof);
        
        return settlementProof;
    }
    
    /**
     * @notice Emergency timeout release if session gets stuck
     * @param sessionId Session to release
     */
    function timeoutRelease(bytes32 sessionId) external nonReentrant {
        Escrow storage e = escrows[sessionId];
        
        // Only Funded or Active sessions can timeout
        if (e.state != EscrowState.Funded && e.state != EscrowState.Active) {
            revert InvalidEscrowState(e.state, EscrowState.Active);
        }
        
        if (block.timestamp < e.fundedAt + SESSION_TIMEOUT) {
            revert SessionNotTimedOut();
        }
        
        address user = e.user;
        uint256 refund = e.amount;
        
        // Mark settled (via timeout)
        e.state = EscrowState.Settled;
        userActiveSession[user] = bytes32(0);
        
        // Refund full escrow to user
        USDC.safeTransfer(user, refund);
        
        emit EscrowTimedOut(user, sessionId, refund);
    }
    
    /**
     * @notice Verify Nitrolite settlement signatures
     */
    function _verifySettlement(
        bytes32 sessionId,
        int256 pnl,
        bytes[] calldata signatures
    ) internal view {
        if (signatures.length < requiredSignatures) {
            revert InsufficientSignatures();
        }
        
        // Create message hash
        bytes32 messageHash = keccak256(abi.encodePacked(sessionId, pnl));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        
        uint256 validSignatures = 0;
        address lastSigner = address(0);
        
        for (uint256 i = 0; i < signatures.length; i++) {
            address signer = ethSignedHash.recover(signatures[i]);
            
            // Signatures must be in ascending order (prevents duplicates)
            if (signer <= lastSigner) {
                revert InvalidSettlementProof();
            }
            
            if (trustedNitroliteSigners[signer]) {
                validSignatures++;
            }
            
            lastSigner = signer;
        }
        
        if (validSignatures < requiredSignatures) {
            revert InsufficientSignatures();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner {
        authorizedRelayers[relayer] = authorized;
        emit RelayerAuthorized(relayer, authorized);
    }
    
    function setNitroliteSigner(address signer, bool trusted) external onlyOwner {
        trustedNitroliteSigners[signer] = trusted;
        emit NitroliteSignerUpdated(signer, trusted);
    }
    
    function setRequiredSignatures(uint256 count) external onlyOwner {
        requiredSignatures = count;
    }
    
    function setProtocolFee(uint256 feeBps) external onlyOwner {
        protocolFeeBps = feeBps;
    }
    
    function setProtocolTreasury(address treasury) external onlyOwner {
        if (treasury == address(0)) revert InvalidAddress();
        protocolTreasury = treasury;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    function getEscrow(bytes32 sessionId) external view returns (
        EscrowState state,
        uint256 amount,
        address user,
        uint256 fundedAt,
        uint256 timeUntilTimeout
    ) {
        Escrow storage e = escrows[sessionId];
        uint256 timeout = 0;
        
        if (e.state == EscrowState.Funded || e.state == EscrowState.Active) {
            uint256 deadline = e.fundedAt + SESSION_TIMEOUT;
            timeout = block.timestamp < deadline ? deadline - block.timestamp : 0;
        }
        
        return (e.state, e.amount, e.user, e.fundedAt, timeout);
    }
    
    function getUserActiveEscrow(address user) external view returns (
        bytes32 sessionId,
        EscrowState state,
        uint256 amount
    ) {
        bytes32 sid = userActiveSession[user];
        if (sid == bytes32(0)) {
            return (bytes32(0), EscrowState.Empty, 0);
        }
        
        Escrow storage e = escrows[sid];
        return (sid, e.state, e.amount);
    }
}
