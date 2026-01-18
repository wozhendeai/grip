// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IMaintainerClaims
 * @notice Bridges off-chain GitHub verification to on-chain withdrawals.
 *         Backend verifies GitHub admin access, signs authorization, maintainer calls withdraw.
 */
interface IMaintainerClaims {
    // =========================================================================
    // STRUCTS
    // =========================================================================

    struct Verification {
        bytes32 githubUserIdHash; // keccak256 of GitHub user ID
        address wallet; // Verified Tempo address
        uint64 expiry; // Verification expiry timestamp
        bool active;
    }

    // =========================================================================
    // EVENTS
    // =========================================================================

    event VerificationRegistered(
        bytes32 indexed repoHash, bytes32 indexed githubUserIdHash, address indexed wallet, uint64 expiry
    );

    event VerificationRevoked(bytes32 indexed repoHash, bytes32 indexed githubUserIdHash);

    event MaintainerWithdrawal(bytes32 indexed repoHash, address indexed wallet, uint256 amount);

    event BackendSignerUpdated(address indexed oldSigner, address indexed newSigner);

    // =========================================================================
    // ERRORS
    // =========================================================================

    error Unauthorized();
    error InvalidSignature();
    error SignatureExpired();
    error VerificationNotFound();
    error VerificationExpired();
    error AlreadyVerified();
    error InvalidWallet();
    error TransferFailed();

    // =========================================================================
    // VIEWS
    // =========================================================================

    /**
     * @notice Get the backend signer address
     * @return The signer address that authorizes verifications
     */
    function backendSigner() external view returns (address);

    /**
     * @notice Check if a wallet is a verified maintainer for a repo
     * @param repoHash The repo identifier
     * @param wallet The wallet address to check
     * @return True if verified and not expired
     */
    function isVerifiedMaintainer(bytes32 repoHash, address wallet) external view returns (bool);

    /**
     * @notice Get verification details for a repo + wallet
     * @param repoHash The repo identifier
     * @param wallet The wallet address
     * @return verification The verification details
     */
    function getVerification(bytes32 repoHash, address wallet) external view returns (Verification memory verification);

    /**
     * @notice Get all verified maintainers for a repo
     * @param repoHash The repo identifier
     * @return wallets Array of verified wallet addresses
     */
    function getMaintainers(bytes32 repoHash) external view returns (address[] memory wallets);

    // =========================================================================
    // VERIFICATION FUNCTIONS
    // =========================================================================

    /**
     * @notice Register a GitHub maintainer verification
     * @dev Called by maintainer with backend-signed authorization
     * @param repoHash The repo identifier
     * @param githubUserIdHash keccak256 of the GitHub user ID
     * @param wallet The maintainer's Tempo wallet address
     * @param expiry Verification expiry timestamp
     * @param signature Backend signature authorizing this verification
     */
    function registerVerification(
        bytes32 repoHash,
        bytes32 githubUserIdHash,
        address wallet,
        uint64 expiry,
        bytes calldata signature
    ) external;

    /**
     * @notice Revoke a maintainer verification
     * @dev Only callable by the maintainer themselves or admin
     * @param repoHash The repo identifier
     * @param wallet The wallet to revoke
     */
    function revokeVerification(bytes32 repoHash, address wallet) external;

    // =========================================================================
    // WITHDRAWAL FUNCTIONS
    // =========================================================================

    /**
     * @notice Withdraw maintainer fees from a repo treasury
     * @dev Caller must be a verified maintainer for the repo
     * @param repoHash The repo identifier
     * @param amount The amount to withdraw
     */
    function withdraw(bytes32 repoHash, uint256 amount) external;

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /**
     * @notice Update the backend signer address
     * @param newSigner The new signer address
     */
    function setBackendSigner(address newSigner) external;
}
