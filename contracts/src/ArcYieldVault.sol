// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title ArcYieldVault
 * @author Basis-Zero Team
 * @notice Core vault on Arc that holds user USDC deposits and manages RWA yield generation.
 *         Implements session state machine for Yellow Network integration.
 * 
 * Architecture:
 * - This contract holds USDC principal on Arc (Circle's L2)
 * - Tracks simulated RWA yield (e.g., T-Bills at 5.2% APY)
 * - Manages session lifecycle for Yellow Nitrolite escrow
 * - Verifies cryptographic settlement proofs before applying PnL
 * 
 * Session Flow:
 * 1. User deposits USDC → principal tracked
 * 2. Yield accrues over time
 * 3. User starts session → lockSessionAllowance() → yield locked
 * 4. Backend bridges yield to SessionEscrow on Yellow-supported chain
 * 5. Backend confirms bridge → confirmBridge() → session Active
 * 6. Yellow Nitrolite runs off-chain session
 * 7. Session settles → reconcileSession(proof) → PnL applied
 * 8. If bridge fails → timeout → unlockSessionAllowance()
 */
contract ArcYieldVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;
    uint256 public constant SESSION_TIMEOUT = 1 hours;

    // ═══════════════════════════════════════════════════════════════════════════
    // ENUMS
    // ═══════════════════════════════════════════════════════════════════════════
    
    enum SessionState {
        None,           // No active session
        PendingBridge,  // Yield locked, waiting for bridge confirmation
        Active,         // Bridge confirmed, Yellow session in progress
        Settled,        // Session settled (terminal, resets to None)
        Cancelled       // Session cancelled/timed out (terminal, resets to None)
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════
    
    /// @notice USDC token contract (native on Arc)
    IERC20 public immutable USDC;
    
    /// @notice Current RWA yield rate in basis points (e.g., 520 = 5.2% APY)
    uint256 public rwaRateBps;
    
    /// @notice Circle Gateway contract address
    address public circleGateway;
    
    /// @notice Authorized session relayers (can confirm bridges and relay settlements)
    mapping(address => bool) public authorizedRelayers;
    
    /// @notice Trusted settlement signers (Yellow Nitrolite participants)
    mapping(address => bool) public trustedSettlementSigners;
    
    /// @notice Minimum required signatures for settlement proof
    uint256 public requiredSettlementSignatures;

    // ═══════════════════════════════════════════════════════════════════════════
    // USER STATE
    // ═══════════════════════════════════════════════════════════════════════════
    
    struct UserDeposit {
        uint256 principal;           // USDC deposited (never leaves Arc)
        uint256 depositTimestamp;    // When first deposited
        uint256 lastYieldClaim;      // Last yield claim/checkpoint time
    }
    
    struct Session {
        SessionState state;
        uint256 lockedAmount;        // Yield locked for this session
        uint256 startedAt;           // When session was initiated
        bytes32 sessionId;           // Unique session identifier
    }
    
    mapping(address => UserDeposit) public deposits;
    mapping(address => Session) public sessions;
    mapping(bytes32 => bool) public usedSessionIds;  // Prevent replay
    
    uint256 public totalDeposits;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 yieldEarned);
    event YieldClaimed(address indexed user, uint256 amount);
    event RwaRateUpdated(uint256 oldRate, uint256 newRate);
    
    // Session events
    event SessionStarted(address indexed user, bytes32 indexed sessionId, uint256 lockedAmount);
    event SessionBridgeConfirmed(address indexed user, bytes32 indexed sessionId);
    event SessionSettled(address indexed user, bytes32 indexed sessionId, int256 pnl);
    event SessionCancelled(address indexed user, bytes32 indexed sessionId, string reason);
    
    // Admin events
    event RelayerAuthorized(address indexed relayer, bool authorized);
    event SettlementSignerUpdated(address indexed signer, bool trusted);
    event CrossChainDeposit(address indexed user, uint32 sourceChain, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════
    
    error ZeroAmount();
    error InsufficientBalance();
    error InsufficientYield();
    error UnauthorizedCaller();
    error InvalidAddress();
    error InvalidSessionState(SessionState current, SessionState expected);
    error SessionTimeout();
    error SessionNotTimedOut();
    error InvalidSettlementProof();
    error SessionIdAlreadyUsed();
    error InsufficientSignatures();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════
    
    constructor(
        address _usdc, 
        uint256 _initialRateBps,
        uint256 _requiredSignatures
    ) Ownable(msg.sender) {
        if (_usdc == address(0)) revert InvalidAddress();
        USDC = IERC20(_usdc);
        rwaRateBps = _initialRateBps;
        requiredSettlementSignatures = _requiredSignatures;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════
    
    modifier onlyAuthorizedRelayer() {
        if (!authorizedRelayers[msg.sender]) revert UnauthorizedCaller();
        _;
    }
    
    modifier onlyGateway() {
        if (msg.sender != circleGateway) revert UnauthorizedCaller();
        _;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // DEPOSIT FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Deposit USDC into the vault
     * @param amount Amount of USDC to deposit (6 decimals)
     */
    function deposit(uint256 amount) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        
        USDC.safeTransferFrom(msg.sender, address(this), amount);
        _processDeposit(msg.sender, amount);
    }
    
    /**
     * @notice Callback for Circle Gateway cross-chain deposits
     * @param user The user who initiated the deposit
     * @param amount Amount of USDC deposited
     * @param sourceChain The source chain domain ID
     */
    function onGatewayDeposit(
        address user,
        uint256 amount,
        uint32 sourceChain
    ) external onlyGateway nonReentrant {
        if (amount == 0) revert ZeroAmount();
        _processDeposit(user, amount);
        emit CrossChainDeposit(user, sourceChain, amount);
    }
    
    function _processDeposit(address user, uint256 amount) internal {
        UserDeposit storage d = deposits[user];
        
        // Checkpoint existing yield before adding new principal
        if (d.principal > 0) {
            // Yield continues accruing, just update checkpoint
        }
        
        if (d.principal == 0) {
            d.depositTimestamp = block.timestamp;
            d.lastYieldClaim = block.timestamp;
        }
        
        d.principal += amount;
        totalDeposits += amount;
        
        emit Deposited(user, amount);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // WITHDRAW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Withdraw USDC from the vault (principal + accrued yield)
     * @param amount Amount to withdraw
     */
    function withdraw(uint256 amount) external nonReentrant {
        UserDeposit storage d = deposits[msg.sender];
        Session storage s = sessions[msg.sender];
        
        if (amount == 0) revert ZeroAmount();
        if (amount > d.principal) revert InsufficientBalance();
        
        // Cannot withdraw during active session
        if (s.state == SessionState.PendingBridge || s.state == SessionState.Active) {
            revert InvalidSessionState(s.state, SessionState.None);
        }
        
        // Calculate proportional yield
        uint256 yield = _calculateAccruedYield(msg.sender);
        uint256 proportionalYield = (yield * amount) / d.principal;
        
        d.principal -= amount;
        totalDeposits -= amount;
        
        if (d.principal == 0) {
            d.lastYieldClaim = block.timestamp;
        }
        
        uint256 totalWithdraw = amount + proportionalYield;
        USDC.safeTransfer(msg.sender, totalWithdraw);
        
        emit Withdrawn(msg.sender, totalWithdraw, proportionalYield);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // YIELD FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Get accrued yield for a user (excludes locked session yield)
     */
    function getAccruedYield(address user) external view returns (uint256) {
        return _calculateAccruedYield(user);
    }
    
    /**
     * @notice Get available yield for session (total accrued - locked)
     */
    function getAvailableYieldForSession(address user) public view returns (uint256) {
        uint256 totalYield = _calculateAccruedYield(user);
        Session storage s = sessions[user];
        
        if (s.state == SessionState.PendingBridge || s.state == SessionState.Active) {
            // Some yield is already locked
            return totalYield > s.lockedAmount ? totalYield - s.lockedAmount : 0;
        }
        
        return totalYield;
    }
    
    /**
     * @notice Get streaming balance (principal + yield - locked)
     */
    function getStreamingBalance(address user) external view returns (uint256) {
        Session storage s = sessions[user];
        uint256 yield = _calculateAccruedYield(user);
        uint256 locked = (s.state == SessionState.PendingBridge || s.state == SessionState.Active) 
            ? s.lockedAmount 
            : 0;
        
        return deposits[user].principal + yield - locked;
    }
    
    /**
     * @notice Get yield rate per second (for frontend ticking display)
     */
    function getYieldPerSecond(uint256 principal) external view returns (uint256) {
        return (principal * rwaRateBps) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
    }
    
    function _calculateAccruedYield(address user) internal view returns (uint256) {
        UserDeposit storage d = deposits[user];
        if (d.principal == 0) return 0;
        
        uint256 elapsed = block.timestamp - d.lastYieldClaim;
        return (d.principal * rwaRateBps * elapsed) / (SECONDS_PER_YEAR * BPS_DENOMINATOR);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // SESSION LIFECYCLE (Core Innovation)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Lock yield for a Yellow session
     * @dev Transitions: None → PendingBridge
     * @param amount Amount of yield to lock (must be ≤ available yield)
     * @param sessionId Unique session identifier (prevents replay)
     */
    function lockSessionAllowance(
        uint256 amount, 
        bytes32 sessionId
    ) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (usedSessionIds[sessionId]) revert SessionIdAlreadyUsed();
        
        Session storage s = sessions[msg.sender];
        if (s.state != SessionState.None) {
            revert InvalidSessionState(s.state, SessionState.None);
        }
        
        uint256 availableYield = _calculateAccruedYield(msg.sender);
        if (amount > availableYield) revert InsufficientYield();
        
        // Lock yield (accounting only - no transfer)
        s.state = SessionState.PendingBridge;
        s.lockedAmount = amount;
        s.startedAt = block.timestamp;
        s.sessionId = sessionId;
        usedSessionIds[sessionId] = true;
        
        emit SessionStarted(msg.sender, sessionId, amount);
    }
    
    /**
     * @notice Confirm that bridge to Yellow chain succeeded
     * @dev Transitions: PendingBridge → Active
     * @dev Called by authorized relayer after Gateway transfer completes
     * @param user The user whose session to confirm
     */
    function confirmBridge(address user) external onlyAuthorizedRelayer {
        Session storage s = sessions[user];
        
        if (s.state != SessionState.PendingBridge) {
            revert InvalidSessionState(s.state, SessionState.PendingBridge);
        }
        
        s.state = SessionState.Active;
        
        emit SessionBridgeConfirmed(user, s.sessionId);
    }
    
    /**
     * @notice Cancel a session that is stuck in PendingBridge (timeout)
     * @dev Transitions: PendingBridge → Cancelled → None
     * @dev Anyone can call after timeout period
     * @param user The user whose session to cancel
     */
    function cancelTimedOutSession(address user) external nonReentrant {
        Session storage s = sessions[user];
        
        if (s.state != SessionState.PendingBridge) {
            revert InvalidSessionState(s.state, SessionState.PendingBridge);
        }
        
        if (block.timestamp < s.startedAt + SESSION_TIMEOUT) {
            revert SessionNotTimedOut();
        }
        
        bytes32 sessionId = s.sessionId;
        
        // Reset session (yield unlocked by virtue of state reset)
        s.state = SessionState.None;
        s.lockedAmount = 0;
        s.startedAt = 0;
        s.sessionId = bytes32(0);
        
        emit SessionCancelled(user, sessionId, "Bridge timeout");
    }
    
    /**
     * @notice Reconcile session with verified settlement proof
     * @dev Transitions: Active → Settled → None
     * @param user The user whose session to settle
     * @param pnl Profit/loss from session (positive = won, negative = lost)
     * @param settlementProof Encoded Nitrolite settlement with signatures
     * 
     * Proof format: abi.encode(sessionId, finalPnl, signatures[])
     * Where each signature is from a trusted settlement signer
     */
    function reconcileSession(
        address user,
        int256 pnl,
        bytes calldata settlementProof
    ) external onlyAuthorizedRelayer nonReentrant {
        Session storage s = sessions[user];
        UserDeposit storage d = deposits[user];
        
        if (s.state != SessionState.Active) {
            revert InvalidSessionState(s.state, SessionState.Active);
        }
        
        // Verify settlement proof
        _verifySettlementProof(s.sessionId, pnl, settlementProof);
        
        bytes32 sessionId = s.sessionId;
        uint256 lockedAmount = s.lockedAmount;
        
        // Apply PnL
        if (pnl >= 0) {
            // User won - add to principal (yield + winnings become principal)
            uint256 profit = uint256(pnl);
            // Returned escrow + profit goes back to user
            // In real flow: SessionEscrow sends back funds, we credit here
            d.principal += profit;
            totalDeposits += profit;
        } else {
            // User lost - loss is capped at locked amount
            uint256 loss = uint256(-pnl);
            if (loss > lockedAmount) {
                loss = lockedAmount;
            }
            // Loss is absorbed (locked yield doesn't return)
            // Principal remains untouched (Safe Mode guarantee)
        }
        
        // Checkpoint yield claim time (locked yield was used/lost)
        d.lastYieldClaim = block.timestamp;
        
        // Reset session
        s.state = SessionState.None;
        s.lockedAmount = 0;
        s.startedAt = 0;
        s.sessionId = bytes32(0);
        
        emit SessionSettled(user, sessionId, pnl);
    }
    
    /**
     * @notice Verify Nitrolite settlement proof
     * @dev Checks that enough trusted signers have signed the settlement
     */
    function _verifySettlementProof(
        bytes32 sessionId,
        int256 pnl,
        bytes calldata settlementProof
    ) internal view {
        // Decode proof: (bytes32 claimedSessionId, int256 claimedPnl, bytes[] signatures)
        (bytes32 claimedSessionId, int256 claimedPnl, bytes[] memory signatures) = 
            abi.decode(settlementProof, (bytes32, int256, bytes[]));
        
        // Verify claimed values match
        if (claimedSessionId != sessionId || claimedPnl != pnl) {
            revert InvalidSettlementProof();
        }
        
        // Verify enough signatures from trusted signers
        if (signatures.length < requiredSettlementSignatures) {
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
            
            if (trustedSettlementSigners[signer]) {
                validSignatures++;
            }
            
            lastSigner = signer;
        }
        
        if (validSignatures < requiredSettlementSignatures) {
            revert InsufficientSignatures();
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    function setCircleGateway(address _gateway) external onlyOwner {
        if (_gateway == address(0)) revert InvalidAddress();
        circleGateway = _gateway;
    }
    
    function setRelayerAuthorization(address relayer, bool authorized) external onlyOwner {
        authorizedRelayers[relayer] = authorized;
        emit RelayerAuthorized(relayer, authorized);
    }
    
    function setSettlementSigner(address signer, bool trusted) external onlyOwner {
        trustedSettlementSigners[signer] = trusted;
        emit SettlementSignerUpdated(signer, trusted);
    }
    
    function setRequiredSignatures(uint256 count) external onlyOwner {
        requiredSettlementSignatures = count;
    }
    
    function setRwaRate(uint256 newRateBps) external onlyOwner {
        uint256 oldRate = rwaRateBps;
        rwaRateBps = newRateBps;
        emit RwaRateUpdated(oldRate, newRateBps);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // VIEW FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    function getUserDeposit(address user) external view returns (
        uint256 principal,
        uint256 depositTimestamp,
        uint256 accruedYield,
        uint256 availableYield,
        uint256 totalBalance
    ) {
        UserDeposit storage d = deposits[user];
        uint256 yield = _calculateAccruedYield(user);
        uint256 available = getAvailableYieldForSession(user);
        
        return (
            d.principal, 
            d.depositTimestamp, 
            yield, 
            available,
            d.principal + yield
        );
    }
    
    function getSession(address user) external view returns (
        SessionState state,
        uint256 lockedAmount,
        uint256 startedAt,
        bytes32 sessionId,
        uint256 timeUntilTimeout
    ) {
        Session storage s = sessions[user];
        uint256 timeout = 0;
        
        if (s.state == SessionState.PendingBridge) {
            uint256 deadline = s.startedAt + SESSION_TIMEOUT;
            timeout = block.timestamp < deadline ? deadline - block.timestamp : 0;
        }
        
        return (s.state, s.lockedAmount, s.startedAt, s.sessionId, timeout);
    }
}
