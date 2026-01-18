// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/RepoTokenRegistry.sol";
import "../src/interfaces/IRepoTokenRegistry.sol";
import "./utils/TestBase.sol";

contract RepoTokenRegistryTest is TestBase {
    RepoTokenRegistry private registry;

    address private admin = address(0xA11CE);
    address private launcher = address(0xBEEF);

    bytes32 private repoHash = keccak256(abi.encodePacked("owner", "/", "repo"));

    function setUp() public {
        registry = new RepoTokenRegistry(admin);
    }

    function test_SetLauncher_OnlyAdmin() public {
        vm.expectRevert(IRepoTokenRegistry.Unauthorized.selector);
        vm.prank(launcher);
        registry.setLauncher(launcher);

        vm.prank(admin);
        registry.setLauncher(launcher);
        assertEq(registry.launcher(), launcher, "launcher set");
    }

    function test_RegisterLaunch() public {
        vm.prank(admin);
        registry.setLauncher(launcher);

        vm.prank(launcher);
        registry.registerLaunch(repoHash, address(0x1234), 1000);

        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(info.treasuryAddress, address(0x1234), "treasury address");
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Launching), "status");
        assertEq(uint256(info.launchDeadline), 1000, "deadline");

        vm.expectRevert(IRepoTokenRegistry.RepoAlreadyRegistered.selector);
        vm.prank(launcher);
        registry.registerLaunch(repoHash, address(0x5678), 2000);
    }

    function test_FinalizeLaunch() public {
        vm.prank(admin);
        registry.setLauncher(launcher);

        vm.expectRevert(IRepoTokenRegistry.InvalidStatus.selector);
        vm.prank(launcher);
        registry.finalizeLaunch(repoHash, address(0x9999));

        vm.prank(launcher);
        registry.registerLaunch(repoHash, address(0x1234), 1000);

        vm.prank(launcher);
        registry.finalizeLaunch(repoHash, address(0x9999));

        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(info.tokenAddress, address(0x9999), "token address");
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Active), "status");
    }

    function test_LaunchFailureTransitions() public {
        vm.prank(admin);
        registry.setLauncher(launcher);

        vm.expectRevert(IRepoTokenRegistry.InvalidStatus.selector);
        vm.prank(launcher);
        registry.failLaunch(repoHash);

        vm.prank(launcher);
        registry.registerLaunch(repoHash, address(0x1234), 1000);

        vm.prank(launcher);
        registry.failLaunch(repoHash);

        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Failed), "status");

        vm.expectRevert(IRepoTokenRegistry.InvalidStatus.selector);
        vm.prank(launcher);
        registry.finalizeLaunch(repoHash, address(0x8888));
    }

    function test_IsActive() public {
        vm.prank(admin);
        registry.setLauncher(launcher);

        assertFalse(registry.isActive(repoHash), "inactive by default");

        vm.prank(launcher);
        registry.registerLaunch(repoHash, address(0x1234), 1000);
        assertFalse(registry.isActive(repoHash), "still inactive");

        vm.prank(launcher);
        registry.finalizeLaunch(repoHash, address(0x9999));
        assertTrue(registry.isActive(repoHash), "active");
    }
}
