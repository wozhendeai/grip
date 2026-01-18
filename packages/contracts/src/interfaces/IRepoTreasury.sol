// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRepoTreasury
 * @notice Per-repo treasury that manages POL (flip orders), revenue splits, LP incentives, and bounty funding.
 *         POL is locked forever - no function to withdraw order capital.
 */
interface IRepoTreasury {
    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /**
     * @notice Maintainer share of spread revenue (30%)
     */
    function MAINTAINER_SHARE() external view returns (uint256);

    /**
     * @notice Buyback share - adds more flip orders (30%)
     */
    function BUYBACK_SHARE() external view returns (uint256);

    /**
     * @notice Bounty pool share (40%)
     */
    function BOUNTY_SHARE() external view returns (uint256);

    /**
     * @notice Basis points denominator (10000 = 100%)
     */
    function BASIS_POINTS() external view returns (uint256);

    // =========================================================================
    // STRUCTS
    // =========================================================================

    struct FlipOrderInfo {
        uint128 orderId;
        address token; // Base token (the repo token)
        uint128 amount;
        bool isBid;
        int16 tick;
        int16 flipTick;
        bool active;
    }

    struct TreasuryState {
        address repoToken;
        address quoteToken; // PathUSD
        bytes32 repoHash;
        uint256 maintainerPool;
        uint256 bountyPool;
        uint256 totalRevenue;
        uint256 polValue; // Estimated value of standing orders
    }

    // =========================================================================
    // EVENTS
    // =========================================================================

    event FlipOrderPlaced(uint128 indexed orderId, uint128 amount, bool isBid, int16 tick, int16 flipTick);

    event FlipOrderCancelled(uint128 indexed orderId);

    event RevenueHarvested(uint256 amount);

    event SplitExecuted(uint256 maintainerAmount, uint256 buybackAmount, uint256 bountyAmount);

    event MaintainerWithdrawal(address indexed maintainer, address indexed recipient, uint256 amount);

    event BountyFunded(bytes32 indexed bountyId, uint256 amount);

    event BountyPaid(address indexed contributor, uint256 pathUsdAmount, uint256 tokenAmount, bytes32 indexed memo);

    event LpRewardsEmitted(uint256 amount);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error Unauthorized();
    error InvalidAmount();
    error InsufficientBalance();
    error InvalidTick();
    error InvalidSignature();
    error SignatureExpired();
    error OrderNotFound();
    error TransferFailed();

    // =========================================================================
    // VIEWS
    // =========================================================================

    /**
     * @notice Get the treasury state
     * @return state The current treasury state
     */
    function getTreasuryState() external view returns (TreasuryState memory state);

    /**
     * @notice Get estimated value of all standing flip orders
     * @return value The estimated POL value in quote token
     */
    function getOrderValue() external view returns (uint256 value);

    /**
     * @notice Get info for a specific flip order
     * @param orderId The order ID
     * @return info The order info
     */
    function getFlipOrder(uint128 orderId) external view returns (FlipOrderInfo memory info);

    /**
     * @notice Get all active flip order IDs
     * @return orderIds Array of active order IDs
     */
    function getActiveOrders() external view returns (uint128[] memory orderIds);

    // =========================================================================
    // POL MANAGEMENT (Flip Orders on DEX)
    // =========================================================================

    /**
     * @notice Place a flip order on the Stablecoin DEX
     * @dev Only callable by authorized backend
     * @param amount The amount of tokens/quote to place
     * @param tick The price tick for the order
     * @param flipTick The tick to flip to when filled
     * @param isBid True for buy order, false for sell order
     * @return orderId The ID of the placed order
     */
    function placeFlipOrder(uint128 amount, int16 tick, int16 flipTick, bool isBid) external returns (uint128 orderId);

    /**
     * @notice Cancel an existing flip order
     * @dev Only callable by authorized backend. Refunds go to internal DEX balance.
     * @param orderId The order ID to cancel
     */
    function cancelOrder(uint128 orderId) external;

    // =========================================================================
    // REVENUE DISTRIBUTION
    // =========================================================================

    /**
     * @notice Harvest revenue from filled flip orders
     * @dev Calculates profit from order fills since last harvest
     * @return harvested The amount of revenue harvested
     */
    function harvestRevenue() external returns (uint256 harvested);

    /**
     * @notice Execute the 30/30/40 split on accumulated revenue
     * @dev Allocates to maintainer pool, buyback, and bounty pool
     */
    function executeSplit() external;

    // =========================================================================
    // MAINTAINER FUNCTIONS
    // =========================================================================

    /**
     * @notice Withdraw maintainer fees (requires signature from MaintainerClaims)
     * @param to The recipient address
     * @param amount The amount to withdraw
     * @param expiry Signature expiry timestamp
     * @param signature Backend signature authorizing the withdrawal
     */
    function withdrawMaintainerFees(address to, uint256 amount, uint64 expiry, bytes calldata signature) external;

    // =========================================================================
    // BOUNTY FUNCTIONS
    // =========================================================================

    /**
     * @notice Fund a bounty from the bounty pool
     * @dev Only callable by authorized backend
     * @param bountyId The bounty identifier
     * @param amount The amount of PathUSD to allocate
     */
    function fundBounty(bytes32 bountyId, uint256 amount) external;

    /**
     * @notice Pay out a bounty to a contributor
     * @dev Only callable by authorized backend
     * @param contributor The contributor's address
     * @param pathUsdAmount The PathUSD amount to pay
     * @param tokenAmount The repo token amount to pay (bonus)
     * @param memo On-chain memo for the payment
     */
    function payBounty(address contributor, uint256 pathUsdAmount, uint256 tokenAmount, bytes32 memo) external;

    // =========================================================================
    // LP INCENTIVES
    // =========================================================================

    /**
     * @notice Emit LP rewards to token holders
     * @dev Uses TIP-20 Rewards distribution
     * @param amount The amount of repo tokens to distribute
     */
    function emitRewards(uint256 amount) external;

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /**
     * @notice Initialize the treasury (called once by launcher)
     * @param repoHash The repo identifier
     * @param repoToken The repo's TIP-20 token address
     * @param quoteToken The quote token address (PathUSD)
     * @param maintainerClaims The MaintainerClaims contract address
     * @param backend The authorized backend address
     */
    function initialize(
        bytes32 repoHash,
        address repoToken,
        address quoteToken,
        address maintainerClaims,
        address backend
    ) external;
}
