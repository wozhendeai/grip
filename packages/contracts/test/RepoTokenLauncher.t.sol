// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/RepoTokenLauncher.sol";
import "../src/RepoTokenRegistry.sol";
import "../src/RepoTreasury.sol";
import "../src/interfaces/IRepoTokenLauncher.sol";
import "../src/interfaces/IRepoTokenRegistry.sol";
import "./mocks/MockTip20Factory.sol";
import "./mocks/MockStablecoinDex.sol";
import "./mocks/MockTip20Token.sol";
import "./utils/TestBase.sol";
import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {StdPrecompiles} from "tempo-std/StdPrecompiles.sol";
import {StdTokens} from "tempo-std/StdTokens.sol";

contract RepoTokenLauncherTest is TestBase {
    // Precompile addresses
    address private constant TIP20_FACTORY = StdPrecompiles.TIP20_FACTORY_ADDRESS;
    address private constant STABLECOIN_DEX = StdPrecompiles.STABLECOIN_DEX_ADDRESS;
    address private constant PATH_USD = StdTokens.PATH_USD_ADDRESS;

    // Test deposit amounts (PathUSD has 6 decimals)
    uint256 private constant SMALL_DEPOSIT = 100e6; // Below min raise, triggers failure
    uint256 private constant MEDIUM_DEPOSIT = 500e6; // For allocation tests
    uint256 private constant SUCCESS_DEPOSIT = 2_000e6; // Above min raise, triggers success

    RepoTokenRegistry private registry;
    RepoTokenLauncher private launcher;
    RepoTreasury private treasuryImpl;

    address private admin = address(0xA11CE);
    address private backend = address(0xB0B);
    address private maintainerClaims = address(0xCA1);
    address private depositor = address(0xD00D);

    bytes32 private repoHash = keccak256(abi.encodePacked("owner", "/", "repo"));

    function setUp() public {
        registry = new RepoTokenRegistry(admin);
        treasuryImpl = new RepoTreasury();
        launcher = new RepoTokenLauncher(address(registry), maintainerClaims, backend, admin, address(treasuryImpl));

        vm.prank(admin);
        registry.setLauncher(address(launcher));

        MockTip20Factory factory = new MockTip20Factory();
        vm.etch(TIP20_FACTORY, address(factory).code);

        MockStablecoinDex dex = new MockStablecoinDex();
        vm.etch(STABLECOIN_DEX, address(dex).code);

        // Deploy mock at a regular address first (with constructor initialization)
        MockTip20Token pathUsdMock = new MockTip20Token("PathUSD", "PUSD", "USD", ITIP20(address(0)));

        // Etch the bytecode to the precompile address
        vm.etch(PATH_USD, address(pathUsdMock).code);

        // Copy storage from the mock to the precompile address
        // Slot 0: name (string)
        // Slot 1: symbol (string)
        // Slot 2: currency (string)
        // Slot 16 (0x10): initialized (bool) + admin (address packed)
        bytes32 slot0 = vm.load(address(pathUsdMock), bytes32(uint256(0)));
        bytes32 slot1 = vm.load(address(pathUsdMock), bytes32(uint256(1)));
        bytes32 slot2 = vm.load(address(pathUsdMock), bytes32(uint256(2)));
        bytes32 slot16 = vm.load(address(pathUsdMock), bytes32(uint256(16)));

        vm.store(PATH_USD, bytes32(uint256(0)), slot0);
        vm.store(PATH_USD, bytes32(uint256(1)), slot1);
        vm.store(PATH_USD, bytes32(uint256(2)), slot2);
        vm.store(PATH_USD, bytes32(uint256(16)), slot16);
    }

    function test_CreateLaunch_StoresState() public {
        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash, tokenName: "RepoToken", tokenSymbol: "REPO", minRaise: 0, duration: 0
        });

        launcher.createLaunch(config);

        IRepoTokenLauncher.LaunchState memory launch = launcher.getLaunchState(repoHash);
        assertEq(launch.repoHash, repoHash, "repo hash");
        assertEq(launch.minRaise, launcher.DEFAULT_MIN_RAISE(), "min raise");
        assertTrue(launch.deadline > 0, "deadline set");
        assertTrue(launch.treasuryAddress != address(0), "treasury deployed");

        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(info.treasuryAddress, launch.treasuryAddress, "registry treasury");
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Launching), "registry status");
    }

    function test_CreateLaunch_RevertsOnInvalidConfig() public {
        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash, tokenName: "", tokenSymbol: "REPO", minRaise: 0, duration: 0
        });

        vm.expectRevert(IRepoTokenLauncher.InvalidConfig.selector);
        launcher.createLaunch(config);

        config.tokenName = "RepoToken";
        config.tokenSymbol = "";

        vm.expectRevert(IRepoTokenLauncher.InvalidConfig.selector);
        launcher.createLaunch(config);
    }

    function test_CreateLaunch_RevertsWhenExists() public {
        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash, tokenName: "RepoToken", tokenSymbol: "REPO", minRaise: 0, duration: 0
        });

        launcher.createLaunch(config);

        vm.expectRevert(IRepoTokenLauncher.LaunchAlreadyExists.selector);
        launcher.createLaunch(config);
    }

    function test_DepositAndAllocation() public {
        IRepoTokenLauncher.LaunchConfig memory config = _defaultConfig();
        launcher.createLaunch(config);

        _mintApproveAndDeposit(depositor, MEDIUM_DEPOSIT);

        IRepoTokenLauncher.Deposit memory dep = launcher.getDeposit(repoHash, depositor);
        assertEq(dep.amount, MEDIUM_DEPOSIT, "deposit stored");

        uint256 expected = (launcher.TOTAL_SUPPLY() * launcher.SUPPORTER_ALLOCATION()) / 100;
        uint256 allocation = launcher.calculateAllocation(repoHash, depositor);
        assertEq(allocation, expected, "allocation");
    }

    function test_Deposit_RevertsWhenNotApproved() public {
        IRepoTokenLauncher.LaunchConfig memory config = _defaultConfig();
        launcher.createLaunch(config);

        MockTip20Token(PATH_USD).mint(depositor, SMALL_DEPOSIT);

        vm.expectRevert(IRepoTokenLauncher.TransferFailed.selector);
        vm.prank(depositor);
        launcher.deposit(repoHash, SMALL_DEPOSIT);
    }

    function test_FinalizeFailureAndRefund() public {
        IRepoTokenLauncher.LaunchConfig memory config = _defaultConfig();
        launcher.createLaunch(config);

        _mintApproveAndDeposit(depositor, SMALL_DEPOSIT);

        IRepoTokenLauncher.LaunchState memory launch = launcher.getLaunchState(repoHash);
        vm.warp(uint256(launch.deadline) + 1);

        launcher.finalize(repoHash);

        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Failed), "failed status");

        vm.prank(depositor);
        launcher.refund(repoHash);

        assertEq(MockTip20Token(PATH_USD).balanceOf(depositor), SMALL_DEPOSIT, "refund returned");
    }

    function test_FinalizeSuccessAndClaim() public {
        IRepoTokenLauncher.LaunchConfig memory config = _defaultConfig();
        launcher.createLaunch(config);

        _mintApproveAndDeposit(depositor, SUCCESS_DEPOSIT);

        IRepoTokenLauncher.LaunchState memory launch = launcher.getLaunchState(repoHash);
        vm.warp(uint256(launch.deadline) + 1);

        launcher.finalize(repoHash);

        launch = launcher.getLaunchState(repoHash);
        IRepoTokenRegistry.RepoInfo memory info = registry.getRepoInfo(repoHash);
        assertEq(uint256(info.status), uint256(IRepoTokenRegistry.LaunchStatus.Active), "active status");

        RepoTreasury treasury = RepoTreasury(launch.treasuryAddress);
        assertTrue(treasury.initialized(), "treasury initialized");
        assertEq(treasury.repoToken(), launch.tokenAddress, "treasury token");
        assertEq(treasury.quoteToken(), PATH_USD, "treasury quote token");
        assertEq(treasury.maintainerClaims(), maintainerClaims, "maintainer claims");
        assertEq(treasury.backend(), backend, "backend");

        uint256 supporterTokens = (launcher.TOTAL_SUPPLY() * launcher.SUPPORTER_ALLOCATION()) / 100;
        assertEq(
            MockTip20Token(launch.tokenAddress).balanceOf(address(launcher)), supporterTokens, "supporter allocation"
        );

        vm.prank(depositor);
        launcher.claimTokens(repoHash);

        uint256 depositorBalance = MockTip20Token(launch.tokenAddress).balanceOf(depositor);
        assertEq(depositorBalance, supporterTokens, "claim full supply when solo");
    }

    function test_ClaimTokens_RevertsOnFailedLaunch() public {
        IRepoTokenLauncher.LaunchConfig memory config = _defaultConfig();
        launcher.createLaunch(config);

        _mintApproveAndDeposit(depositor, SMALL_DEPOSIT);

        IRepoTokenLauncher.LaunchState memory launch = launcher.getLaunchState(repoHash);
        vm.warp(uint256(launch.deadline) + 1);
        launcher.finalize(repoHash);

        vm.expectRevert(IRepoTokenLauncher.LaunchNotFound.selector);
        vm.prank(depositor);
        launcher.claimTokens(repoHash);
    }

    /// @notice Creates a default launch config for tests
    function _defaultConfig() internal view returns (IRepoTokenLauncher.LaunchConfig memory) {
        return IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash,
            tokenName: "RepoToken",
            tokenSymbol: "REPO",
            minRaise: launcher.DEFAULT_MIN_RAISE(),
            duration: 1 days
        });
    }

    /// @notice Mints PathUSD to user, approves launcher, and deposits in one call
    function _mintApproveAndDeposit(address user, uint256 amount) internal {
        MockTip20Token(PATH_USD).mint(user, amount);
        vm.prank(user);
        MockTip20Token(PATH_USD).approve(address(launcher), amount);
        vm.prank(user);
        launcher.deposit(repoHash, amount);
    }
}
