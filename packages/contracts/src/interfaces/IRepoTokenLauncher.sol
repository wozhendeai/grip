// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRepoTokenLauncher
 * @notice Handles 7-day crowdfunded launches for all repos.
 *         Anyone can create a launch, deposit PathUSD, and claim tokens after finalization.
 */
interface IRepoTokenLauncher {
    // =========================================================================
    // STRUCTS
    // =========================================================================

    struct LaunchConfig {
        bytes32 repoHash; // keccak256(abi.encodePacked(owner, "/", repo))
        string tokenName; // e.g., "React"
        string tokenSymbol; // e.g., "REACT"
        uint256 minRaise; // Default: 1000e6 (1000 PathUSD)
        uint64 duration; // Default: 7 days
    }

    struct LaunchState {
        bytes32 repoHash;
        string tokenName;
        string tokenSymbol;
        uint256 minRaise;
        uint256 totalRaised;
        uint64 deadline;
        bool finalized;
        bool failed;
        address tokenAddress; // Set after finalization
        address treasuryAddress;
    }

    struct Deposit {
        uint256 amount;
        bool claimed;
    }

    // =========================================================================
    // EVENTS
    // =========================================================================

    event LaunchCreated(
        bytes32 indexed repoHash,
        address indexed creator,
        string tokenName,
        string tokenSymbol,
        uint256 minRaise,
        uint64 deadline
    );

    event Deposited(bytes32 indexed repoHash, address indexed depositor, uint256 amount);

    event LaunchFinalized(
        bytes32 indexed repoHash, address indexed tokenAddress, address indexed treasuryAddress, uint256 totalRaised
    );

    event LaunchFailed(bytes32 indexed repoHash, uint256 totalRaised);

    event Refunded(bytes32 indexed repoHash, address indexed depositor, uint256 amount);

    event TokensClaimed(bytes32 indexed repoHash, address indexed claimer, uint256 tokenAmount);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error LaunchAlreadyExists();
    error LaunchNotFound();
    error LaunchNotActive();
    error LaunchStillActive();
    error LaunchAlreadyFinalized();
    error LaunchNotFailed();
    error InvalidConfig();
    error InsufficientDeposit();
    error AlreadyClaimed();
    error NothingToRefund();
    error TransferFailed();

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /**
     * @notice Default minimum raise amount (1000 PathUSD with 6 decimals)
     */
    function DEFAULT_MIN_RAISE() external view returns (uint256);

    /**
     * @notice Default launch duration (7 days)
     */
    function DEFAULT_DURATION() external view returns (uint64);

    /**
     * @notice Total token supply per repo token (100M with 6 decimals)
     */
    function TOTAL_SUPPLY() external view returns (uint256);

    /**
     * @notice Percentage of tokens allocated to supporters (70%)
     */
    function SUPPORTER_ALLOCATION() external view returns (uint256);

    /**
     * @notice Percentage of tokens allocated to treasury (30%)
     */
    function TREASURY_ALLOCATION() external view returns (uint256);

    // =========================================================================
    // VIEWS
    // =========================================================================

    /**
     * @notice Get launch state for a repo
     * @param repoHash The repo identifier
     * @return state The launch state
     */
    function getLaunchState(bytes32 repoHash) external view returns (LaunchState memory state);

    /**
     * @notice Get a depositor's info for a launch
     * @param repoHash The repo identifier
     * @param depositor The depositor address
     * @return deposit The deposit info
     */
    function getDeposit(bytes32 repoHash, address depositor) external view returns (Deposit memory deposit);

    /**
     * @notice Calculate token allocation for a depositor
     * @param repoHash The repo identifier
     * @param depositor The depositor address
     * @return tokenAmount The amount of tokens the depositor will receive
     */
    function calculateAllocation(bytes32 repoHash, address depositor) external view returns (uint256 tokenAmount);

    // =========================================================================
    // LAUNCH LIFECYCLE
    // =========================================================================

    /**
     * @notice Create a new launch for a repo
     * @param config The launch configuration
     * @return repoHash The repo identifier
     */
    function createLaunch(LaunchConfig calldata config) external returns (bytes32 repoHash);

    /**
     * @notice Deposit PathUSD during the launch window
     * @param repoHash The repo identifier
     * @param amount The amount of PathUSD to deposit
     */
    function deposit(bytes32 repoHash, uint256 amount) external;

    /**
     * @notice Finalize the launch after deadline
     * @dev Creates token via TIP-20 Factory, deploys treasury, seeds DEX liquidity
     * @param repoHash The repo identifier
     */
    function finalize(bytes32 repoHash) external;

    /**
     * @notice Claim refund if launch failed
     * @param repoHash The repo identifier
     */
    function refund(bytes32 repoHash) external;

    /**
     * @notice Claim allocated tokens after successful launch
     * @param repoHash The repo identifier
     */
    function claimTokens(bytes32 repoHash) external;
}
