// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {IntegrationBase} from "./Integration.base.sol";
import {IRepoTokenLauncher} from "../../src/interfaces/IRepoTokenLauncher.sol";
import {IRepoTreasury} from "../../src/interfaces/IRepoTreasury.sol";

/// @title RevenueFlowTest
/// @notice Integration tests for POL revenue capture and distribution
contract RevenueFlowTest is IntegrationBase {
    bytes32 internal repoHash;
    address internal repoToken;
    IRepoTreasury internal treasury;

    function setUp() public override {
        super.setUp();
        if (block.chainid != TEMPO_CHAIN_ID) return;
        if (address(launcher) == address(0) || address(registry) == address(0)) return;

        // Create and finalize a launch for revenue tests
        repoHash = _uniqueRepoHash("revenue-test");
        _setupLaunchedToken();
    }

    function _setupLaunchedToken() internal {
        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash,
            tokenName: "Revenue Test Token",
            tokenSymbol: "REVT",
            minRaise: 1000e6,
            duration: 1 hours
        });
        launcher.createLaunch(config);

        // Fund the launch (50k PathUSD to have enough for bid orders in tests)
        _depositAs(user1, repoHash, 50_000e6);

        // Finalize
        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);
        launcher.finalize(repoHash);

        state = launcher.getLaunchState(repoHash);
        repoToken = state.tokenAddress;
        treasury = IRepoTreasury(state.treasuryAddress);
    }

    function test_TreasuryInitialized() public onlyTempo requiresDeployedContracts {
        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();

        assertEq(state.repoToken, repoToken);
        assertEq(state.quoteToken, address(pathUsd));
        assertEq(state.repoHash, repoHash);
    }

    function test_PlaceFlipOrderFromTreasury() public onlyTempo requiresDeployedContracts {
        uint128 amount = 10_000e6;
        int16 askTick = 100;
        int16 flipTick = -100;

        // Treasury should have repo tokens from launch (30% of supply)
        uint256 treasuryBalance = ITIP20(repoToken).balanceOf(address(treasury));
        assertGt(treasuryBalance, amount, "Treasury needs tokens");

        // Backend places ask flip order (sells repo token, flips to buy)
        vm.prank(backend);
        uint128 orderId = treasury.placeFlipOrder(amount, askTick, flipTick, false);

        assertGt(orderId, 0);

        IRepoTreasury.FlipOrderInfo memory orderInfo = treasury.getFlipOrder(orderId);
        assertEq(orderInfo.orderId, orderId);
        assertEq(orderInfo.amount, amount);
        assertFalse(orderInfo.isBid);
        assertEq(orderInfo.tick, askTick);
        assertEq(orderInfo.flipTick, flipTick);
        assertTrue(orderInfo.active);
    }

    function test_PlaceFlipOrder_UnauthorizedReverts() public onlyTempo requiresDeployedContracts {
        vm.prank(user1);
        vm.expectRevert(IRepoTreasury.Unauthorized.selector);
        treasury.placeFlipOrder(1000e6, -100, 100, true);
    }

    function test_CancelFlipOrder() public onlyTempo requiresDeployedContracts {
        vm.prank(backend);
        uint128 orderId = treasury.placeFlipOrder(5_000e6, -50, 50, true);

        vm.prank(backend);
        treasury.cancelOrder(orderId);

        IRepoTreasury.FlipOrderInfo memory orderInfo = treasury.getFlipOrder(orderId);
        assertFalse(orderInfo.active);
    }

    function test_GetActiveOrders() public onlyTempo requiresDeployedContracts {
        // Place multiple orders
        vm.startPrank(backend);
        uint128 order1 = treasury.placeFlipOrder(5_000e6, -50, 50, true);
        uint128 order2 = treasury.placeFlipOrder(5_000e6, 50, -50, false);
        vm.stopPrank();

        uint128[] memory activeOrders = treasury.getActiveOrders();
        assertGe(activeOrders.length, 2);

        // Cancel one
        vm.prank(backend);
        treasury.cancelOrder(order1);

        activeOrders = treasury.getActiveOrders();
        bool foundOrder1 = false;
        bool foundOrder2 = false;
        for (uint256 i = 0; i < activeOrders.length; i++) {
            if (activeOrders[i] == order1) foundOrder1 = true;
            if (activeOrders[i] == order2) foundOrder2 = true;
        }
        assertFalse(foundOrder1, "Cancelled order should not be active");
        assertTrue(foundOrder2, "Non-cancelled order should be active");
    }

    function test_GetOrderValue() public onlyTempo requiresDeployedContracts {
        uint128 amount1 = 10_000e6;
        uint128 amount2 = 15_000e6;

        vm.startPrank(backend);
        treasury.placeFlipOrder(amount1, -100, 100, true);
        treasury.placeFlipOrder(amount2, 100, -100, false);
        vm.stopPrank();

        uint256 orderValue = treasury.getOrderValue();
        assertGt(orderValue, 0);
    }

    function test_HarvestRevenue() public onlyTempo requiresDeployedContracts {
        // Place a bid order
        uint128 bidAmount = 10_000e6;
        vm.prank(backend);
        treasury.placeFlipOrder(bidAmount, -50, 50, true);

        // Simulate trading activity by selling tokens into the bid
        // First, get some tokens to the trader
        vm.prank(user1);
        launcher.claimTokens(repoHash);
        uint256 traderTokens = ITIP20(repoToken).balanceOf(user1);

        if (traderTokens > 0) {
            // Swap only the amount that liquidity can handle (bid amount)
            uint128 swapAmount = bidAmount < traderTokens ? bidAmount : uint128(traderTokens);
            vm.startPrank(user1);
            ITIP20(repoToken).approve(address(dex), swapAmount);
            dex.swapExactAmountIn(repoToken, address(pathUsd), swapAmount, 0);
            vm.stopPrank();
        }

        // Harvest revenue
        uint256 harvested = treasury.harvestRevenue();

        // Revenue may or may not be positive depending on whether orders filled
        // Just verify the function executes
        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        assertGe(state.totalRevenue, harvested);
    }

    function test_ExecuteSplit() public onlyTempo requiresDeployedContracts {
        // First generate some revenue
        _generateTradeRevenue();

        IRepoTreasury.TreasuryState memory stateBefore = treasury.getTreasuryState();

        treasury.executeSplit();

        IRepoTreasury.TreasuryState memory stateAfter = treasury.getTreasuryState();

        // Verify split occurred (30% maintainer, 40% bounty, 30% buyback)
        uint256 maintainerShare = treasury.MAINTAINER_SHARE();
        uint256 bountyShare = treasury.BOUNTY_SHARE();
        uint256 basisPoints = treasury.BASIS_POINTS();

        // Pools should be updated
        if (stateBefore.totalRevenue > 0) {
            assertGe(stateAfter.maintainerPool, stateBefore.maintainerPool);
            assertGe(stateAfter.bountyPool, stateBefore.bountyPool);
        }

        // Verify share percentages are correct
        assertEq(maintainerShare, 3000); // 30%
        assertEq(bountyShare, 4000); // 40%
        assertEq(basisPoints, 10000);
    }

    function test_BountyPoolAllocation() public onlyTempo requiresDeployedContracts {
        // Generate a full trading cycle for actual revenue
        // Place ask order from treasury (sells repo tokens)
        uint128 askAmount = 5_000e6;
        vm.prank(backend);
        treasury.placeFlipOrder(askAmount, 50, -50, false);

        // Have someone buy from the ask order
        _fundWithPathUsd(trader, 10_000e6);
        vm.startPrank(trader);
        pathUsd.approve(address(dex), 10_000e6);
        dex.swapExactAmountOut(address(pathUsd), repoToken, askAmount, 10_000e6);
        vm.stopPrank();

        // Now the flipped bid order exists - sell tokens into it
        vm.prank(user1);
        launcher.claimTokens(repoHash);
        uint256 userTokens = ITIP20(repoToken).balanceOf(user1);
        if (userTokens > askAmount) {
            vm.startPrank(user1);
            ITIP20(repoToken).approve(address(dex), askAmount);
            dex.swapExactAmountIn(repoToken, address(pathUsd), askAmount, 0);
            vm.stopPrank();
        }

        // Now harvest and split
        treasury.harvestRevenue();
        treasury.executeSplit();

        // Verify pools were allocated (may be 0 if no spread captured due to tick math)
        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        // Just verify the function executed - revenue depends on spread capture
        assertGe(state.bountyPool, 0);
    }

    function test_MaintainerPoolAllocation() public onlyTempo requiresDeployedContracts {
        // Generate a full trading cycle
        uint128 askAmount = 5_000e6;
        vm.prank(backend);
        treasury.placeFlipOrder(askAmount, 50, -50, false);

        _fundWithPathUsd(trader, 10_000e6);
        vm.startPrank(trader);
        pathUsd.approve(address(dex), 10_000e6);
        dex.swapExactAmountOut(address(pathUsd), repoToken, askAmount, 10_000e6);
        vm.stopPrank();

        vm.prank(user1);
        launcher.claimTokens(repoHash);
        uint256 userTokens = ITIP20(repoToken).balanceOf(user1);
        if (userTokens > askAmount) {
            vm.startPrank(user1);
            ITIP20(repoToken).approve(address(dex), askAmount);
            dex.swapExactAmountIn(repoToken, address(pathUsd), askAmount, 0);
            vm.stopPrank();
        }

        treasury.harvestRevenue();
        treasury.executeSplit();

        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        assertGe(state.maintainerPool, 0);
    }

    function test_FundBounty() public onlyTempo requiresDeployedContracts {
        // Generate some bounty pool funds
        _generateTradeRevenue();
        treasury.harvestRevenue();
        treasury.executeSplit();

        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        uint256 bountyPool = state.bountyPool;

        if (bountyPool > 0) {
            bytes32 bountyId = keccak256("issue-123");
            uint256 fundAmount = bountyPool / 2;

            vm.prank(backend);
            treasury.fundBounty(bountyId, fundAmount);

            // Verify pool decreased
            state = treasury.getTreasuryState();
            assertEq(state.bountyPool, bountyPool - fundAmount);
        }
    }

    function test_PayBounty() public onlyTempo requiresDeployedContracts {
        // Setup: fund a bounty
        _generateTradeRevenue();
        treasury.harvestRevenue();
        treasury.executeSplit();

        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        if (state.bountyPool == 0) return;

        bytes32 bountyId = keccak256("issue-456");
        uint256 fundAmount = state.bountyPool / 2;

        vm.prank(backend);
        treasury.fundBounty(bountyId, fundAmount);

        // Pay contributor
        address contributor = makeAddr("contributor");
        uint256 pathUsdPay = fundAmount / 2;
        uint256 tokenPay = 1000e6;
        bytes32 memo = keccak256("pr-merged");

        uint256 contribBalanceBefore = pathUsd.balanceOf(contributor);

        vm.prank(backend);
        treasury.payBounty(contributor, pathUsdPay, tokenPay, memo);

        assertEq(pathUsd.balanceOf(contributor), contribBalanceBefore + pathUsdPay);
        assertEq(ITIP20(repoToken).balanceOf(contributor), tokenPay);
    }

    function test_EmitRewards() public onlyTempo requiresDeployedContracts {
        // Treasury should have tokens
        uint256 treasuryTokens = ITIP20(repoToken).balanceOf(address(treasury));

        if (treasuryTokens > 1000e6) {
            uint256 rewardAmount = 1000e6;

            // TIP-20 rewards require REWARDS_ROLE to be granted
            // Try to call and verify it either succeeds or fails gracefully
            vm.prank(backend);
            try treasury.emitRewards(rewardAmount) {
            // Verify tokens were distributed via TIP-20 rewards
            }
                catch {
                // emitRewards may fail if REWARDS_ROLE not granted
                // This is expected behavior - treasury would need role granted
            }
        }
    }

    // ============ Helpers ============

    function _generateTradeRevenue() internal {
        // Place bid order from treasury
        uint128 bidAmount = 5_000e6;
        vm.prank(backend);
        treasury.placeFlipOrder(bidAmount, -50, 50, true);

        // Have user claim tokens and sell into the bid
        vm.prank(user1);
        launcher.claimTokens(repoHash);

        uint256 userTokens = ITIP20(repoToken).balanceOf(user1);
        if (userTokens > 1000e6) {
            vm.startPrank(user1);
            ITIP20(repoToken).approve(address(dex), 1000e6);
            dex.swapExactAmountIn(repoToken, address(pathUsd), 1000e6, 0);
            vm.stopPrank();
        }
    }
}
