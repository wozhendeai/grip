// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IRepoTokenRegistry
 * @notice Single source of truth mapping GitHub repos to on-chain entities.
 *         Stores token address, treasury address, and launch status for each repo.
 */
interface IRepoTokenRegistry {
    // =========================================================================
    // ENUMS
    // =========================================================================

    enum LaunchStatus {
        None, // No launch initiated
        Launching, // 7-day crowdfunding in progress
        Active, // Launch succeeded, token trading
        Failed // Launch failed (< $1k raised)
    }

    // =========================================================================
    // STRUCTS
    // =========================================================================

    struct RepoInfo {
        address tokenAddress; // TIP-20 token (address(0) until finalized)
        address treasuryAddress; // RepoTreasury contract
        LaunchStatus status;
        uint64 launchDeadline; // Unix timestamp when launch window closes
        bytes32 githubCommitHash; // Optional verification anchor
    }

    // =========================================================================
    // EVENTS
    // =========================================================================

    event LaunchRegistered(bytes32 indexed repoHash, address indexed treasury, uint64 deadline);

    event LaunchFinalized(bytes32 indexed repoHash, address indexed token, address indexed treasury);

    event LaunchFailed(bytes32 indexed repoHash);

    event LauncherUpdated(address indexed oldLauncher, address indexed newLauncher);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error Unauthorized();
    error RepoAlreadyRegistered();
    error RepoNotFound();
    error InvalidStatus();

    // =========================================================================
    // VIEWS
    // =========================================================================

    /**
     * @notice Get info for a registered repo
     * @param repoHash keccak256(abi.encodePacked(githubOwner, "/", githubRepo))
     * @return info The repo's on-chain info
     */
    function getRepoInfo(bytes32 repoHash) external view returns (RepoInfo memory info);

    /**
     * @notice Check if a repo has an active token
     * @param repoHash The repo identifier
     * @return True if status is Active
     */
    function isActive(bytes32 repoHash) external view returns (bool);

    /**
     * @notice Get the authorized launcher contract
     * @return The launcher address
     */
    function launcher() external view returns (address);

    // =========================================================================
    // LAUNCHER-ONLY FUNCTIONS
    // =========================================================================

    /**
     * @notice Register a new launch (called by RepoTokenLauncher.createLaunch)
     * @param repoHash The repo identifier
     * @param treasury The deployed RepoTreasury address
     * @param deadline Unix timestamp when launch window closes
     */
    function registerLaunch(bytes32 repoHash, address treasury, uint64 deadline) external;

    /**
     * @notice Mark launch as successful and record token address
     * @param repoHash The repo identifier
     * @param token The deployed TIP-20 token address
     */
    function finalizeLaunch(bytes32 repoHash, address token) external;

    /**
     * @notice Mark launch as failed (< minimum raise)
     * @param repoHash The repo identifier
     */
    function failLaunch(bytes32 repoHash) external;

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /**
     * @notice Set the authorized launcher contract
     * @param newLauncher The new launcher address
     */
    function setLauncher(address newLauncher) external;
}
