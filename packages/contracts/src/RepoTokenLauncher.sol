// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IRepoTokenLauncher.sol";
import "./interfaces/IRepoTokenRegistry.sol";
import "./interfaces/IRepoTreasury.sol";

/**
 * @title RepoTokenLauncher
 * @notice Handles 7-day crowdfunded launches for GitHub repo tokens.
 *         Anyone can create a launch, deposit PathUSD during the window,
 *         and claim tokens after successful finalization.
 *
 * @dev Integrates with Tempo native precompiles:
 *      - TIP-20 Factory (0x20fc...): Creates repo tokens
 *      - Stablecoin DEX (0xdec0...): Seeds initial liquidity
 */
contract RepoTokenLauncher is IRepoTokenLauncher {
    // =========================================================================
    // TEMPO PRECOMPILE ADDRESSES
    // =========================================================================

    /// @notice TIP-20 Factory precompile
    address public constant TIP20_FACTORY = 0x20Fc000000000000000000000000000000000000;

    /// @notice Stablecoin DEX precompile
    address public constant STABLECOIN_DEX = 0xDEc0000000000000000000000000000000000000;

    /// @notice PathUSD token address
    address public constant PATH_USD = 0x20C0000000000000000000000000000000000000;

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// @inheritdoc IRepoTokenLauncher
    uint256 public constant override DEFAULT_MIN_RAISE = 1000e6; // 1000 PathUSD

    /// @inheritdoc IRepoTokenLauncher
    uint64 public constant override DEFAULT_DURATION = 7 days;

    /// @inheritdoc IRepoTokenLauncher
    uint256 public constant override TOTAL_SUPPLY = 100_000_000e6; // 100M tokens

    /// @inheritdoc IRepoTokenLauncher
    uint256 public constant override SUPPORTER_ALLOCATION = 70; // 70%

    /// @inheritdoc IRepoTokenLauncher
    uint256 public constant override TREASURY_ALLOCATION = 30; // 30%

    // =========================================================================
    // STATE
    // =========================================================================

    /// @notice Registry contract
    IRepoTokenRegistry public immutable registry;

    /// @notice MaintainerClaims contract
    address public immutable maintainerClaims;

    /// @notice Backend signer for authorized operations
    address public backend;

    /// @notice Admin address
    address public admin;

    /// @notice RepoTreasury implementation for cloning
    address public treasuryImplementation;

    /// @notice Mapping from repoHash to launch state
    mapping(bytes32 => LaunchState) private _launches;

    /// @notice Mapping from repoHash => depositor => Deposit
    mapping(bytes32 => mapping(address => Deposit)) private _deposits;

    /// @notice Nonce for deterministic treasury deployment
    uint256 private _deployNonce;

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyAdmin() {
        if (msg.sender != admin) revert InvalidConfig();
        _;
    }

    // =========================================================================
    // CONSTRUCTOR
    // =========================================================================

    constructor(
        address _registry,
        address _maintainerClaims,
        address _backend,
        address _admin,
        address _treasuryImplementation
    ) {
        registry = IRepoTokenRegistry(_registry);
        maintainerClaims = _maintainerClaims;
        backend = _backend;
        admin = _admin;
        treasuryImplementation = _treasuryImplementation;
    }

    // =========================================================================
    // VIEWS
    // =========================================================================

    /// @inheritdoc IRepoTokenLauncher
    function getLaunchState(bytes32 repoHash) external view override returns (LaunchState memory state) {
        return _launches[repoHash];
    }

    /// @inheritdoc IRepoTokenLauncher
    function getDeposit(bytes32 repoHash, address depositor) external view override returns (Deposit memory deposit) {
        return _deposits[repoHash][depositor];
    }

    /// @inheritdoc IRepoTokenLauncher
    function calculateAllocation(bytes32 repoHash, address depositor)
        external
        view
        override
        returns (uint256 tokenAmount)
    {
        LaunchState storage launch = _launches[repoHash];
        Deposit storage dep = _deposits[repoHash][depositor];

        if (launch.totalRaised == 0 || dep.amount == 0) {
            return 0;
        }

        // Supporter allocation = 70% of total supply
        uint256 supporterTokens = (TOTAL_SUPPLY * SUPPORTER_ALLOCATION) / 100;

        // Pro-rata allocation based on deposit share
        tokenAmount = (supporterTokens * dep.amount) / launch.totalRaised;
    }

    // =========================================================================
    // LAUNCH LIFECYCLE
    // =========================================================================

    /// @inheritdoc IRepoTokenLauncher
    function createLaunch(LaunchConfig calldata config) external override returns (bytes32 repoHash) {
        repoHash = config.repoHash;

        // Validate config
        if (bytes(config.tokenName).length == 0 || bytes(config.tokenSymbol).length == 0) {
            revert InvalidConfig();
        }

        // Check not already launched
        LaunchState storage launch = _launches[repoHash];
        if (launch.deadline != 0) {
            revert LaunchAlreadyExists();
        }

        // Set defaults if not provided
        uint256 minRaise = config.minRaise > 0 ? config.minRaise : DEFAULT_MIN_RAISE;
        uint64 duration = config.duration > 0 ? config.duration : DEFAULT_DURATION;
        uint64 deadline = uint64(block.timestamp) + duration;

        // Deploy treasury contract (minimal proxy pattern)
        address treasury = _deployTreasury(repoHash);

        // Register with registry
        registry.registerLaunch(repoHash, treasury, deadline);

        // Store launch state
        launch.repoHash = repoHash;
        launch.tokenName = config.tokenName;
        launch.tokenSymbol = config.tokenSymbol;
        launch.minRaise = minRaise;
        launch.deadline = deadline;
        launch.treasuryAddress = treasury;

        emit LaunchCreated(repoHash, msg.sender, config.tokenName, config.tokenSymbol, minRaise, deadline);
    }

    /// @inheritdoc IRepoTokenLauncher
    function deposit(bytes32 repoHash, uint256 amount) external override {
        LaunchState storage launch = _launches[repoHash];

        // Validate launch exists and is active
        if (launch.deadline == 0) {
            revert LaunchNotFound();
        }
        if (block.timestamp >= launch.deadline) {
            revert LaunchNotActive();
        }
        if (launch.finalized) {
            revert LaunchAlreadyFinalized();
        }
        if (amount == 0) {
            revert InsufficientDeposit();
        }

        // Transfer PathUSD from depositor
        bool success = _transferFrom(PATH_USD, msg.sender, address(this), amount);
        if (!success) {
            revert TransferFailed();
        }

        // Update deposit tracking
        _deposits[repoHash][msg.sender].amount += amount;
        launch.totalRaised += amount;

        emit Deposited(repoHash, msg.sender, amount);
    }

    /// @inheritdoc IRepoTokenLauncher
    function finalize(bytes32 repoHash) external override {
        LaunchState storage launch = _launches[repoHash];

        // Validate launch can be finalized
        if (launch.deadline == 0) {
            revert LaunchNotFound();
        }
        if (block.timestamp < launch.deadline) {
            revert LaunchStillActive();
        }
        if (launch.finalized) {
            revert LaunchAlreadyFinalized();
        }

        launch.finalized = true;

        // Check if minimum raise was met
        if (launch.totalRaised < launch.minRaise) {
            launch.failed = true;
            registry.failLaunch(repoHash);
            emit LaunchFailed(repoHash, launch.totalRaised);
            return;
        }

        // SUCCESS: Create token, initialize treasury, seed liquidity

        // 1. Create TIP-20 token via Factory (launcher is admin initially to mint)
        address token = _createToken(
            launch.tokenName,
            launch.tokenSymbol,
            address(this), // Launcher is admin initially
            repoHash
        );
        launch.tokenAddress = token;

        // 2. Mint total supply
        // 70% to this contract (for supporter claims)
        // 30% to treasury (for LP incentives)
        uint256 supporterTokens = (TOTAL_SUPPLY * SUPPORTER_ALLOCATION) / 100;
        uint256 treasuryTokens = (TOTAL_SUPPLY * TREASURY_ALLOCATION) / 100;

        _mint(token, address(this), supporterTokens);
        _mint(token, launch.treasuryAddress, treasuryTokens);

        // 3. Transfer admin to treasury (so treasury can manage the token)
        _transferAdmin(token, launch.treasuryAddress);

        // 3. Initialize treasury
        IRepoTreasury(launch.treasuryAddress).initialize(repoHash, token, PATH_USD, maintainerClaims, backend);

        // 4. Seed DEX liquidity
        // Transfer raised PathUSD to treasury for POL
        _transfer(PATH_USD, launch.treasuryAddress, launch.totalRaised);

        // 5. Update registry
        registry.finalizeLaunch(repoHash, token);

        emit LaunchFinalized(repoHash, token, launch.treasuryAddress, launch.totalRaised);
    }

    /// @inheritdoc IRepoTokenLauncher
    function refund(bytes32 repoHash) external override {
        LaunchState storage launch = _launches[repoHash];
        Deposit storage dep = _deposits[repoHash][msg.sender];

        // Validate refund conditions
        if (!launch.failed) {
            revert LaunchNotFailed();
        }
        if (dep.amount == 0 || dep.claimed) {
            revert NothingToRefund();
        }

        uint256 refundAmount = dep.amount;
        dep.amount = 0;
        dep.claimed = true;

        // Transfer PathUSD back to depositor
        bool success = _transfer(PATH_USD, msg.sender, refundAmount);
        if (!success) {
            revert TransferFailed();
        }

        emit Refunded(repoHash, msg.sender, refundAmount);
    }

    /// @inheritdoc IRepoTokenLauncher
    function claimTokens(bytes32 repoHash) external override {
        LaunchState storage launch = _launches[repoHash];
        Deposit storage dep = _deposits[repoHash][msg.sender];

        // Validate claim conditions
        if (!launch.finalized || launch.failed) {
            revert LaunchNotFound();
        }
        if (dep.amount == 0 || dep.claimed) {
            revert AlreadyClaimed();
        }

        // Calculate token allocation
        uint256 supporterTokens = (TOTAL_SUPPLY * SUPPORTER_ALLOCATION) / 100;
        uint256 tokenAmount = (supporterTokens * dep.amount) / launch.totalRaised;

        dep.claimed = true;

        // Transfer tokens to claimer
        bool success = _transfer(launch.tokenAddress, msg.sender, tokenAmount);
        if (!success) {
            revert TransferFailed();
        }

        emit TokensClaimed(repoHash, msg.sender, tokenAmount);
    }

    // =========================================================================
    // ADMIN FUNCTIONS
    // =========================================================================

    function setBackend(address newBackend) external onlyAdmin {
        backend = newBackend;
    }

    function setTreasuryImplementation(address newImpl) external onlyAdmin {
        treasuryImplementation = newImpl;
    }

    function setAdmin(address newAdmin) external onlyAdmin {
        admin = newAdmin;
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * @notice Deploy a new treasury contract using minimal proxy (EIP-1167)
     */
    function _deployTreasury(bytes32 repoHash) internal returns (address treasury) {
        // Using CREATE2 for deterministic addresses
        bytes32 salt = keccak256(abi.encodePacked(repoHash, _deployNonce++));

        // EIP-1167 minimal proxy bytecode
        bytes20 impl = bytes20(treasuryImplementation);
        bytes memory bytecode =
            abi.encodePacked(hex"3d602d80600a3d3981f3363d3d373d3d3d363d73", impl, hex"5af43d82803e903d91602b57fd5bf3");

        assembly {
            treasury := create2(0, add(bytecode, 0x20), mload(bytecode), salt)
        }

        require(treasury != address(0), "Treasury deployment failed");
    }

    /**
     * @notice Create a TIP-20 token via the Factory precompile
     */
    function _createToken(string memory name, string memory symbol, address tokenAdmin, bytes32 salt)
        internal
        returns (address token)
    {
        // Call TIP20Factory.createToken(name, symbol, currency, quoteToken, admin, salt)
        (bool success, bytes memory data) = TIP20_FACTORY.call(
            abi.encodeWithSignature(
                "createToken(string,string,string,address,address,bytes32)",
                name,
                symbol,
                "USD",
                PATH_USD,
                tokenAdmin,
                salt
            )
        );
        require(success, "Token creation failed");
        token = abi.decode(data, (address));
    }

    /**
     * @notice Mint tokens (calls mint on TIP-20)
     */
    function _mint(address token, address to, uint256 amount) internal {
        // Get ISSUER_ROLE from token
        (bool roleSuccess, bytes memory roleData) = token.staticcall(abi.encodeWithSignature("ISSUER_ROLE()"));
        require(roleSuccess, "Failed to get ISSUER_ROLE");
        bytes32 issuerRole = abi.decode(roleData, (bytes32));

        // Grant ourselves ISSUER_ROLE (we're the admin since we created the token)
        (bool grantSuccess,) =
            token.call(abi.encodeWithSignature("grantRole(bytes32,address)", issuerRole, address(this)));
        require(grantSuccess, "Failed to grant ISSUER_ROLE");

        // Now mint
        (bool mintSuccess,) = token.call(abi.encodeWithSignature("mint(address,uint256)", to, amount));
        require(mintSuccess, "Mint failed");
    }

    /**
     * @notice Transfer admin role to new address
     * @dev Grants admin role to new address and revokes from self
     */
    function _transferAdmin(address token, address newAdmin) internal {
        bytes32 adminRole = bytes32(0); // Default admin role is 0x00

        // Grant admin to new address
        (bool grantSuccess,) = token.call(abi.encodeWithSignature("grantRole(bytes32,address)", adminRole, newAdmin));
        require(grantSuccess, "Failed to grant admin");

        // Revoke admin from self
        (bool revokeSuccess,) =
            token.call(abi.encodeWithSignature("revokeRole(bytes32,address)", adminRole, address(this)));
        require(revokeSuccess, "Failed to revoke admin");
    }

    /**
     * @notice Transfer tokens
     */
    function _transfer(address token, address to, uint256 amount) internal returns (bool) {
        (bool success, bytes memory data) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }

    /**
     * @notice Transfer tokens from another address
     */
    function _transferFrom(address token, address from, address to, uint256 amount) internal returns (bool) {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSignature("transferFrom(address,address,uint256)", from, to, amount));
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }
}
