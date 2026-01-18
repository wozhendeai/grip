// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {IntegrationBase} from "./Integration.base.sol";
import {IRepoTokenLauncher} from "../../src/interfaces/IRepoTokenLauncher.sol";
import {IRepoTreasury} from "../../src/interfaces/IRepoTreasury.sol";
import {IMaintainerClaims} from "../../src/interfaces/IMaintainerClaims.sol";

/// @title MaintainerFlowTest
/// @notice Integration tests for maintainer verification and withdrawal
contract MaintainerFlowTest is IntegrationBase {
    bytes32 internal repoHash;
    address internal repoToken;
    IRepoTreasury internal treasury;

    // Test maintainer data
    bytes32 internal githubIdHash;

    function setUp() public override {
        super.setUp();
        if (block.chainid != TEMPO_CHAIN_ID) return;
        if (address(launcher) == address(0) || address(claims) == address(0)) return;

        repoHash = _uniqueRepoHash("maintainer-test");
        githubIdHash = keccak256(abi.encodePacked("github:12345"));

        _setupLaunchedToken();
    }

    function _setupLaunchedToken() internal {
        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash,
            tokenName: "Maintainer Test Token",
            tokenSymbol: "MAINT",
            minRaise: 1000e6,
            duration: 1 hours
        });
        launcher.createLaunch(config);

        // Fund the launch (50k PathUSD to have enough for bid orders in tests)
        _depositAs(user1, repoHash, 50_000e6);

        IRepoTokenLauncher.LaunchState memory state = launcher.getLaunchState(repoHash);
        vm.warp(state.deadline + 1);
        launcher.finalize(repoHash);

        state = launcher.getLaunchState(repoHash);
        repoToken = state.tokenAddress;
        treasury = IRepoTreasury(state.treasuryAddress);
    }

    function test_RegisterVerification() public onlyTempo requiresDeployedContracts {
        uint64 expiry = uint64(block.timestamp + 30 days);

        bytes memory signature = signVerification(backendKey, repoHash, githubIdHash, maintainer, expiry);

        claims.registerVerification(repoHash, githubIdHash, maintainer, expiry, signature);

        assertTrue(claims.isVerifiedMaintainer(repoHash, maintainer));

        IMaintainerClaims.Verification memory verification = claims.getVerification(repoHash, maintainer);
        assertEq(verification.githubUserIdHash, githubIdHash);
        assertEq(verification.wallet, maintainer);
        assertEq(verification.expiry, expiry);
        assertTrue(verification.active);
    }

    function test_RegisterVerification_InvalidSignatureReverts() public onlyTempo requiresDeployedContracts {
        uint64 expiry = uint64(block.timestamp + 30 days);

        // Sign with wrong key
        uint256 wrongKey = 0xDEAD;
        bytes memory badSig = signVerification(wrongKey, repoHash, githubIdHash, maintainer, expiry);

        vm.expectRevert(IMaintainerClaims.InvalidSignature.selector);
        claims.registerVerification(repoHash, githubIdHash, maintainer, expiry, badSig);
    }

    function test_RegisterVerification_ExpiredSignatureReverts() public onlyTempo requiresDeployedContracts {
        uint64 expiry = uint64(block.timestamp - 1); // Already expired

        bytes memory signature = signVerification(backendKey, repoHash, githubIdHash, maintainer, expiry);

        vm.expectRevert(IMaintainerClaims.SignatureExpired.selector);
        claims.registerVerification(repoHash, githubIdHash, maintainer, expiry, signature);
    }

    function test_VerificationExpiry() public onlyTempo requiresDeployedContracts {
        uint64 expiry = uint64(block.timestamp + 1 days);

        bytes memory signature = signVerification(backendKey, repoHash, githubIdHash, maintainer, expiry);

        claims.registerVerification(repoHash, githubIdHash, maintainer, expiry, signature);

        assertTrue(claims.isVerifiedMaintainer(repoHash, maintainer));

        // Warp past expiry
        vm.warp(expiry + 1);

        assertFalse(claims.isVerifiedMaintainer(repoHash, maintainer));
    }

    function test_RevokeVerification() public onlyTempo requiresDeployedContracts {
        // First register
        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes memory signature = signVerification(backendKey, repoHash, githubIdHash, maintainer, expiry);

        claims.registerVerification(repoHash, githubIdHash, maintainer, expiry, signature);

        assertTrue(claims.isVerifiedMaintainer(repoHash, maintainer));

        // Maintainer revokes own verification
        vm.prank(maintainer);
        claims.revokeVerification(repoHash, maintainer);

        assertFalse(claims.isVerifiedMaintainer(repoHash, maintainer));

        IMaintainerClaims.Verification memory verification = claims.getVerification(repoHash, maintainer);
        assertFalse(verification.active);
    }

    function test_GetMaintainers() public onlyTempo requiresDeployedContracts {
        // Register multiple maintainers
        address maintainer2 = makeAddr("maintainer2");
        bytes32 githubIdHash2 = keccak256(abi.encodePacked("github:67890"));
        uint64 expiry = uint64(block.timestamp + 30 days);

        bytes memory sig1 = signVerification(backendKey, repoHash, githubIdHash, maintainer, expiry);
        bytes memory sig2 = signVerification(backendKey, repoHash, githubIdHash2, maintainer2, expiry);

        claims.registerVerification(repoHash, githubIdHash, maintainer, expiry, sig1);
        claims.registerVerification(repoHash, githubIdHash2, maintainer2, expiry, sig2);

        address[] memory maintainers = claims.getMaintainers(repoHash);
        assertGe(maintainers.length, 2);

        bool foundMaintainer1 = false;
        bool foundMaintainer2 = false;
        for (uint256 i = 0; i < maintainers.length; i++) {
            if (maintainers[i] == maintainer) foundMaintainer1 = true;
            if (maintainers[i] == maintainer2) foundMaintainer2 = true;
        }
        assertTrue(foundMaintainer1);
        assertTrue(foundMaintainer2);
    }

    function test_WithdrawMaintainerFees() public onlyTempo requiresDeployedContracts {
        // Setup: verify maintainer and fund the pool
        _verifyMaintainer(maintainer, githubIdHash);
        _fundMaintainerPool();

        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        uint256 poolBefore = state.maintainerPool;

        if (poolBefore == 0) return; // Skip if no funds

        uint256 withdrawAmount = poolBefore / 2;
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes memory withdrawSig = signWithdrawal(
            backendKey,
            repoHash,
            maintainer,
            maintainer, // to self
            withdrawAmount,
            expiry
        );

        uint256 balanceBefore = pathUsd.balanceOf(maintainer);

        vm.prank(maintainer);
        treasury.withdrawMaintainerFees(maintainer, withdrawAmount, expiry, withdrawSig);

        assertEq(pathUsd.balanceOf(maintainer), balanceBefore + withdrawAmount);

        state = treasury.getTreasuryState();
        assertEq(state.maintainerPool, poolBefore - withdrawAmount);
    }

    function test_WithdrawToOtherAddress() public onlyTempo requiresDeployedContracts {
        _verifyMaintainer(maintainer, githubIdHash);
        _fundMaintainerPool();

        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        if (state.maintainerPool == 0) return;

        address recipient = makeAddr("recipient");
        uint256 withdrawAmount = state.maintainerPool / 2;
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes memory withdrawSig = signWithdrawal(
            backendKey,
            repoHash,
            maintainer,
            recipient, // different recipient
            withdrawAmount,
            expiry
        );

        uint256 recipientBefore = pathUsd.balanceOf(recipient);

        vm.prank(maintainer);
        treasury.withdrawMaintainerFees(recipient, withdrawAmount, expiry, withdrawSig);

        assertEq(pathUsd.balanceOf(recipient), recipientBefore + withdrawAmount);
    }

    function test_WithdrawRequiresVerification() public onlyTempo requiresDeployedContracts {
        _fundMaintainerPool();

        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        if (state.maintainerPool == 0) return;

        uint256 withdrawAmount = 100e6;
        uint64 expiry = uint64(block.timestamp + 1 hours);

        // Sign for unverified user
        address unverified = makeAddr("unverified");
        bytes memory withdrawSig = signWithdrawal(backendKey, repoHash, unverified, unverified, withdrawAmount, expiry);

        vm.prank(unverified);
        vm.expectRevert(); // Should fail - not verified
        treasury.withdrawMaintainerFees(unverified, withdrawAmount, expiry, withdrawSig);
    }

    function test_WithdrawExpiredSignatureReverts() public onlyTempo requiresDeployedContracts {
        _verifyMaintainer(maintainer, githubIdHash);
        _fundMaintainerPool();

        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        if (state.maintainerPool == 0) return;

        uint256 withdrawAmount = 100e6;
        uint64 expiry = uint64(block.timestamp - 1); // Already expired

        bytes memory withdrawSig = signWithdrawal(backendKey, repoHash, maintainer, maintainer, withdrawAmount, expiry);

        vm.prank(maintainer);
        vm.expectRevert(IRepoTreasury.SignatureExpired.selector);
        treasury.withdrawMaintainerFees(maintainer, withdrawAmount, expiry, withdrawSig);
    }

    function test_WithdrawInsufficientBalanceReverts() public onlyTempo requiresDeployedContracts {
        _verifyMaintainer(maintainer, githubIdHash);
        _fundMaintainerPool();

        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        uint256 tooMuch = state.maintainerPool + 1e6;
        uint64 expiry = uint64(block.timestamp + 1 hours);

        bytes memory withdrawSig = signWithdrawal(backendKey, repoHash, maintainer, maintainer, tooMuch, expiry);

        vm.prank(maintainer);
        vm.expectRevert(IRepoTreasury.InsufficientBalance.selector);
        treasury.withdrawMaintainerFees(maintainer, tooMuch, expiry, withdrawSig);
    }

    function test_FullMaintainerFlow() public onlyTempo requiresDeployedContracts {
        // 1. Backend verifies maintainer (off-chain GitHub OAuth)
        // 2. Maintainer registers verification on-chain
        uint64 verifyExpiry = uint64(block.timestamp + 30 days);
        bytes memory verifySig = signVerification(backendKey, repoHash, githubIdHash, maintainer, verifyExpiry);

        claims.registerVerification(repoHash, githubIdHash, maintainer, verifyExpiry, verifySig);

        assertTrue(claims.isVerifiedMaintainer(repoHash, maintainer));

        // 3. Generate revenue and split
        _fundMaintainerPool();

        IRepoTreasury.TreasuryState memory state = treasury.getTreasuryState();
        if (state.maintainerPool == 0) return;

        // 4. Maintainer withdraws fees
        uint256 withdrawAmount = state.maintainerPool;
        uint64 withdrawExpiry = uint64(block.timestamp + 1 hours);

        bytes memory withdrawSig =
            signWithdrawal(backendKey, repoHash, maintainer, maintainer, withdrawAmount, withdrawExpiry);

        uint256 balanceBefore = pathUsd.balanceOf(maintainer);

        vm.prank(maintainer);
        treasury.withdrawMaintainerFees(maintainer, withdrawAmount, withdrawExpiry, withdrawSig);

        assertEq(pathUsd.balanceOf(maintainer), balanceBefore + withdrawAmount);

        // 5. Verify pool is empty
        state = treasury.getTreasuryState();
        assertEq(state.maintainerPool, 0);
    }

    // ============ Helpers ============

    function _verifyMaintainer(address wallet, bytes32 ghIdHash) internal {
        uint64 expiry = uint64(block.timestamp + 30 days);
        bytes memory sig = signVerification(backendKey, repoHash, ghIdHash, wallet, expiry);
        claims.registerVerification(repoHash, ghIdHash, wallet, expiry, sig);
    }

    function _fundMaintainerPool() internal {
        // Place flip order and generate trades
        uint128 bidAmount = 5_000e6;
        vm.prank(backend);
        treasury.placeFlipOrder(bidAmount, -50, 50, true);

        // User claims and sells tokens
        vm.prank(user1);
        launcher.claimTokens(repoHash);

        uint256 userTokens = ITIP20(repoToken).balanceOf(user1);
        if (userTokens > 1000e6) {
            vm.startPrank(user1);
            ITIP20(repoToken).approve(address(dex), 1000e6);
            dex.swapExactAmountIn(repoToken, address(pathUsd), 1000e6, 0);
            vm.stopPrank();
        }

        // Harvest and split
        treasury.harvestRevenue();
        treasury.executeSplit();
    }
}
