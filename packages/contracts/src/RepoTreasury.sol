// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IRepoTreasury.sol";
import "./interfaces/IMaintainerClaims.sol";

/**
 * @title RepoTreasury
 * @notice Per-repo treasury that manages POL (flip orders), revenue splits, LP incentives, and bounty funding.
 *         POL is locked forever - no function to withdraw order capital, only to place more orders.
 *
 * @dev Revenue Model:
 *      1. Treasury places flip orders (POL) on the Stablecoin DEX
 *      2. Orders fill, capturing bid-ask spread
 *      3. harvestRevenue() calculates profit from filled orders
 *      4. executeSplit() allocates: 30% maintainers, 30% more POL, 40% bounties
 */
contract RepoTreasury is IRepoTreasury {
    // =========================================================================
    // TEMPO PRECOMPILE ADDRESSES
    // =========================================================================

    /// @notice Stablecoin DEX precompile
    address public constant STABLECOIN_DEX = 0xDEc0000000000000000000000000000000000000;

    // =========================================================================
    // CONSTANTS
    // =========================================================================

    /// @inheritdoc IRepoTreasury
    uint256 public constant override MAINTAINER_SHARE = 3000; // 30%

    /// @inheritdoc IRepoTreasury
    uint256 public constant override BUYBACK_SHARE = 3000; // 30%

    /// @inheritdoc IRepoTreasury
    uint256 public constant override BOUNTY_SHARE = 4000; // 40%

    /// @inheritdoc IRepoTreasury
    uint256 public constant override BASIS_POINTS = 10000;

    // =========================================================================
    // STATE
    // =========================================================================

    /// @notice Whether the treasury has been initialized
    bool public initialized;

    /// @notice The repo identifier
    bytes32 public repoHash;

    /// @notice The repo's TIP-20 token
    address public repoToken;

    /// @notice The quote token (PathUSD)
    address public quoteToken;

    /// @notice MaintainerClaims contract for withdrawal authorization
    address public maintainerClaims;

    /// @notice Authorized backend for operations
    address public backend;

    /// @notice Accumulated maintainer fees (PathUSD)
    uint256 public maintainerPool;

    /// @notice Accumulated bounty funds (PathUSD)
    uint256 public bountyPool;

    /// @notice Total revenue harvested
    uint256 public totalRevenue;

    /// @notice Pending revenue to be split
    uint256 public pendingRevenue;

    /// @notice Active flip order IDs
    uint128[] private _activeOrders;

    /// @notice Mapping from orderId to FlipOrderInfo
    mapping(uint128 => FlipOrderInfo) private _orders;

    /// @notice Last known DEX internal balance (for revenue calculation)
    uint256 private _lastDexBalance;

    // =========================================================================
    // MODIFIERS
    // =========================================================================

    modifier onlyInitialized() {
        require(initialized, "Not initialized");
        _;
    }

    modifier onlyBackend() {
        if (msg.sender != backend) revert Unauthorized();
        _;
    }

    // =========================================================================
    // INITIALIZATION
    // =========================================================================

    /// @inheritdoc IRepoTreasury
    function initialize(
        bytes32 _repoHash,
        address _repoToken,
        address _quoteToken,
        address _maintainerClaims,
        address _backend
    ) external override {
        require(!initialized, "Already initialized");

        repoHash = _repoHash;
        repoToken = _repoToken;
        quoteToken = _quoteToken;
        maintainerClaims = _maintainerClaims;
        backend = _backend;
        initialized = true;

        // Create DEX pair for trading (repoToken vs PathUSD)
        (bool success,) = STABLECOIN_DEX.call(abi.encodeWithSignature("createPair(address)", _repoToken));
        require(success, "createPair failed");
    }

    // =========================================================================
    // VIEWS
    // =========================================================================

    /// @inheritdoc IRepoTreasury
    function getTreasuryState() external view override returns (TreasuryState memory state) {
        state = TreasuryState({
            repoToken: repoToken,
            quoteToken: quoteToken,
            repoHash: repoHash,
            maintainerPool: maintainerPool,
            bountyPool: bountyPool,
            totalRevenue: totalRevenue,
            polValue: _estimatePolValue()
        });
    }

    /// @inheritdoc IRepoTreasury
    function getOrderValue() external view override returns (uint256 value) {
        return _estimatePolValue();
    }

    /// @inheritdoc IRepoTreasury
    function getFlipOrder(uint128 orderId) external view override returns (FlipOrderInfo memory info) {
        return _orders[orderId];
    }

    /// @inheritdoc IRepoTreasury
    function getActiveOrders() external view override returns (uint128[] memory orderIds) {
        return _activeOrders;
    }

    // =========================================================================
    // POL MANAGEMENT
    // =========================================================================

    /// @inheritdoc IRepoTreasury
    function placeFlipOrder(uint128 amount, int16 tick, int16 flipTick, bool isBid)
        external
        override
        onlyInitialized
        onlyBackend
        returns (uint128 orderId)
    {
        if (amount == 0) revert InvalidAmount();

        // Determine which token to use based on order type
        address token = isBid ? quoteToken : repoToken;

        // Approve DEX to spend tokens if needed
        _approveIfNeeded(token, STABLECOIN_DEX, amount);

        // Call DEX.placeFlip(token, amount, isBid, tick, flipTick)
        (bool success, bytes memory data) = STABLECOIN_DEX.call(
            abi.encodeWithSignature(
                "placeFlip(address,uint128,bool,int16,int16)",
                repoToken, // Base token for the pair
                amount,
                isBid,
                tick,
                flipTick
            )
        );
        require(success, "placeFlip failed");
        orderId = abi.decode(data, (uint128));

        // Track the order
        _orders[orderId] = FlipOrderInfo({
            orderId: orderId, token: token, amount: amount, isBid: isBid, tick: tick, flipTick: flipTick, active: true
        });
        _activeOrders.push(orderId);

        emit FlipOrderPlaced(orderId, amount, isBid, tick, flipTick);
    }

    /// @inheritdoc IRepoTreasury
    function cancelOrder(uint128 orderId) external override onlyInitialized onlyBackend {
        FlipOrderInfo storage order = _orders[orderId];
        if (!order.active) revert OrderNotFound();

        // Call DEX.cancel(orderId)
        (bool success,) = STABLECOIN_DEX.call(abi.encodeWithSignature("cancel(uint128)", orderId));
        require(success, "cancel failed");

        // Mark order as inactive
        order.active = false;

        // Remove from active orders array
        _removeFromActiveOrders(orderId);

        emit FlipOrderCancelled(orderId);
    }

    // =========================================================================
    // REVENUE DISTRIBUTION
    // =========================================================================

    /// @inheritdoc IRepoTreasury
    function harvestRevenue() external override onlyInitialized returns (uint256 harvested) {
        // Get current DEX internal balance for quote token
        uint256 currentBalance = _getDexBalance(quoteToken);

        // Revenue = current balance - last known balance
        // (Filled flip orders credit quote token to our internal balance)
        if (currentBalance > _lastDexBalance) {
            harvested = currentBalance - _lastDexBalance;
            pendingRevenue += harvested;
            totalRevenue += harvested;
            _lastDexBalance = currentBalance;

            emit RevenueHarvested(harvested);
        }
    }

    /// @inheritdoc IRepoTreasury
    function executeSplit() external override onlyInitialized {
        if (pendingRevenue == 0) return;

        uint256 revenue = pendingRevenue;
        pendingRevenue = 0;

        // Calculate splits
        uint256 maintainerAmount = (revenue * MAINTAINER_SHARE) / BASIS_POINTS;
        uint256 buybackAmount = (revenue * BUYBACK_SHARE) / BASIS_POINTS;
        uint256 bountyAmount = (revenue * BOUNTY_SHARE) / BASIS_POINTS;

        // Allocate to pools
        maintainerPool += maintainerAmount;
        bountyPool += bountyAmount;

        // Withdraw buyback amount from DEX to place more flip orders
        // The buyback is left in DEX internal balance for POL
        // (No action needed - it stays in DEX balance for future flip orders)

        emit SplitExecuted(maintainerAmount, buybackAmount, bountyAmount);
    }

    // =========================================================================
    // MAINTAINER FUNCTIONS
    // =========================================================================

    /// @inheritdoc IRepoTreasury
    function withdrawMaintainerFees(address to, uint256 amount, uint64 expiry, bytes calldata signature)
        external
        override
        onlyInitialized
    {
        // Verify caller is a verified maintainer
        if (!IMaintainerClaims(maintainerClaims).isVerifiedMaintainer(repoHash, msg.sender)) {
            revert Unauthorized();
        }

        // Verify signature from backend
        if (block.timestamp > expiry) revert SignatureExpired();

        bytes32 message = keccak256(abi.encodePacked(repoHash, msg.sender, to, amount, expiry));
        if (!_verifySignature(message, signature, backend)) {
            revert InvalidSignature();
        }

        // Check pool balance
        if (amount > maintainerPool) revert InsufficientBalance();
        maintainerPool -= amount;

        // Withdraw from DEX internal balance and transfer to recipient
        _withdrawFromDex(quoteToken, uint128(amount));
        bool success = _transfer(quoteToken, to, amount);
        if (!success) revert TransferFailed();

        emit MaintainerWithdrawal(msg.sender, to, amount);
    }

    // =========================================================================
    // BOUNTY FUNCTIONS
    // =========================================================================

    /// @inheritdoc IRepoTreasury
    function fundBounty(bytes32 bountyId, uint256 amount) external override onlyInitialized onlyBackend {
        if (amount > bountyPool) revert InsufficientBalance();
        bountyPool -= amount;

        // Funds stay in DEX internal balance, just accounting update
        emit BountyFunded(bountyId, amount);
    }

    /// @inheritdoc IRepoTreasury
    function payBounty(address contributor, uint256 pathUsdAmount, uint256 tokenAmount, bytes32 memo)
        external
        override
        onlyInitialized
        onlyBackend
    {
        // Withdraw PathUSD from DEX and transfer
        if (pathUsdAmount > 0) {
            _withdrawFromDex(quoteToken, uint128(pathUsdAmount));
            bool success = _transferWithMemo(quoteToken, contributor, pathUsdAmount, memo);
            if (!success) revert TransferFailed();
        }

        // Transfer repo tokens as bonus
        if (tokenAmount > 0) {
            bool success = _transferWithMemo(repoToken, contributor, tokenAmount, memo);
            if (!success) revert TransferFailed();
        }

        emit BountyPaid(contributor, pathUsdAmount, tokenAmount, memo);
    }

    // =========================================================================
    // LP INCENTIVES
    // =========================================================================

    /// @inheritdoc IRepoTreasury
    function emitRewards(uint256 amount) external override onlyInitialized onlyBackend {
        // Call TIP-20 Rewards distribution
        // Uses the opt-in reward system for O(1) distribution
        (bool success,) = repoToken.call(abi.encodeWithSignature("distributeReward(uint256)", amount));
        require(success, "Reward distribution failed");

        emit LpRewardsEmitted(amount);
    }

    // =========================================================================
    // INTERNAL HELPERS
    // =========================================================================

    /**
     * @notice Estimate total value of standing flip orders
     */
    function _estimatePolValue() internal view returns (uint256 value) {
        // Sum up the value of all active orders
        // This is an approximation - actual value depends on order fills
        for (uint256 i = 0; i < _activeOrders.length; i++) {
            FlipOrderInfo storage order = _orders[_activeOrders[i]];
            if (order.active) {
                // For simplicity, use the original amount
                // In production, query DEX for actual remaining liquidity
                value += order.amount;
            }
        }

        // Add DEX internal balance
        value += _getDexBalance(quoteToken);
        value += _getDexBalance(repoToken);
    }

    /**
     * @notice Remove an order from the active orders array
     */
    function _removeFromActiveOrders(uint128 orderId) internal {
        uint256 length = _activeOrders.length;
        for (uint256 i = 0; i < length; i++) {
            if (_activeOrders[i] == orderId) {
                _activeOrders[i] = _activeOrders[length - 1];
                _activeOrders.pop();
                break;
            }
        }
    }

    /**
     * @notice Get our internal balance on the DEX
     */
    function _getDexBalance(address token) internal view returns (uint256) {
        (bool success, bytes memory data) =
            STABLECOIN_DEX.staticcall(abi.encodeWithSignature("balanceOf(address,address)", address(this), token));
        if (!success) return 0;
        return abi.decode(data, (uint256));
    }

    /**
     * @notice Withdraw tokens from DEX internal balance
     */
    function _withdrawFromDex(address token, uint128 amount) internal {
        (bool success,) = STABLECOIN_DEX.call(abi.encodeWithSignature("withdraw(address,uint128)", token, amount));
        require(success, "DEX withdraw failed");
    }

    /**
     * @notice Approve token spending if needed
     */
    function _approveIfNeeded(address token, address spender, uint256 amount) internal {
        (bool success, bytes memory data) =
            token.call(abi.encodeWithSignature("allowance(address,address)", address(this), spender));
        if (success) {
            uint256 currentAllowance = abi.decode(data, (uint256));
            if (currentAllowance < amount) {
                (success,) = token.call(abi.encodeWithSignature("approve(address,uint256)", spender, type(uint256).max));
                require(success, "Approve failed");
            }
        }
    }

    /**
     * @notice Transfer tokens
     */
    function _transfer(address token, address to, uint256 amount) internal returns (bool) {
        (bool success, bytes memory data) = token.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        return success && (data.length == 0 || abi.decode(data, (bool)));
    }

    /**
     * @notice Transfer tokens with memo
     */
    function _transferWithMemo(address token, address to, uint256 amount, bytes32 memo) internal returns (bool) {
        (bool success,) =
            token.call(abi.encodeWithSignature("transferWithMemo(address,uint256,bytes32)", to, amount, memo));
        return success;
    }

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
