// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {IntegrationBase} from "./Integration.base.sol";
import {IRepoTokenLauncher} from "../../src/interfaces/IRepoTokenLauncher.sol";
import {IRepoTokenRegistry} from "../../src/interfaces/IRepoTokenRegistry.sol";

/// @title LaunchFlowTest
/// @notice Integration tests for full launch lifecycle
contract LaunchFlowTest is IntegrationBase {
    uint256 internal constant DEFAULT_MIN_RAISE = 1000e6; // 1000 PathUSD
    uint64 internal constant SHORT_DURATION = 1 hours; // Short for testing

    function test_CreateLaunch() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("create-launch-test");

        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash,
            tokenName: "Create Launch Test",
            tokenSymbol: "CLT",
            minRaise: DEFAULT_MIN_RAISE,
            duration: SHORT_DURATION
        });

        launcher.createLaunch(config);

        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        assertEq(state.repoHash, repoHash);
        assertEq(state.tokenName, "Create Launch Test");
        assertEq(state.tokenSymbol, "CLT");
        assertEq(state.minRaise, DEFAULT_MIN_RAISE);
        assertFalse(state.finalized);
        assertFalse(state.failed);
        assertEq(state.tokenAddress, address(0));

        // Registry should show Launching status
        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Launching));
    }

    function test_CreateLaunch_RevertsForDuplicate() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("duplicate-test");

        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash,
            tokenName: "First Launch",
            tokenSymbol: "FIRST",
            minRaise: DEFAULT_MIN_RAISE,
            duration: SHORT_DURATION
        });

        launcher.createLaunch(config);

        // Try to create again with same repoHash
        vm.expectRevert(IRepoTokenLauncher.LaunchAlreadyExists.selector);
        launcher.createLaunch(config);
    }

    function test_DepositDuringLaunch() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("deposit-test");
        _createTestLaunch(repoHash, "Deposit Test", "DEP");

        uint256 depositAmount = 500e6;
        _depositAs(user1, repoHash, depositAmount);

        IRepoTokenLauncher.Deposit memory deposit = launcher.getDeposit(repoHash, user1);
        assertEq(deposit.amount, depositAmount);
        assertFalse(deposit.claimed);

        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        assertEq(state.totalRaised, depositAmount);
    }

    function test_MultipleDepositors() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("multi-deposit-test");
        _createTestLaunch(repoHash, "Multi Deposit", "MULT");

        _depositAs(user1, repoHash, 300e6);
        _depositAs(user2, repoHash, 400e6);
        _depositAs(user3, repoHash, 500e6);

        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        assertEq(state.totalRaised, 1200e6);

        // Check individual deposits
        assertEq(launcher.getDeposit(repoHash, user1).amount, 300e6);
        assertEq(launcher.getDeposit(repoHash, user2).amount, 400e6);
        assertEq(launcher.getDeposit(repoHash, user3).amount, 500e6);
    }

    function test_DepositAfterDeadline_Reverts() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("late-deposit-test");
        _createTestLaunch(repoHash, "Late Deposit", "LATE");

        // Warp past deadline
        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);

        vm.startPrank(user1);
        pathUsd.approve(address(launcher), 100e6);
        vm.expectRevert(IRepoTokenLauncher.LaunchNotActive.selector);
        launcher.deposit(repoHash, 100e6);
        vm.stopPrank();
    }

    function test_FinalizeSuccessfulLaunch() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("finalize-success-test");
        _createTestLaunch(repoHash, "Finalize Success", "FSUC");

        // Deposit enough to meet minimum
        _depositAs(user1, repoHash, 600e6);
        _depositAs(user2, repoHash, 600e6); // Total: 1200e6 > 1000e6 min

        // Warp past deadline
        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);

        // Finalize
        launcher.finalize(repoHash);

        // Check launch state
        state = launcher.getLaunchState(repoHash);
        assertTrue(state.finalized);
        assertFalse(state.failed);
        assertTrue(state.tokenAddress != address(0));
        assertTrue(state.treasuryAddress != address(0));

        // Token should be valid TIP-20
        assertTrue(factory.isTIP20(state.tokenAddress));

        // Registry should show Active
        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Active));
        assertEq(info.tokenAddress, state.tokenAddress);
        assertEq(info.treasuryAddress, state.treasuryAddress);
    }

    function test_FinalizeFailedLaunch() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("finalize-fail-test");
        _createTestLaunch(repoHash, "Finalize Fail", "FFAL");

        // Deposit less than minimum
        _depositAs(user1, repoHash, 500e6); // < 1000e6 min

        // Warp past deadline
        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);

        // Finalize
        launcher.finalize(repoHash);

        // Check launch state
        state = launcher.getLaunchState(repoHash);
        assertTrue(state.finalized);
        assertTrue(state.failed);
        assertEq(state.tokenAddress, address(0));

        // Registry should show Failed
        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Failed));
    }

    function test_ClaimTokens() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("claim-test");
        _createTestLaunch(repoHash, "Claim Test", "CLMT");

        // Users deposit
        _depositAs(user1, repoHash, 500e6);
        _depositAs(user2, repoHash, 300e6);
        _depositAs(user3, repoHash, 700e6); // Total: 1500e6

        // Finalize
        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);
        launcher.finalize(repoHash);

        state = launcher.getLaunchState(repoHash);
        address tokenAddr = state.tokenAddress;

        // User1 claims
        uint256 expectedUser1 = launcher.calculateAllocation(repoHash, user1);
        vm.prank(user1);
        launcher.claimTokens(repoHash);

        assertEq(ITIP20(tokenAddr).balanceOf(user1), expectedUser1);

        // Verify deposit marked as claimed
        assertTrue(launcher.getDeposit(repoHash, user1).claimed);

        // User2 claims
        uint256 expectedUser2 = launcher.calculateAllocation(repoHash, user2);
        vm.prank(user2);
        launcher.claimTokens(repoHash);

        assertEq(ITIP20(tokenAddr).balanceOf(user2), expectedUser2);
    }

    function test_ClaimTokens_RevertsIfAlreadyClaimed() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("double-claim-test");
        _createTestLaunch(repoHash, "Double Claim", "DCLM");

        _depositAs(user1, repoHash, 1000e6);

        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);
        launcher.finalize(repoHash);

        vm.prank(user1);
        launcher.claimTokens(repoHash);

        vm.prank(user1);
        vm.expectRevert(IRepoTokenLauncher.AlreadyClaimed.selector);
        launcher.claimTokens(repoHash);
    }

    function test_RefundAfterFailure() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("refund-test");
        _createTestLaunch(repoHash, "Refund Test", "RFND");

        uint256 depositAmount = 500e6;
        _depositAs(user1, repoHash, depositAmount);

        // Finalize (will fail due to under min)
        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);
        launcher.finalize(repoHash);

        uint256 balanceBefore = pathUsd.balanceOf(user1);

        vm.prank(user1);
        launcher.refund(repoHash);

        assertEq(pathUsd.balanceOf(user1), balanceBefore + depositAmount);

        // Deposit should be cleared
        assertEq(launcher.getDeposit(repoHash, user1).amount, 0);
    }

    function test_RefundOnSuccessfulLaunch_Reverts() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("refund-success-test");
        _createTestLaunch(repoHash, "No Refund", "NORF");

        _depositAs(user1, repoHash, 1000e6);

        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);
        launcher.finalize(repoHash);

        vm.prank(user1);
        vm.expectRevert(IRepoTokenLauncher.LaunchNotFailed.selector);
        launcher.refund(repoHash);
    }

    function test_CalculateAllocation() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("allocation-test");
        _createTestLaunch(repoHash, "Allocation Test", "ALOC");

        _depositAs(user1, repoHash, 500e6);
        _depositAs(user2, repoHash, 500e6); // 50/50 split

        // Finalize
        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);
        launcher.finalize(repoHash);

        uint256 user1Allocation = launcher.calculateAllocation(repoHash, user1);
        uint256 user2Allocation = launcher.calculateAllocation(repoHash, user2);

        // Should be equal
        assertEq(user1Allocation, user2Allocation);

        // Total supporter allocation is 70% of 100M = 70M tokens
        uint256 totalSupply = launcher.TOTAL_SUPPLY();
        uint256 supporterPercent = launcher.SUPPORTER_ALLOCATION();
        uint256 supporterTokens = (totalSupply * supporterPercent) / 100;

        // Each user should get ~35M (half of 70M)
        assertApproxEqRel(user1Allocation, supporterTokens / 2, 0.01e18);
    }

    function test_FullLaunchCycle() public onlyTempo requiresDeployedContracts {
        bytes32 repoHash = _uniqueRepoHash("full-cycle-test");

        // 1. Create launch
        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash, tokenName: "Full Cycle Token", tokenSymbol: "FULL", minRaise: 1000e6, duration: 1 hours
        });
        launcher.createLaunch(config);

        // 2. Multiple deposits
        _depositAs(user1, repoHash, 500e6);
        _depositAs(user2, repoHash, 300e6);
        _depositAs(user3, repoHash, 700e6);

        // 3. Verify state during launch
        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        assertEq(state.totalRaised, 1500e6);
        assertFalse(state.finalized);

        // 4. Wait for deadline
        vm.warp(state.deadline + 1);

        // 5. Finalize
        launcher.finalize(repoHash);

        // 6. Verify success
        state = launcher.getLaunchState(repoHash);
        assertTrue(state.finalized);
        assertFalse(state.failed);
        assertTrue(factory.isTIP20(state.tokenAddress));

        // 7. All users claim
        vm.prank(user1);
        launcher.claimTokens(repoHash);

        vm.prank(user2);
        launcher.claimTokens(repoHash);

        vm.prank(user3);
        launcher.claimTokens(repoHash);

        // 8. Verify allocations
        ITIP20 token = ITIP20(state.tokenAddress);
        assertGt(token.balanceOf(user1), 0);
        assertGt(token.balanceOf(user2), 0);
        assertGt(token.balanceOf(user3), 0);

        // User3 deposited most, should have most tokens
        assertGt(token.balanceOf(user3), token.balanceOf(user1));
        assertGt(token.balanceOf(user3), token.balanceOf(user2));
    }

    // ============ Helpers ============

    function _createTestLaunch(bytes32 repoHash, string memory name, string memory symbol) internal {
        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash,
            tokenName: name,
            tokenSymbol: symbol,
            minRaise: DEFAULT_MIN_RAISE,
            duration: SHORT_DURATION
        });
        launcher.createLaunch(config);
    }
}
