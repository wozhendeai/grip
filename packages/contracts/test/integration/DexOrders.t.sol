// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {ITIP20RolesAuth} from "tempo-std/interfaces/ITIP20RolesAuth.sol";
import {IStablecoinDEX} from "tempo-std/interfaces/IStablecoinDEX.sol";
import {IntegrationBase} from "./Integration.base.sol";

/// @title DexOrdersTest
/// @notice Integration tests for Stablecoin DEX flip order mechanics
contract DexOrdersTest is IntegrationBase {
    address internal token;
    bytes32 internal pairKey;

    function setUp() public override {
        super.setUp();
        if (block.chainid != TEMPO_CHAIN_ID) return;

        // Create a test token and pair for DEX tests
        token = _createToken("DEX Test Token", "DEXT");
        pairKey = dex.createPair(token);

        // Grant ISSUER_ROLE and mint tokens for trading
        bytes32 issuerRole = ITIP20(token).ISSUER_ROLE();
        ITIP20RolesAuth(token).grantRole(issuerRole, address(this));
        ITIP20(token).mint(address(this), 1_000_000e6);
        ITIP20(token).mint(trader, 100_000e6);
    }

    function test_CreatePair() public onlyTempo {
        address newToken = _createToken("Pair Test", "PAIR");
        bytes32 key = dex.createPair(newToken);

        (address base, address quote,,) = dex.books(key);
        assertEq(base, newToken);
        assertEq(quote, address(pathUsd));
    }

    function test_CreatePair_RevertsForDuplicate() public onlyTempo {
        // vm.expectRevert doesn't work with precompiles, use try/catch
        try dex.createPair(token) {
            fail("Expected revert for duplicate pair");
        } catch {
            // Expected - pair already exists
        }
    }

    function test_PlaceOrder() public onlyTempo {
        uint128 amount = 10_000e6;
        int16 tick = 100; // Ask above peg

        // Approve token for ask order (selling token)
        ITIP20(token).approve(address(dex), amount);
        uint128 orderId = dex.place(token, amount, false, tick);

        IStablecoinDEX.Order memory order = dex.getOrder(orderId);
        assertEq(order.orderId, orderId);
        assertEq(order.maker, address(this));
        assertFalse(order.isBid); // Ask order
        assertEq(order.tick, tick);
        assertEq(order.amount, amount);
        assertEq(order.remaining, amount);
        assertFalse(order.isFlip);
    }

    function test_PlaceFlipOrder() public onlyTempo {
        uint128 amount = 10_000e6;
        int16 tick = 100; // Ask above peg
        int16 flipTick = -100; // Flip to bid below peg

        ITIP20(token).approve(address(dex), amount);
        uint128 orderId = dex.placeFlip(token, amount, false, tick, flipTick);

        IStablecoinDEX.Order memory order = dex.getOrder(orderId);
        assertEq(order.orderId, orderId);
        assertEq(order.isBid, false);
        assertEq(order.tick, tick);
        assertEq(order.flipTick, flipTick);
        assertTrue(order.isFlip);
        assertEq(order.remaining, amount);
    }

    function test_CancelOrder() public onlyTempo {
        uint128 amount = 10_000e6;

        ITIP20(token).approve(address(dex), amount);
        uint128 orderId = dex.place(token, amount, false, 100);

        // Cancel the order
        dex.cancel(orderId);

        // Order should no longer exist (use try/catch for precompiles)
        try dex.getOrder(orderId) {
            fail("Expected revert for non-existent order");
        } catch {
            // Expected - order no longer exists
        }

        // Funds should be in DEX balance
        uint128 balance = dex.balanceOf(address(this), token);
        assertEq(balance, amount);
    }

    function test_WithdrawFromDex() public onlyTempo {
        uint128 amount = 10_000e6;

        // Place and cancel to get funds in DEX balance
        ITIP20(token).approve(address(dex), amount);
        uint128 orderId = dex.place(token, amount, false, 100);
        dex.cancel(orderId);

        uint256 balanceBefore = ITIP20(token).balanceOf(address(this));

        // Withdraw from DEX
        dex.withdraw(token, amount);

        assertEq(ITIP20(token).balanceOf(address(this)), balanceBefore + amount);
        assertEq(dex.balanceOf(address(this), token), 0);
    }

    function test_SwapExactAmountIn() public onlyTempo {
        // Place ask order (selling tokens)
        uint128 askAmount = 10_000e6;
        ITIP20(token).approve(address(dex), askAmount);
        dex.place(token, askAmount, false, 0); // At peg

        // Trader swaps PathUSD for tokens
        uint128 pathUsdIn = 5_000e6;
        _fundWithPathUsd(trader, pathUsdIn);

        vm.startPrank(trader);
        pathUsd.approve(address(dex), pathUsdIn);

        uint128 expectedOut = dex.quoteSwapExactAmountIn(address(pathUsd), token, pathUsdIn);
        uint128 actualOut = dex.swapExactAmountIn(address(pathUsd), token, pathUsdIn, expectedOut);
        vm.stopPrank();

        assertEq(actualOut, expectedOut);
        assertGt(actualOut, 0);
    }

    function test_SwapExactAmountOut() public onlyTempo {
        // Place ask order
        uint128 askAmount = 10_000e6;
        ITIP20(token).approve(address(dex), askAmount);
        dex.place(token, askAmount, false, 0);

        // Trader wants exact amount out
        uint128 tokensWanted = 5_000e6;
        uint128 maxIn = 6_000e6;
        _fundWithPathUsd(trader, maxIn);

        vm.startPrank(trader);
        pathUsd.approve(address(dex), maxIn);

        uint128 amountIn = dex.swapExactAmountOut(address(pathUsd), token, tokensWanted, maxIn);
        vm.stopPrank();

        assertLe(amountIn, maxIn);
        uint128 traderBalance = uint128(ITIP20(token).balanceOf(trader));
        assertGe(traderBalance, tokensWanted);
    }

    function test_OrderFillCreditsBalance() public onlyTempo {
        // Place bid order (buying tokens with PathUSD)
        uint128 bidAmount = 10_000e6;
        _fundWithPathUsd(address(this), bidAmount);
        pathUsd.approve(address(dex), bidAmount);
        dex.place(token, bidAmount, true, -10); // Bid below peg

        // Trader sells tokens into bid
        vm.startPrank(trader);
        ITIP20(token).approve(address(dex), bidAmount);
        dex.swapExactAmountIn(token, address(pathUsd), bidAmount, 0);
        vm.stopPrank();

        // Maker (this contract) should have tokens in DEX balance
        uint128 dexBalance = dex.balanceOf(address(this), token);
        assertGt(dexBalance, 0);
    }

    function test_TickBoundsEnforced() public onlyTempo {
        uint128 amount = 10_000e6;
        ITIP20(token).approve(address(dex), amount);

        int16 maxTick = dex.MAX_TICK();

        // vm.expectRevert doesn't work with precompiles, use try/catch
        try dex.place(token, amount, false, maxTick + 1) {
            fail("Expected revert for tick out of bounds");
        } catch {
            // Expected - tick out of bounds
        }
    }

    function test_FlipOrderReverses() public onlyTempo {
        // Place ask flip order: sell tokens, flip to bid when filled
        uint128 amount = 1_000e6;
        int16 askTick = 50; // Selling above peg
        int16 flipToBidTick = -50; // Flip to bid below peg

        ITIP20(token).approve(address(dex), amount);
        uint128 askOrderId = dex.placeFlip(token, amount, false, askTick, flipToBidTick);

        // Fund and execute a buy that fills the order
        uint128 buyAmount = 2_000e6;
        _fundWithPathUsd(trader, buyAmount);

        vm.startPrank(trader);
        pathUsd.approve(address(dex), buyAmount);
        dex.swapExactAmountOut(address(pathUsd), token, amount, buyAmount);
        vm.stopPrank();

        // Original order should be gone (use try/catch for precompiles)
        try dex.getOrder(askOrderId) {
            fail("Expected revert for non-existent order");
        } catch {
            // Expected - original order no longer exists
        }

        // Check tick level for the flipped bid
        (uint128 head,, uint128 totalLiquidity) = dex.getTickLevel(token, flipToBidTick, true);

        // Flipped order should exist at the flip tick
        assertGt(head, 0, "Flipped order should exist");
        assertGt(totalLiquidity, 0, "Flipped order should have liquidity");

        // Verify it's a bid at the flip tick
        IStablecoinDEX.Order memory flippedOrder = dex.getOrder(head);
        assertEq(flippedOrder.tick, flipToBidTick);
        assertTrue(flippedOrder.isBid);
        assertEq(flippedOrder.maker, address(this));
    }

    function test_QuoteFunctions() public onlyTempo {
        // Place some liquidity
        uint128 askAmount = 100_000e6;
        ITIP20(token).approve(address(dex), askAmount);
        dex.place(token, askAmount, false, 0);

        // Quote exact in
        uint128 amountIn = 10_000e6;
        uint128 quotedOut = dex.quoteSwapExactAmountIn(address(pathUsd), token, amountIn);
        assertGt(quotedOut, 0);

        // Quote exact out
        uint128 amountOut = 10_000e6;
        uint128 quotedIn = dex.quoteSwapExactAmountOut(address(pathUsd), token, amountOut);
        assertGt(quotedIn, 0);
    }

    function test_TickToPrice() public onlyTempo {
        // Tick 0 should be peg price (1:1)
        uint32 pegPrice = dex.tickToPrice(0);
        uint32 priceScale = dex.PRICE_SCALE();
        assertEq(pegPrice, priceScale);

        // Positive tick = higher price
        uint32 higherPrice = dex.tickToPrice(100);
        assertGt(higherPrice, pegPrice);

        // Negative tick = lower price
        uint32 lowerPrice = dex.tickToPrice(-100);
        assertLt(lowerPrice, pegPrice);
    }

    function test_PriceToTick() public onlyTempo {
        uint32 priceScale = dex.PRICE_SCALE();

        // Peg price should give tick 0
        int16 pegTick = dex.priceToTick(priceScale);
        assertEq(pegTick, 0);
    }
}
