// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IRepoTokenRegistry.sol";

/**
 * @title RepoTokenRegistry
 * @notice Single source of truth mapping GitHub repos to on-chain entities.
 *         Singleton contract that tracks all repo tokens, their treasuries, and launch status.
 */
contract RepoTokenRegistry is IRepoTokenRegistry {
    // =========================================================================
    // STATE
    // =========================================================================

    /// @notice Admin address
    address public admin;

    /// @notice Authorized launcher contract
    address public override launcher;

    /// @notice Mapping from repoHash to RepoInfo
    mapping(bytes32 => RepoInfo) private _repos;

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    modifier onlyLauncher() {
        if (msg.sender != launcher) revert Unauthorized();
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _admin) {
        admin = _admin;
    }

    // =========================================================================
    // VIEWS
    // =========================================================================

    /// @inheritdoc IRepoTokenRegistry
    function getRepoInfo(bytes32 repoHash) external view override returns (RepoInfo memory info) {
        return _repos[repoHash];
    }

    /// @inheritdoc IRepoTokenRegistry
    function isActive(bytes32 repoHash) external view override returns (bool) {
        return _repos[repoHash].status == LaunchStatus.Active;
    }

    // =========================================================================
    // LAUNCHER-ONLY FUNCTIONS
    // =========================================================================

    /// @inheritdoc IRepoTokenRegistry
    function registerLaunch(bytes32 repoHash, address treasury, uint64 deadline) external override onlyLauncher {
        RepoInfo storage repo = _repos[repoHash];

        // Cannot register if already registered (any status except None)
        if (repo.status != LaunchStatus.None) {
            revert RepoAlreadyRegistered();
        }

        repo.treasuryAddress = treasury;
        repo.status = LaunchStatus.Launching;
        repo.launchDeadline = deadline;

        emit LaunchRegistered(repoHash, treasury, deadline);
    }

    /// @inheritdoc IRepoTokenRegistry
    function finalizeLaunch(bytes32 repoHash, address token) external override onlyLauncher {
        RepoInfo storage repo = _repos[repoHash];

        if (repo.status != LaunchStatus.Launching) {
            revert InvalidStatus();
        }

        repo.tokenAddress = token;
        repo.status = LaunchStatus.Active;

        emit LaunchFinalized(repoHash, token, repo.treasuryAddress);
    }

    /// @inheritdoc IRepoTokenRegistry
    function failLaunch(bytes32 repoHash) external override onlyLauncher {
        RepoInfo storage repo = _repos[repoHash];

        if (repo.status != LaunchStatus.Launching) {
            revert InvalidStatus();
        }

        repo.status = LaunchStatus.Failed;

        emit LaunchFailed(repoHash);
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /// @inheritdoc IRepoTokenRegistry
    function setLauncher(address newLauncher) external override onlyAdmin {
        address oldLauncher = launcher;
        launcher = newLauncher;
        emit LauncherUpdated(oldLauncher, newLauncher);
    }

    /**
     * @notice Transfer admin role
     * @param newAdmin The new admin address
     */
    function setAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }
}
