// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IMaintainerClaims.sol";
import "./interfaces/IRepoTokenRegistry.sol";
import "./interfaces/IRepoTreasury.sol";

/**
 * @title MaintainerClaims
 * @notice Bridges off-chain GitHub verification to on-chain withdrawals.
 *         Backend verifies GitHub admin access via OAuth, signs authorization,
 *         maintainer registers on-chain, then can withdraw from treasury.
 *
 * @dev Flow:
 *      1. Maintainer connects GitHub account to BountyLane
 *      2. Backend verifies admin/write access to repository
 *      3. Backend signs verification message
 *      4. Maintainer calls registerVerification() with signature
 *      5. Maintainer can now call withdraw() to get fees
 */
contract MaintainerClaims is IMaintainerClaims {
    // =========================================================================
    // STATE
    // =========================================================================

    /// @notice Admin address
    address public admin;

    /// @inheritdoc IMaintainerClaims
    address public override backendSigner;

    /// @notice Registry contract for looking up treasuries
    IRepoTokenRegistry public registry;

    /// @notice Mapping from repoHash => wallet => Verification
    mapping(bytes32 => mapping(address => Verification)) private _verifications;

    /// @notice Mapping from repoHash => array of verified wallets
    mapping(bytes32 => address[]) private _maintainerWallets;

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyAdmin() {
        if (msg.sender != admin) revert Unauthorized();
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(address _admin, address _backendSigner, address _registry) {
        admin = _admin;
        backendSigner = _backendSigner;
        registry = IRepoTokenRegistry(_registry);
    }

    // =========================================================================
    // VIEWS
    // =========================================================================

    /// @inheritdoc IMaintainerClaims
    function isVerifiedMaintainer(bytes32 repoHash, address wallet) external view override returns (bool) {
        Verification storage v = _verifications[repoHash][wallet];
        return v.active && block.timestamp < v.expiry;
    }

    /// @inheritdoc IMaintainerClaims
    function getVerification(bytes32 repoHash, address wallet)
        external
        view
        override
        returns (Verification memory verification)
    {
        return _verifications[repoHash][wallet];
    }

    /// @inheritdoc IMaintainerClaims
    function getMaintainers(bytes32 repoHash) external view override returns (address[] memory wallets) {
        address[] storage allWallets = _maintainerWallets[repoHash];
        uint256 count = 0;

        // Count active maintainers
        for (uint256 i = 0; i < allWallets.length; i++) {
            Verification storage v = _verifications[repoHash][allWallets[i]];
            if (v.active && block.timestamp < v.expiry) {
                count++;
            }
        }

        // Build result array
        wallets = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < allWallets.length; i++) {
            Verification storage v = _verifications[repoHash][allWallets[i]];
            if (v.active && block.timestamp < v.expiry) {
                wallets[idx++] = allWallets[i];
            }
        }
    }

    // =========================================================================
    // VERIFICATION FUNCTIONS
    // =========================================================================

    /// @inheritdoc IMaintainerClaims
    function registerVerification(
        bytes32 repoHash,
        bytes32 githubUserIdHash,
        address wallet,
        uint64 expiry,
        bytes calldata signature
    ) external override {
        if (wallet == address(0)) revert InvalidWallet();
        if (block.timestamp >= expiry) revert SignatureExpired();

        // Verify signature from backend
        bytes32 message = keccak256(abi.encodePacked(repoHash, githubUserIdHash, wallet, expiry));

        if (!_verifySignature(message, signature, backendSigner)) {
            revert InvalidSignature();
        }

        // Check if already verified (update expiry is allowed)
        Verification storage v = _verifications[repoHash][wallet];

        if (!v.active) {
            // New verification - add to wallet list
            _maintainerWallets[repoHash].push(wallet);
        }

        // Update verification
        v.githubUserIdHash = githubUserIdHash;
        v.wallet = wallet;
        v.expiry = expiry;
        v.active = true;

        emit VerificationRegistered(repoHash, githubUserIdHash, wallet, expiry);
    }

    /// @inheritdoc IMaintainerClaims
    function revokeVerification(bytes32 repoHash, address wallet) external override {
        Verification storage v = _verifications[repoHash][wallet];

        // Only the maintainer themselves or admin can revoke
        if (msg.sender != wallet && msg.sender != admin) {
            revert Unauthorized();
        }

        if (!v.active) revert VerificationNotFound();

        v.active = false;

        emit VerificationRevoked(repoHash, v.githubUserIdHash);
    }

    // =========================================================================
    // WITHDRAWAL FUNCTIONS
    // =========================================================================

    /// @inheritdoc IMaintainerClaims
    function withdraw(bytes32 repoHash, uint256 amount) external override {
        // Verify caller is a verified maintainer
        Verification storage v = _verifications[repoHash][msg.sender];
        if (!v.active) revert VerificationNotFound();
        if (block.timestamp >= v.expiry) revert VerificationExpired();

        // Get treasury address from registry
        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        if (info.treasuryAddress == address(0)) {
            revert VerificationNotFound();
        }

        // Create withdrawal signature for treasury
        // (In production, this would be handled by the backend signing)
        // For now, we emit an event and the backend handles the actual withdrawal
        emit MaintainerWithdrawal(repoHash, msg.sender, amount);

        // Note: The actual fund transfer happens through the treasury's
        // withdrawMaintainerFees function, which requires a backend signature.
        // This contract serves as the source of truth for maintainer verification.
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    /// @inheritdoc IMaintainerClaims
    function setBackendSigner(address newSigner) external override onlyAdmin {
        address oldSigner = backendSigner;
        backendSigner = newSigner;
        emit BackendSignerUpdated(oldSigner, newSigner);
    }

    /**
     * @notice Update the registry address
     * @param newRegistry The new registry address
     */
    function setRegistry(address newRegistry) external onlyAdmin {
        registry = IRepoTokenRegistry(newRegistry);
    }

    /**
     * @notice Transfer admin role
     * @param newAdmin The new admin address
     */
    function setAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * @notice Verify a signature
     */
    function _verifySignature(bytes32 message, bytes calldata signature, address expectedSigner)
        internal
        pure
        returns (bool)
    {
        bytes32 ethSignedMessage = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", message));

        (bytes32 r, bytes32 s, uint8 v) = _splitSignature(signature);
        address recovered = ecrecover(ethSignedMessage, v, r, s);

        return recovered == expectedSigner;
    }

    /**
     * @notice Split signature into r, s, v components
     */
    function _splitSignature(bytes calldata sig) internal pure returns (bytes32 r, bytes32 s, uint8 v) {
        require(sig.length == 65, "Invalid signature length");

        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
    }
}
