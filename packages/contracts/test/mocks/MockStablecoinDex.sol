// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IStablecoinDEX} from "tempo-std/interfaces/IStablecoinDEX.sol";
import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";

contract MockStablecoinDex is IStablecoinDEX {
    struct PairInfo {
        address base;
        address quote;
        bool exists;
        int16 bestBidTick;
        int16 bestAskTick;
    }

    uint128 public override nextOrderId = 1;

    mapping(bytes32 => PairInfo) private _pairs;
    mapping(address => address) private _quoteForBase;
    mapping(uint128 => Order) private _orders;
    mapping(address => mapping(address => uint128)) private _balances;

    function MAX_PRICE() external pure returns (uint32) {
        return 102000;
    }

    function MAX_TICK() public pure returns (int16) {
        return 2000;
    }

    function MIN_PRICE() external pure returns (uint32) {
        return 98000;
    }

    function MIN_TICK() public pure returns (int16) {
        return -2000;
    }

    function TICK_SPACING() public pure returns (int16) {
        return 10;
    }

    function PRICE_SCALE() external pure returns (uint32) {
        return 100000;
    }

    function MIN_ORDER_AMOUNT() public pure returns (uint128) {
        return 1e6;
    }

    function balanceOf(address user, address token) external view returns (uint128) {
        return _balances[user][token];
    }

    function books(bytes32 key)
        external
        view
        returns (address base, address quote, int16 bestBidTick, int16 bestAskTick)
    {
        PairInfo storage pair = _pairs[key];
        return (pair.base, pair.quote, pair.bestBidTick, pair.bestAskTick);
    }

    function cancel(uint128 orderId) external {
        Order storage order = _orders[orderId];
        if (order.maker == address(0)) {
            revert OrderDoesNotExist();
        }
        if (order.maker != msg.sender) {
            revert Unauthorized();
        }
        delete _orders[orderId];
        emit OrderCancelled(orderId);
    }

    function cancelStaleOrder(uint128) external {}

    function createPair(address base) external returns (bytes32 key) {
        ITIP20 quote = ITIP20(base).quoteToken();
        if (address(quote) == address(0)) {
            revert InvalidBaseToken();
        }

        key = pairKey(base, address(quote));
        if (_pairs[key].exists) {
            revert PairAlreadyExists();
        }

        _pairs[key] = PairInfo({base: base, quote: address(quote), exists: true, bestBidTick: 0, bestAskTick: 0});
        _quoteForBase[base] = address(quote);

        emit PairCreated(key, base, address(quote));
    }

    function getTickLevel(address, int16, bool) external pure returns (uint128, uint128, uint128) {
        return (0, 0, 0);
    }

    function getOrder(uint128 orderId) external view returns (Order memory) {
        Order memory order = _orders[orderId];
        if (order.maker == address(0)) {
            revert OrderDoesNotExist();
        }
        return order;
    }

    function pairKey(address tokenA, address tokenB) public pure returns (bytes32 key) {
        return keccak256(abi.encodePacked(tokenA, tokenB));
    }

    function place(address token, uint128 amount, bool isBid, int16 tick) external returns (uint128 orderId) {
        _validateOrder(token, tick, 0, amount, false);
        address quote = _quoteForBase[token];
        address spendToken = isBid ? quote : token;

        _pullToken(spendToken, amount);

        orderId = nextOrderId++;
        _orders[orderId] = Order({
            orderId: orderId,
            maker: msg.sender,
            bookKey: pairKey(token, quote),
            isBid: isBid,
            tick: tick,
            amount: amount,
            remaining: amount,
            prev: 0,
            next: 0,
            isFlip: false,
            flipTick: 0
        });

        emit OrderPlaced(orderId, msg.sender, token, amount, isBid, tick, false, 0);
    }

    function placeFlip(address token, uint128 amount, bool isBid, int16 tick, int16 flipTick)
        external
        returns (uint128 orderId)
    {
        _validateOrder(token, tick, flipTick, amount, true);
        address quote = _quoteForBase[token];
        address spendToken = isBid ? quote : token;

        _pullToken(spendToken, amount);

        orderId = nextOrderId++;
        _orders[orderId] = Order({
            orderId: orderId,
            maker: msg.sender,
            bookKey: pairKey(token, quote),
            isBid: isBid,
            tick: tick,
            amount: amount,
            remaining: amount,
            prev: 0,
            next: 0,
            isFlip: true,
            flipTick: flipTick
        });

        emit OrderPlaced(orderId, msg.sender, token, amount, isBid, tick, true, flipTick);
    }

    function priceToTick(uint32) external pure returns (int16) {
        return 0;
    }

    function quoteSwapExactAmountIn(address, address, uint128) external pure returns (uint128) {
        return 0;
    }

    function quoteSwapExactAmountOut(address, address, uint128) external pure returns (uint128) {
        return 0;
    }

    function swapExactAmountIn(address, address, uint128, uint128) external pure returns (uint128) {
        return 0;
    }

    function swapExactAmountOut(address, address, uint128, uint128) external pure returns (uint128) {
        return 0;
    }

    function tickToPrice(int16) external pure returns (uint32) {
        return 100000;
    }

    function withdraw(address token, uint128 amount) external {
        uint128 balance = _balances[msg.sender][token];
        if (balance < amount) {
            revert InsufficientBalance();
        }
        _balances[msg.sender][token] = balance - amount;

        (bool ok, bytes memory data) =
            token.call(abi.encodeWithSignature("transfer(address,uint256)", msg.sender, uint256(amount)));
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transfer failed");
    }

    function registerMarket(address baseToken, address quoteToken) external {
        _quoteForBase[baseToken] = quoteToken;
        bytes32 key = pairKey(baseToken, quoteToken);
        _pairs[key] = PairInfo({base: baseToken, quote: quoteToken, exists: true, bestBidTick: 0, bestAskTick: 0});
    }

    function setBalance(address account, address token, uint128 amount) external {
        _balances[account][token] = amount;
    }

    /// @notice Simulates an order being filled, triggering flip if applicable
    /// @dev For testing POL revenue capture: fill order → credit quote to maker → flip order
    /// @param orderId The order to fill
    /// @param fillAmount Amount to fill (must be <= remaining)
    function simulateFill(uint128 orderId, uint128 fillAmount) external {
        Order storage order = _orders[orderId];
        if (order.maker == address(0)) revert OrderDoesNotExist();
        if (fillAmount > order.remaining) revert InsufficientLiquidity();

        address quote = _quoteForBase[_getBaseFromBookKey(order.bookKey)];

        // Reduce remaining
        order.remaining -= fillAmount;
        bool fullyFilled = order.remaining == 0;

        // Credit proceeds to maker's internal balance
        // If bid: maker bought base, receives base tokens
        // If ask: maker sold base, receives quote tokens
        address receiveToken = order.isBid ? _getBaseFromBookKey(order.bookKey) : quote;
        _balances[order.maker][receiveToken] += fillAmount;

        emit OrderFilled(orderId, order.maker, msg.sender, fillAmount, !fullyFilled);

        // If fully filled and is flip order, create reversed order
        if (fullyFilled && order.isFlip) {
            _createFlippedOrder(order, quote);
        }
    }

    function _getBaseFromBookKey(bytes32 bookKey) internal view returns (address) {
        // bookKey = keccak256(base, quote), we need to look it up
        // For simplicity, iterate pairs (fine for tests)
        // In practice, store base in Order struct
        return _pairs[bookKey].base;
    }

    function _createFlippedOrder(Order storage original, address quote) internal {
        address base = _getBaseFromBookKey(original.bookKey);

        // Flip: bid becomes ask, ask becomes bid
        bool newIsBid = !original.isBid;
        int16 newTick = original.flipTick;
        int16 newFlipTick = original.tick;

        // Spend token for new order comes from internal balance
        address spendToken = newIsBid ? quote : base;
        uint128 amount = original.amount;

        // Deduct from internal balance (should have been credited from fill)
        if (_balances[original.maker][spendToken] < amount) {
            // Not enough balance to flip - order just closes
            return;
        }
        _balances[original.maker][spendToken] -= amount;

        uint128 newOrderId = nextOrderId++;
        _orders[newOrderId] = Order({
            orderId: newOrderId,
            maker: original.maker,
            bookKey: original.bookKey,
            isBid: newIsBid,
            tick: newTick,
            amount: amount,
            remaining: amount,
            prev: 0,
            next: 0,
            isFlip: true,
            flipTick: newFlipTick
        });

        emit OrderPlaced(newOrderId, original.maker, base, amount, newIsBid, newTick, true, newFlipTick);
    }

    function _pullToken(address token, uint128 amount) internal {
        if (amount == 0) return;
        (bool ok, bytes memory data) = token.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", msg.sender, address(this), uint256(amount))
        );
        require(ok && (data.length == 0 || abi.decode(data, (bool))), "transferFrom failed");
    }

    function _validateOrder(address token, int16 tick, int16 flipTick, uint128 amount, bool isFlip) internal view {
        if (_quoteForBase[token] == address(0)) {
            revert PairDoesNotExist();
        }
        if (tick < MIN_TICK() || tick > MAX_TICK()) {
            revert TickOutOfBounds(tick);
        }
        if (tick % TICK_SPACING() != 0) {
            revert InvalidTick();
        }
        if (amount < MIN_ORDER_AMOUNT()) {
            revert BelowMinimumOrderSize(amount);
        }
        if (isFlip) {
            if (flipTick % TICK_SPACING() != 0) {
                revert InvalidFlipTick();
            }
        }
    }
}
