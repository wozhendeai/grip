// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/MaintainerClaims.sol";
import "../src/RepoTokenRegistry.sol";
import "../src/interfaces/IMaintainerClaims.sol";
import "./utils/TestBase.sol";

contract MaintainerClaimsTest is TestBase {
    MaintainerClaims private claims;
    RepoTokenRegistry private registry;

    address private admin = address(0xA11CE);
    uint256 private backendKey = 0xB0B;
    address private backendSigner;

    bytes32 private repoHash = keccak256(abi.encodePacked("owner", "/", "repo"));
    bytes32 private githubUserIdHash = keccak256(abi.encodePacked("user-id"));

    function setUp() public {
        backendSigner = vm.addr(backendKey);
        registry = new RepoTokenRegistry(admin);
        claims = new MaintainerClaims(admin, backendSigner, address(registry));
    }

    function test_RegisterVerificationAndExpiry() public {
        vm.warp(1000);
        address wallet = address(0x1234);
        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes memory signature = signVerification(backendKey, repoHash, githubUserIdHash, wallet, expiry);

        claims.registerVerification(repoHash, githubUserIdHash, wallet, expiry, signature);

        assertTrue(claims.isVerifiedMaintainer(repoHash, wallet), "verified");
        IMaintainerClaims.Verification memory v = claims.getVerification(repoHash, wallet);
        assertEq(v.wallet, wallet, "stored wallet");
        assertEq(v.githubUserIdHash, githubUserIdHash, "stored hash");

        vm.warp(expiry + 1);
        assertFalse(claims.isVerifiedMaintainer(repoHash, wallet), "expired");
    }

    function test_GetMaintainersFiltersInactive() public {
        vm.warp(1000);
        address wallet1 = address(0x1111);
        address wallet2 = address(0x2222);

        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes memory sig1 = signVerification(backendKey, repoHash, githubUserIdHash, wallet1, expiry);
        bytes memory sig2 = signVerification(backendKey, repoHash, githubUserIdHash, wallet2, expiry);

        claims.registerVerification(repoHash, githubUserIdHash, wallet1, expiry, sig1);
        claims.registerVerification(repoHash, githubUserIdHash, wallet2, expiry, sig2);

        vm.prank(wallet2);
        claims.revokeVerification(repoHash, wallet2);

        address[] memory wallets = claims.getMaintainers(repoHash);
        assertEq(wallets.length, 1, "one active maintainer");
        assertEq(wallets[0], wallet1, "wallet1 active");
    }

    function test_RegisterVerification_Reverts() public {
        vm.warp(1000);
        address wallet = address(0);
        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes memory signature = signVerification(backendKey, repoHash, githubUserIdHash, wallet, expiry);

        vm.expectRevert(IMaintainerClaims.InvalidWallet.selector);
        claims.registerVerification(repoHash, githubUserIdHash, wallet, expiry, signature);

        wallet = address(0x1234);
        expiry = uint64(block.timestamp - 1);
        signature = signVerification(backendKey, repoHash, githubUserIdHash, wallet, expiry);

        vm.expectRevert(IMaintainerClaims.SignatureExpired.selector);
        claims.registerVerification(repoHash, githubUserIdHash, wallet, expiry, signature);

        expiry = uint64(block.timestamp + 1 days);
        signature = signVerification(backendKey, repoHash, githubUserIdHash, wallet, expiry);
        signature[0] = bytes1(uint8(signature[0]) + 1);

        vm.expectRevert(IMaintainerClaims.InvalidSignature.selector);
        claims.registerVerification(repoHash, githubUserIdHash, wallet, expiry, signature);
    }

    function test_RevokeVerification_Auth() public {
        vm.warp(1000);
        address wallet = address(0x1234);
        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes memory signature = signVerification(backendKey, repoHash, githubUserIdHash, wallet, expiry);
        claims.registerVerification(repoHash, githubUserIdHash, wallet, expiry, signature);

        vm.expectRevert(IMaintainerClaims.Unauthorized.selector);
        vm.prank(address(0x9999));
        claims.revokeVerification(repoHash, wallet);

        vm.prank(wallet);
        claims.revokeVerification(repoHash, wallet);
        assertFalse(claims.isVerifiedMaintainer(repoHash, wallet), "revoked");
    }

    function test_Withdraw_RequiresRepo() public {
        vm.warp(1000);
        address wallet = address(0x1234);
        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes memory signature = signVerification(backendKey, repoHash, githubUserIdHash, wallet, expiry);
        claims.registerVerification(repoHash, githubUserIdHash, wallet, expiry, signature);

        vm.expectRevert(IMaintainerClaims.VerificationNotFound.selector);
        vm.prank(wallet);
        claims.withdraw(repoHash, 100);

        vm.prank(admin);
        registry.setLauncher(address(this));
        registry.registerLaunch(repoHash, address(0x1111), 1000);

        vm.prank(wallet);
        claims.withdraw(repoHash, 100);
    }
}
