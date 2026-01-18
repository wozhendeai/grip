// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../src/RepoTokenLauncher.sol";
import "../src/RepoTokenRegistry.sol";
import "../src/RepoTreasury.sol";
import "../src/MaintainerClaims.sol";
import "../src/interfaces/IRepoTokenLauncher.sol";
import "../src/interfaces/IRepoTokenRegistry.sol";
import "./mocks/MockTip20Factory.sol";
import "./mocks/MockStablecoinDex.sol";
import "./mocks/MockTip20Token.sol";
import "./utils/TestBase.sol";
import {ITIP20} from "tempo-std/interfaces/ITIP20.sol";
import {StdPrecompiles} from "tempo-std/StdPrecompiles.sol";
import {StdTokens} from "tempo-std/StdTokens.sol";

contract RepoTokenFlowTest is TestBase {
    address private constant TIP20_FACTORY = StdPrecompiles.TIP20_FACTORY_ADDRESS;
    address private constant STABLECOIN_DEX = StdPrecompiles.STABLECOIN_DEX_ADDRESS;
    address private constant PATH_USD = StdTokens.PATH_USD_ADDRESS;

    RepoTokenRegistry private registry;
    RepoTokenLauncher private launcher;
    RepoTreasury private treasuryImpl;
    MaintainerClaims private claims;

    uint256 private backendKey = 0xB0B;
    address private backend;
    address private admin = address(0xA11CE);

    bytes32 private repoHash = keccak256(abi.encodePacked("owner", "/", "repo"));
    bytes32 private githubUserIdHash = keccak256(abi.encodePacked("user-id"));

    function setUp() public {
        backend = vm.addr(backendKey);

        registry = new RepoTokenRegistry(admin);
        claims = new MaintainerClaims(admin, backend, address(registry));
        treasuryImpl = new RepoTreasury();
        launcher = new RepoTokenLauncher(address(registry), address(claims), backend, admin, address(treasuryImpl));

        vm.prank(admin);
        registry.setLauncher(address(launcher));

        MockTip20Factory factory = new MockTip20Factory();
        vm.etch(TIP20_FACTORY, address(factory).code);

        // Mock DEX calls instead of etching (etching doesn't work for precompile addresses)
        _setupDexMocks();

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

    function _setupDexMocks() internal {
        // Mock createPair to return success
        vm.mockCall(STABLECOIN_DEX, abi.encodeWithSignature("createPair(address)"), abi.encode(bytes32(uint256(1))));

        // Mock balanceOf to return 0 by default
        vm.mockCall(STABLECOIN_DEX, abi.encodeWithSignature("balanceOf(address,address)"), abi.encode(uint128(0)));

        // Mock placeFlip to return order ID 1
        vm.mockCall(
            STABLECOIN_DEX,
            abi.encodeWithSignature("placeFlip(address,uint128,bool,int16,int16)"),
            abi.encode(uint128(1))
        );

        // Mock cancel and withdraw to return success
        vm.mockCall(STABLECOIN_DEX, abi.encodeWithSignature("cancel(uint128)"), abi.encode());
        vm.mockCall(STABLECOIN_DEX, abi.encodeWithSignature("withdraw(address,uint128)"), abi.encode());
    }

    function _mockDexBalance(address account, address token, uint128 balance) internal {
        vm.mockCall(
            STABLECOIN_DEX, abi.encodeWithSignature("balanceOf(address,address)", account, token), abi.encode(balance)
        );
    }

    function test_LaunchToMaintainerWithdrawalFlow() public {
        IRepoTokenLauncher.LaunchConfig memory config = IRepoTokenLauncher.LaunchConfig({
            repoHash: repoHash, tokenName: "RepoToken", tokenSymbol: "REPO", minRaise: 1000e6, duration: 1 days
        });

        launcher.createLaunch(config);

        address depositor = address(0xD00D);
        uint256 amount = 2_000e6;
        MockTip20Token(PATH_USD).mint(depositor, amount);

        vm.prank(depositor);
        MockTip20Token(PATH_USD).approve(address(launcher), amount);
        vm.prank(depositor);
        launcher.deposit(repoHash, amount);

        IRepoTokenLauncher.LaunchState memory launch = launcher.getLaunchState(repoHash);
        vm.warp(uint256(launch.deadline) + 1);
        launcher.finalize(repoHash);

        launch = launcher.getLaunchState(repoHash);
        RepoTreasury treasury = RepoTreasury(launch.treasuryAddress);

        // Mock DEX balance for harvesting and fund quote token for withdrawals
        _mockDexBalance(address(treasury), PATH_USD, 1000);
        MockTip20Token(PATH_USD).mint(address(treasury), 1000);
        treasury.harvestRevenue();
        treasury.executeSplit();

        address maintainer = address(0xCAFE);
        uint64 expiry = uint64(block.timestamp + 1 days);
        bytes memory verificationSig = signVerification(backendKey, repoHash, githubUserIdHash, maintainer, expiry);
        claims.registerVerification(repoHash, githubUserIdHash, maintainer, expiry, verificationSig);

        uint256 withdrawAmount = 300;
        bytes memory withdrawalSig =
            signWithdrawal(backendKey, repoHash, maintainer, maintainer, withdrawAmount, expiry);

        vm.prank(maintainer);
        treasury.withdrawMaintainerFees(maintainer, withdrawAmount, expiry, withdrawalSig);

        assertEq(MockTip20Token(PATH_USD).balanceOf(maintainer), withdrawAmount, "maintainer paid");
    }
}
