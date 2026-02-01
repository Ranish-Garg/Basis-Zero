// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VelocityYieldVault
 * @author Basis-Zero Team
 * @notice Core vault that holds user USDC deposits and manages RWA yield generation
 * @dev Integrates with Circle Gateway for deposits and Yellow SDK for off-chain sessions
 * 
 * Architecture:
 * - This contract holds USDC and tracks yield-bearing RWA positions
 * - Yellow Network SDK handles off-chain betting sessions
 * - Authorized Yellow nodes can call settleSession() to apply PnL
 * - No on-chain session state needed (handled by Yellow's Nitrolite)
 */
contract VelocityYieldVault is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public constant SECONDS_PER_YEAR = 365 days;

    // ═══════════════════════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════════════════════
    
    /// @notice USDC token contract
    IERC20 public immutable USDC;
    
    /// @notice Current RWA yield rate in basis points (e.g., 520 = 5.2% APY)
    uint256 public rwaRateBps;
    
    /// @notice Circle Gateway contract address
    address public circleGateway;
    
    /// @notice Authorized Yellow Network nodes (can settle sessions)
    mapping(address => bool) public authorizedNodes;

    // ═══════════════════════════════════════════════════════════════════════════
    // USER STATE
    // ═══════════════════════════════════════════════════════════════════════════
    
    struct UserDeposit {
        uint256 principal;           // USDC deposited
        uint256 depositTimestamp;    // When first deposited
        uint256 lastYieldClaim;      // Last yield claim time
    }
    
    mapping(address => UserDeposit) public deposits;
    uint256 public totalDeposits;

    // ═══════════════════════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════════════════════
    
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount, uint256 yieldEarned);
    event SessionSettled(address indexed user, int256 pnl, address indexed settledBy);
    event YieldClaimed(address indexed user, uint256 amount);
    event RwaRateUpdated(uint256 oldRate, uint256 newRate);
    event NodeAuthorized(address indexed node, bool authorized);
    event CrossChainDeposit(address indexed user, uint32 sourceChain, uint256 amount);

    // ═══════════════════════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════════════════════
    
    error ZeroAmount();
    error InsufficientBalance();
    error UnauthorizedCaller();
    error InvalidAddress();

    // ═══════════════════════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════════════════════
    
    constructor(address _usdc, uint256 _initialRateBps) Ownable(msg.sender) {
        if (_usdc == address(0)) revert InvalidAddress();
        USDC = IERC20(_usdc);
        rwaRateBps = _initialRateBps;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════════════════════
    
    modifier onlyAuthorizedNode() {
        if (!authorizedNodes[msg.sender]) revert UnauthorizedCaller();
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
     * @param sourceChain The source chain ID
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
        
        if (amount == 0) revert ZeroAmount();
        if (amount > d.principal) revert InsufficientBalance();
        
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
     * @notice Get accrued yield for a user
     */
    function getAccruedYield(address user) external view returns (uint256) {
        return _calculateAccruedYield(user);
    }
    
    /**
     * @notice Get streaming balance (principal + yield)
     */
    function getStreamingBalance(address user) external view returns (uint256) {
        return deposits[user].principal + _calculateAccruedYield(user);
    }
    
    /**
     * @notice Get available balance for betting (Safe Mode = yield only)
     */
    function getAvailableForBetting(address user, bool safeMode) external view returns (uint256) {
        uint256 yield = _calculateAccruedYield(user);
        if (safeMode) {
            return yield;
        }
        return deposits[user].principal + yield;
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
    // YELLOW SDK SETTLEMENT (called by authorized nodes after session closes)
    // ═══════════════════════════════════════════════════════════════════════════
    
    /**
     * @notice Settle a Yellow Network session
     * @dev Called by authorized Yellow node after off-chain session ends
     * @param user The user whose session ended
     * @param pnl Profit/loss from session (positive = won, negative = lost)
     */
    function settleSession(address user, int256 pnl) external onlyAuthorizedNode nonReentrant {
        UserDeposit storage d = deposits[user];
        
        if (pnl >= 0) {
            // User won - add to principal
            uint256 profit = uint256(pnl);
            d.principal += profit;
            totalDeposits += profit;
        } else {
            // User lost - deduct from principal (capped at principal)
            uint256 loss = uint256(-pnl);
            if (loss > d.principal) {
                loss = d.principal;
            }
            d.principal -= loss;
            totalDeposits -= loss;
        }
        
        emit SessionSettled(user, pnl, msg.sender);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // ADMIN FUNCTIONS
    // ═══════════════════════════════════════════════════════════════════════════
    
    function setCircleGateway(address _gateway) external onlyOwner {
        if (_gateway == address(0)) revert InvalidAddress();
        circleGateway = _gateway;
    }
    
    function setNodeAuthorization(address node, bool authorized) external onlyOwner {
        authorizedNodes[node] = authorized;
        emit NodeAuthorized(node, authorized);
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
        uint256 totalBalance
    ) {
        UserDeposit storage d = deposits[user];
        uint256 yield = _calculateAccruedYield(user);
        return (d.principal, d.depositTimestamp, yield, d.principal + yield);
    }
}
